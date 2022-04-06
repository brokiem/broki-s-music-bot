const ytdl = require('ytdl-core')
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

let player = new voice.AudioPlayer()
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
                    player.stop(true)
                    await message.reply("Music stopped")
                    break
                case "volume":
                    if (args.length > 0) {
                        resource.volume.setVolumeLogarithmic(parseInt(args[0]) / 100)
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
                            if (ytdl.validateURL(args[0])) {
                                const stream = ytdl(args[0], {filter: "audioonly"})
                                resource = voice.createAudioResource(stream, {
                                    inputType: voice.StreamType.Arbitrary,
                                    inlineVolume: true
                                })

                                player.play(resource)
                                conn.subscribe(player)
                            } else {
                                await message.reply("Invalid URL!")
                            }
                        } catch (e) {
                            await message.reply(e.toString())
                        }
                    }
                    break
            }
        }
    } catch (e) {
        console.log("An error occurred!: " + e.toString())
    }
})