const ytdl = require('ytdl-core')
const playdl = require('play-dl')
const discord = require('discord.js')
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

let player = null
let conn = voice.getVoiceConnection("868112125640454154")
let resource

client.login().catch((e) => {
    console.error("The bot token was incorrect.\n" + e)
})

client.on("messageCreate", async message => {
    try {
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/)

            switch (args.shift().toLowerCase()) {
                case "stop":
                    if (player == null) {
                        await message.reply("No audio playing")
                        return
                    }

                    player?.stop(true)
                    player = null
                    await message.reply("Audio stopped")
                    break
                case "volume":
                    if (args.length > 0) {
                        if (parseInt(args[0]) <= 100) {
                            resource.volume.setVolumeLogarithmic(parseInt(args[0]) / 100)
                            await message.reply("Audio volume set to " + args[0] + "%")
                        } else {
                            resource.volume.setVolumeLogarithmic(1)
                            await message.reply("Audio volume set to 100%")
                        }
                    }
                    break
                case "play":
                case "p":
                    if (args.length > 0) {
                        if (!voice.getVoiceConnection("868112125640454154") || voice.getVoiceConnection("868112125640454154")?.state.status === voice.VoiceConnectionStatus.Disconnected) {
                            conn?.destroy()
                            conn = null

                            conn = voice.joinVoiceChannel({
                                channelId: message.member.voice.channel.id,
                                guildId: message.guild.id,
                                adapterCreator: message.guild.voiceAdapterCreator
                            })

                            conn.on(voice.VoiceConnectionStatus.Disconnected, async () => {
                                try {
                                    await Promise.race([
                                        voice.entersState(conn, voice.VoiceConnectionStatus.Signalling, 5_000),
                                        voice.entersState(conn, voice.VoiceConnectionStatus.Connecting, 5_000),
                                    ])
                                } catch (error) {
                                    conn?.disconnect()
                                    conn?.destroy()
                                    conn = null
                                }
                            })
                        } else {
                            if (conn === null) {
                                conn = voice.getVoiceConnection("868112125640454154")
                            }
                        }

                        try {
                            let stream

                            if (ytdl.validateURL(args[0])) {
                                let yt_info = await playdl.video_info(args[0])
                                stream = await playdl.stream_from_info(yt_info, {quality: 1})

                                await message.reply("Playing **" + yt_info.video_details.title + "** from youtube with volume 60% by **" + message.author.username + "**")
                            } else {
                                let yt_info = await playdl.search(args.join(" "), {
                                    limit: 1
                                })
                                stream = await playdl.stream(yt_info[0].url, {quality: 1})

                                await message.reply("Playing audio from youtube with volume 60% by **" + message.author.username + "**")
                            }

                            resource = voice.createAudioResource(stream.stream, {
                                inputType: stream.type,
                                inlineVolume: true
                            })

                            player = new voice.AudioPlayer()
                            player.play(resource)
                            conn.subscribe(player)

                            resource.volume.setVolumeLogarithmic(0.6)
                        } catch (e) {
                            await message.reply(e.toString())
                        }
                    }
                    break
            }
        }
    } catch (e) {
        console.log("An error occurred!: " + e.toString())
        await message.reply("An error occurred!: " + e.toString())
    }
})