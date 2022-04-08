const discord = require('discord.js')
const playdl = require('play-dl')
const voice = require('@discordjs/voice')

const client = new discord.Client({
    intents: [
        discord.Intents.FLAGS.GUILDS,
        discord.Intents.FLAGS.GUILD_MEMBERS,
        discord.Intents.FLAGS.GUILD_MESSAGES,
        discord.Intents.FLAGS.GUILD_VOICE_STATES
    ]
})

const prefix = "!"

let player = voice.createAudioPlayer()
let conn = null
let stream = null
let resource = null
let playing = false
let looped_url = null
let loop = false

let yt_title
let yt_url
let yt_thumbnail_url

client.login().catch((e) => {
    console.error("The bot token was incorrect.\n" + e)
})

client.on("messageCreate", async message => {
    try {
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/)

            switch (args.shift().toLowerCase()) {
                case "help":
                    await message.reply("Command: !play, !control, !loop, !pause, !resume, !stop, !volume, !leave")
                    break
                case "play":
                case "p":
                    await play_audio(args, message)
                    break
                case "stop":
                case "s":
                    await stop_audio(args, message)
                    break
                case "pause":
                case "break":
                case "resume":
                    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
                        await message.reply("You are not in the same voice channel!")
                        return
                    }

                    const status = await pause_audio()
                    await message.reply(status)
                    break
                case "volume":
                case "vol":
                    await set_audio_volume(args, message)
                    break
                case "control":
                case "c":
                    await control_audio(args, message)
                    break
                case "leave":
                    conn?.disconnect()
                    conn?.destroy()
                    conn = null
                    break
                case "loop":
                    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
                        await message.reply("You are not in the same voice channel!")
                        return
                    }

                    loop = !loop
                    await message.reply(loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio")
                    break
            }
        }
    } catch (e) {
        console.log("An error occurred!: " + e.toString())
        await message.reply("An error occurred!: " + e.toString())
    }
})

async function set_audio_volume(args, message) {
    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
        message.reply("You are not in the same voice channel!")
        return
    }

    if (args.length > 0) {
        if (!playing) {
            message.reply("No audio playing")
            return
        }

        if (parseInt(args[0].replaceAll("%", "")) <= 100) {
            resource.volume.setVolumeLogarithmic(parseInt(args[0]) / 100)
            message.reply("Audio volume set to " + args[0].replaceAll("%", "") + "%")
        } else {
            resource.volume.setVolumeLogarithmic(1)
            message.reply("Audio volume set to 100%")
        }
    }
}

async function pause_audio() {
    playing = !playing

    if (playing) {
        player.unpause()
        return "Audio resumed"
    } else {
        player.pause()
        return "Audio paused"
    }
}

async function stop_audio(args, message) {
    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
        message.reply("You are not in the same voice channel!")
        return
    }

    if (!playing) {
        message.reply("No audio playing")
        return
    }

    loop = false
    looped_url = null
    player.stop(true)

    const embed = new discord.MessageEmbed()
        .setColor('#35cf7d')
        .setDescription("YouTube audio successfully stopped!")
        .setFooter({
            text: "by " + message.author.username + "#" + message.author.discriminator,
            iconURL: message.author.displayAvatarURL({size: 16, dynamic: true})
        })
    message.channel.send({embeds: [embed]})
}

async function control_audio(args, message) {
    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
        message.reply("You are not in the same voice channel!")
        return
    }

    const embed = new discord.MessageEmbed()
        .setColor("#35cf7d")
        .setTitle("Now Playing")
        .setDescription("[" + yt_title + "](" + yt_url + ")")
        .setThumbnail(yt_thumbnail_url)

    const rewind = new discord.MessageButton().setStyle(2).setCustomId("rewind").setLabel("⏪")
    const play = new discord.MessageButton().setStyle(2).setCustomId("play").setLabel("⏯")
    const pause = new discord.MessageButton().setStyle(2).setCustomId("pause").setLabel("⏸")
    const loop = new discord.MessageButton().setStyle(2).setCustomId("loop").setLabel("🔁")
    const forward = new discord.MessageButton().setStyle(2).setCustomId("forward").setLabel("⏩")

    const row = new discord.MessageActionRow().addComponents([rewind, play, pause, loop, forward])

    await message.reply({embeds: [embed], components: [row]})
}

