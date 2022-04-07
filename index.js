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

client.login().catch((e) => {
    console.error("The bot token was incorrect.\n" + e)
})

client.on("messageCreate", async message => {
    try {
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/)

            switch (args.shift().toLowerCase()) {
                case "help":
                    await message.reply("Command: !play, !loop, !pause, !resume, !stop, !volume, !leave")
                    break
                case "play":
                case "p":
                    play_audio(args, message)
                    break
                case "stop":
                case "s":
                    stop_audio(args, message)
                    break
                case "pause":
                case "break":
                case "resume":
                    pause_audio(args, message)
                    break
                case "volume":
                case "vol":
                    set_audio_volume(args, message)
                    break
                case "leave":
                    conn?.disconnect()
                    conn?.destroy()
                    conn = null
                    break
                case "loop":
                    if (message.member.voice.channel === null) {
                        await message.reply("You are not in a voice channel!")
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

function set_audio_volume(args, message) {
    if (message.member.voice.channel === null) {
        message.reply("You are not in a voice channel!")
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

function pause_audio(args, message) {
    if (message.member.voice.channel === null) {
        message.reply("You are not in a voice channel!")
        return
    }

    if (!playing) {
        player.unpause()
        message.reply("Audio resumed")
    } else {
        player.pause()
        message.reply("Audio paused")
    }

    playing = !playing
}

function stop_audio(args, message) {
    if (message.member.voice.channel === null) {
        message.reply("You are not in a voice channel!")
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

function play_audio(args, message) {
    if (args.length > 0) {
        if (message.member.voice.channel === null) {
            message.reply("You are not in a voice channel!")
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
                message.channel.send({
                    embeds: [makePlayingEmbed(message, "Playing YouTube Audio", result.video_details.title, result.video_details.url, result.video_details.thumbnails[0].url)]
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
            playdl.search(args.join(" "), {
                limit: 1
            }).then(results => {
                try {
                    playdl.video_info(results[0].url).then(res => {
                        message.channel.send({
                            embeds: [makePlayingEmbed(message, "Playing YouTube Audio", res.video_details.title, results[0].url, results[0].thumbnails[0].url)]
                        })
                        looped_url = results[0].url
                    })
                } catch (e) {
                    message.reply("No result found")
                    return
                }

                playdl.stream(results[0].url, {
                    discordPlayerCompatibility: true
                }).then(r => {
                    stream = r
                    broadcast_audio()
                })
            })
        }

        loop = false
    }
}

function broadcast_audio() {
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

function makePlayingEmbed(message, title, description, url, thumbnail_url) {
    return new discord.MessageEmbed()
        .setColor('#35cf7d')
        .setTitle(title)
        .setDescription("[" + description + "](" + url + ")")
        .setThumbnail(thumbnail_url)
        .setFooter({
            text: "by " + message.author.username + "#" + message.author.discriminator,
            iconURL: message.author.displayAvatarURL({size: 16, dynamic: true})
        })
}

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