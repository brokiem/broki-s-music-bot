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
                    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
                        await message.reply("You are not in the same voice channel!")
                        return
                    }

                    await play_audio(args, message)
                    break
                case "stop":
                case "s":
                    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
                        await message.reply("You are not in the same voice channel!")
                        return
                    }

                    const result = await stop_audio()
                    if (result) {
                        const embed = new discord.MessageEmbed()
                            .setColor('#35cf7d')
                            .setDescription("YouTube audio successfully stopped!")
                            .setFooter({
                                text: "by " + message.author.username + "#" + message.author.discriminator,
                                iconURL: message.author.displayAvatarURL({size: 16, dynamic: true})
                            })
                        await message.channel.send({embeds: [embed]})
                    } else {
                        await message.reply(result)
                    }
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
                    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
                        await message.reply("You are not in the same voice channel!")
                        return
                    }

                    if (args.length > 0) {
                        await set_audio_volume(args[0])
                    }
                    break
                case "control":
                case "c":
                    if (message.member.voice.channel?.id !== message.guild.me.voice.channel?.id) {
                        await message.reply("You are not in the same voice channel!")
                        return
                    }

                    const control_embed = make_control_audio_embed()
                    await message.reply((typeof control_embed === "string") ? control_embed : {
                        embeds: [control_embed.embed],
                        components: [control_embed.component]
                    })
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

async function set_audio_volume(volume) {
    if (resource === null) {
        return "No audio playing"
    }

    if (parseInt(volume.toString().replaceAll("%", "")) <= 100) {
        resource.volume.setVolumeLogarithmic(parseInt(volume) / 100)
        return "Audio volume set to " + volume.toString().replaceAll("%", "") + "%"
    } else {
        resource.volume.setVolumeLogarithmic(1)
        return "Audio volume set to 100%"
    }
}

async function pause_audio() {
    if (resource === null) {
        return "No audio playing"
    }

    playing = !playing

    if (playing) {
        player.unpause()
        return "Audio resumed"
    } else {
        player.pause()
        return "Audio paused"
    }
}

async function stop_audio() {
    if (resource === null) {
        return "No audio playing"
    }

    loop = false
    looped_url = null
    player.stop(true)

    return true
}

function make_control_audio_embed() {
    if (resource === null) {
        return "No audio playing"
    }

    const embed = new discord.MessageEmbed()
        .setColor("#35cf7d")
        .setTitle("Now Playing")
        .setDescription("[" + yt_title + "](" + yt_url + ")")
        .setThumbnail(yt_thumbnail_url)

    const play = new discord.MessageButton().setStyle(2).setCustomId("stop").setLabel("STOP ⏹")
    const pause = new discord.MessageButton().setStyle(2).setCustomId("pause").setLabel("PAUSE/RESUME ⏯")
    const loop = new discord.MessageButton().setStyle(2).setCustomId("loop").setLabel("LOOP 🔁")

    const row = new discord.MessageActionRow().addComponents([play, pause, loop])

    return {embed: embed, component: row}
}

async function play_audio(url, message) {
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

    if (playdl.yt_validate(url) === 'video') {
        playdl.video_info(url).then(result => {
            yt_title = result.video_details.title
            yt_url = result.video_details.url
            yt_thumbnail_url = result.video_details.thumbnails[0].url

            message.channel.send({
                embeds: [make_playing_embed(message)],
                components: [make_control_audio_embed().component]
            })

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

            const play = new discord.MessageButton().setStyle(2).setCustomId("stop").setLabel("STOP ⏹")
            const pause = new discord.MessageButton().setStyle(2).setCustomId("pause").setLabel("PAUSE/RESUME ⏯")
            const loop = new discord.MessageButton().setStyle(2).setCustomId("loop").setLabel("LOOP 🔁")

            const row = new discord.MessageActionRow().addComponents([play, pause, loop])

            message.channel.send({embeds: [make_playing_embed(message)], components: [row]})

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

function make_playing_embed(message) {
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
        await interaction.reply({content: "You are not in the same voice channel!", ephemeral: true})
        return
    }

    if (resource === null) {
        interaction.reply({content: 'No audio playing!', ephemeral: true})
        return
    }

    let inter = null

    if (interaction.customId === 'pause') {
        const status = await pause_audio()
        inter = await interaction.reply({
            content: status + " | by " + interaction.user.username + "#" + interaction.user.discriminator,
            fetchReply: true
        })
    } else if (interaction.customId === 'stop') {
        loop = false
        looped_url = null
        player.stop(true)

        const embed = new discord.MessageEmbed()
            .setColor('#35cf7d')
            .setDescription("YouTube audio successfully stopped!")
            .setFooter({
                text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                iconURL: interaction.user.displayAvatarURL({size: 16, dynamic: true})
            })

        interaction.reply({embeds: [embed], fetchReply: true})
    } else if (interaction.customId === 'loop') {
        loop = !loop
        inter = await interaction.reply({
            content: loop ? "Loop successfully **enabled** for current audio" + " | by " + interaction.user.username + "#" + interaction.user.discriminator : "Loop successfully **disabled** for current audio" + " | by " + interaction.user.username + "#" + interaction.user.discriminator,
            fetchReply: true
        })
    }

    if (inter !== null) {
        setTimeout(function () {
            inter.delete()
        }, 10000)
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