async function play_audio(args, message) {
    if (args.length > 0) {
        if (message.member.voice.channel?.id === null) {
            message.reply("You are not in the same voice channel!")
            return
        }

        const voice_connection = voice.getVoiceConnection(message.guildId)
        if (!voice_connection || voice_connection?.state.status === voice.VoiceConnectionStatus.Disconnected) {
            conn?.destroy()

            conn = voice.joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            }).on(voice.VoiceConnectionStatus.Disconnected, onDisconnect)
        } else {
            if (conn === null) {
                conn = voice_connection
            }
        }

        if (playdl.yt_validate(args[0]) === 'video') {
            playdl.video_info(args[0]).then(result => {
                yt_title = result.video_details.title
                yt_url = result.video_details.url
                yt_thumbnail_url = result.video_details.thumbnails[0].url

                message.channel.send({embeds: [makePlayingEmbed(message)]})

                looped_url = result.video_details.url

                playdl.stream_from_info(result, {
                    discordPlayerCompatibility: true
                }).then(r => {
                    stream = r
                    broadcast_audio()
                })
            })
        } else {
            try {
                const results = await playdl.search(args.join(" "), {
                    limit: 1
                })
                const res = await playdl.video_info(results[0].url)

                yt_title = res.video_details.title
                yt_url = res.video_details.url
                yt_thumbnail_url = res.video_details.thumbnails[0].url

                message.channel.send({embeds: [makePlayingEmbed(message)]})

                looped_url = results[0].url

                playdl.stream(results[0].url, {
                    discordPlayerCompatibility: true
                }).then(r => {
                    stream = r
                    broadcast_audio()
                }).catch()
            } catch (e) {
                message.reply(e.toString())
            }
        }

        loop = false
    }
}

async function broadcast_audio() {
    resource = voice.createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
    })
    resource.volume.setVolumeLogarithmic(0.5)

    player.play(resource)
    conn.subscribe(player)

    playing = true
}

player.on(voice.AudioPlayerStatus.Idle, () => {
    resource = null
    stream = null
    playing = false

    if (loop) {
        playdl.video_info(looped_url).then(result => {
            playdl.stream_from_info(result, {
                discordPlayerCompatibility: true
            }).then(r => {
                stream = r
                broadcast_audio()
            })
        })
    }
})

function makePlayingEmbed(message) {
    return new discord.MessageEmbed()
        .setColor('#35cf7d')
        .setTitle("Playing YouTube")
        .setDescription("[" + yt_title + "](" + yt_url + ")")
        .setThumbnail(yt_thumbnail_url)
        .setFooter({
            text: "by " + message.author.username + "#" + message.author.discriminator,
            iconURL: message.author.displayAvatarURL({size: 16, dynamic: true})
        })
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return

    if (interaction.member.voice.channel?.id !== interaction.guild.me.voice.channel?.id) {
        await interaction.channel.send("You are not in the same voice channel!")
        return
    }

    if (interaction.customId === 'rewind') {

    } else if (interaction.customId === 'pause') {
        const status = await pause_audio()
        interaction.reply({content: status})
    } else if (interaction.customId === 'play') {
        const status = await pause_audio()
        interaction.reply({content: status})
    } else if (interaction.customId === 'loop') {
        loop = !loop
        interaction.reply({content: loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio"})
    } else if (interaction.customId === 'forward') {

    }
})

async function onDisconnect() {
    try {
        await Promise.race([
            voice.entersState(conn, voice.VoiceConnectionStatus.Signalling, 3_000),
            voice.entersState(conn, voice.VoiceConnectionStatus.Connecting, 3_000),
        ])
    } catch (error) {
        conn?.disconnect()
        conn?.destroy()
        conn = null
    }
}