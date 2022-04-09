'use strict'

const discord = require('discord.js')
const playdl = require('play-dl')
const voice = require('@discordjs/voice')
const os = require("os")

const client = new discord.Client({
    intents: [
        discord.Intents.FLAGS.GUILDS,
        discord.Intents.FLAGS.GUILD_MEMBERS,
        discord.Intents.FLAGS.GUILD_MESSAGES,
        discord.Intents.FLAGS.GUILD_VOICE_STATES
    ]
})

const prefix = "!"

const streams = []

client.login().catch((e) => {
    console.error("The bot token was incorrect.\n" + e)
})

client.on("messageCreate", async message => {
    if (message.author.bot) return

    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/)

        switch (args.shift().toLowerCase()) {
            case "help":
                await message.reply("Command: !play, !control, !loop, !pause, !resume, !stop, !volume, !leave, !stats")
                break
            case "play":
            case "p":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                await play_audio(args, message.guildId, message.member.voice.channelId)
                await message.channel.send({
                    embeds: [make_playing_embed(message.guildId, message.author)],
                    components: [get_control_button_row()],
                    allowedMentions: {repliedUser: false}
                })
                break
            case "stop":
            case "s":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                if (!any_audio_playing(message.guildId)) {
                    await message.reply({
                        embeds: [make_simple_embed("No audio is currently playing")],
                        allowedMentions: {repliedUser: false}
                    })
                    return
                }

                stop_audio(message.guildId)
                const embed = make_simple_embed("YouTube audio successfully stopped!").setFooter({
                    text: "by " + message.author.username + "#" + message.author.discriminator,
                    iconURL: message.author.displayAvatarURL({size: 16, dynamic: true})
                })
                await message.channel.send({
                    embeds: [embed],
                    allowedMentions: {repliedUser: false}
                })
                break
            case "loop":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                if (!any_audio_playing(message.guildId)) {
                    await message.reply({
                        embeds: [make_simple_embed("No audio is currently playing")],
                        allowedMentions: {repliedUser: false}
                    })
                    return
                }

                streams[message.guildId].loop = !streams[message.guildId].loop
                await message.reply({
                    embeds: [make_simple_embed(streams[message.guildId].loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio")],
                    allowedMentions: {repliedUser: false}
                })
                break
            case "volume":
            case "vol":
            case "v":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                if (!any_audio_playing(message.guildId)) {
                    await message.reply({
                        embeds: [make_simple_embed("No audio is currently playing")],
                        allowedMentions: {repliedUser: false}
                    })
                    return
                }

                if (args.length > 0) {
                    const volume = args[0].replaceAll("%", "")

                    set_audio_volume(volume, message.guildId)
                    await message.reply({
                        embeds: [make_simple_embed("Audio volume set to " + (parseInt(volume) > 100 ? "100" : volume) + "%")],
                        allowedMentions: {repliedUser: false}
                    })
                }
                break
            case "pause":
            case "resume":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                if (!any_audio_playing(message.guildId)) {
                    await message.reply({embeds: [make_simple_embed("No audio is currently playing")]})
                    return
                }

                // 0 = resumed
                // 1 = paused
                if (pause_audio(message.guildId) === 0) {
                    await message.reply({
                        embeds: [make_simple_embed("The currently playing audio has been successfully **resumed**")],
                        allowedMentions: {repliedUser: false}
                    })
                } else {
                    await message.reply({
                        embeds: [make_simple_embed("The currently playing audio has been successfully **paused**")],
                        allowedMentions: {repliedUser: false}
                    })
                }
                break
            case "control":
            case "c":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                if (!any_audio_playing(message.guildId)) {
                    await message.reply({embeds: [make_simple_embed("No audio is currently playing")]})
                    return
                }

                await message.channel.send({
                    embeds: [make_playing_embed(message.guildId, message.author)],
                    components: [get_control_button_row()],
                    allowedMentions: {repliedUser: false}
                })
                break
            case "leave":
            case "l":
                if (!is_same_vc_as(message.member.id, message.guildId) && !message.guild.members.cache.get(client.user.id).voice.channel) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                leave_voice_channel(message.guildId)
                break
            case "stats":
                await message.reply({
                    embeds: [make_simple_embed("" +
                        "**❯  broki's music bot** - v1-dev" +
                        "\n\n" +
                        "• CPU Usage: " + os.loadavg().toString().split(",")[0] + "%\n" +
                        "• RAM Usage: " + (Math.round(process.memoryUsage().rss / 10485.76) / 100) + " MB\n" +
                        "\n" +
                        "• Latency: " + client.ws.ping + "ms\n" +
                        "• Guilds: " + client.guilds.cache.size + "\n" +
                        "\n" +
                        "• Developer: [brokiem](https://github.com/brokiem)\n" +
                        "• Library: discord.js\n" +
                        "• Github: [broki's music bot](https://github.com/brokiem/broki-s-music-bot)"
                    )],
                    allowedMentions: {repliedUser: false}
                })
                break
        }
    }
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return

    if (!is_same_vc_as(interaction.user.id, interaction.guildId)) {
        await interaction.reply({
            embeds: [make_simple_embed("You are not in the same voice channel!")],
            ephemeral: true,
            fetchReply: true
        })
        return
    }

    if (!any_audio_playing(interaction.guildId)) {
        await interaction.reply({
            embeds: [make_simple_embed("No audio is currently playing")],
            ephemeral: true,
            fetchReply: true
        })
        return
    }

    let inter = null

    if (interaction.customId === 'pause') {
        if (pause_audio(interaction.guildId) === 0) {
            inter = await interaction.reply({
                embeds: [make_simple_embed("The currently playing audio has been successfully **resumed**").setFooter({
                    text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                    iconURL: interaction.user.displayAvatarURL({size: 16, dynamic: true})
                })],
                fetchReply: true
            })
        } else {
            inter = await interaction.reply({
                embeds: [make_simple_embed("The currently playing audio has been successfully **paused**").setFooter({
                    text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                    iconURL: interaction.user.displayAvatarURL({size: 16, dynamic: true})
                })],
                fetchReply: true
            })
        }
    } else if (interaction.customId === 'stop') {
        stop_audio(interaction.guildId)
        const embed = make_simple_embed("YouTube audio successfully stopped!").setFooter({
            text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
            iconURL: interaction.user.displayAvatarURL({size: 16, dynamic: true})
        })

        interaction.reply({embeds: [embed], fetchReply: true})
    } else if (interaction.customId === 'loop') {
        streams[interaction.guildId].loop = !streams[interaction.guildId].loop
        const embed = make_simple_embed(streams[interaction.guildId].loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio").setFooter({
            text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
            iconURL: interaction.user.displayAvatarURL({size: 16, dynamic: true})
        })
        inter = await interaction.reply({
            embeds: [embed],
            fetchReply: true
        })
    }

    if (inter !== null) {
        setTimeout(function () {
            inter.delete()
        }, 10000)
    }
})

client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.channelId === null) {
        if (newState.channelId === newState.guild.me.voice.channelId && newState.channel.members.size === 1) {
            setTimeout(() => {
                leave_voice_channel(newState.guild.id)
            }, 5000)
        }
    }
})

async function play_audio(input, guild_id, voice_channel_id) {
    prepare_voice_connection(guild_id, voice_channel_id)

    if (playdl.yt_validate(input[0]) === 'video') {
        const result = await playdl.video_info(input[0])

        streams[guild_id].yt_title = result.video_details.title
        streams[guild_id].yt_url = result.video_details.url
        streams[guild_id].yt_thumbnail_url = result.video_details.thumbnails[0].url

        streams[guild_id].looped_url = result.video_details.url

        await broadcast_audio(guild_id, await playdl.stream_from_info(result, {discordPlayerCompatibility: true}))
    } else {
        const results = await playdl.search(input.join(" "), {limit: 1})
        const res = await playdl.video_info(results[0].url)

        streams[guild_id].yt_title = res.video_details.title
        streams[guild_id].yt_url = res.video_details.url
        streams[guild_id].yt_thumbnail_url = res.video_details.thumbnails[0].url

        streams[guild_id].looped_url = results[0].url

        await broadcast_audio(guild_id, await playdl.stream_from_info(res, {discordPlayerCompatibility: true}))
    }
}

async function broadcast_audio(guild_id, stream) {
    streams[guild_id].resource = voice.createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
    })
    streams[guild_id].resource.volume.setVolumeLogarithmic(0.5)

    streams[guild_id].player.play(streams[guild_id].resource)
    streams[guild_id].conn.subscribe(streams[guild_id].player)

    streams[guild_id].playing = true
}

function stop_audio(guild_id) {
    streams[guild_id].loop = false
    streams[guild_id].looped_url = null
    streams[guild_id].player.stop(true)
}

function set_audio_volume(volume, guild_id) {
    if (parseInt(volume) <= 100) {
        streams[guild_id].resource.volume.setVolumeLogarithmic(parseInt(volume) / 100)
    } else {
        streams[guild_id].resource.volume.setVolumeLogarithmic(1)
    }
}

function pause_audio(guild_id) {
    streams[guild_id].playing = !streams[guild_id].playing

    if (streams[guild_id].playing) {
        streams[guild_id].player.unpause()
        return 0
    } else {
        streams[guild_id].player.pause()
        return 1
    }
}

function is_same_vc_as(user_id, guild_id) {
    const guild = client.guilds.cache.get(guild_id)
    if (!guild.members.cache.get(user_id).voice.channel) {
        return false
    }
    if (guild.members.cache.get(user_id).voice.channel && !guild.members.cache.get(client.user.id).voice.channel) {
        return true
    }
    return guild.members.cache.get(user_id).voice.channel?.id === guild.members.cache.get(client.user.id).voice.channel?.id
}

function prepare_voice_connection(guild_id, voice_channel_id) {
    streams[guild_id] = {}
    streams[guild_id].player = voice.createAudioPlayer()
    streams[guild_id].conn = null
    streams[guild_id].resource = null
    streams[guild_id].playing = false
    streams[guild_id].looped_url = null
    streams[guild_id].loop = false
    streams[guild_id].yt_title = undefined
    streams[guild_id].yt_url = undefined
    streams[guild_id].yt_thumbnail_url = undefined

    const voice_connection = voice.getVoiceConnection(guild_id)
    if (!voice_connection || voice_connection?.state.status === voice.VoiceConnectionStatus.Disconnected) {
        streams[guild_id].conn?.destroy()

        streams[guild_id].conn = voice.joinVoiceChannel({
            channelId: voice_channel_id,
            guildId: guild_id,
            adapterCreator: client.guilds.cache.get(guild_id).voiceAdapterCreator
        }).on(voice.VoiceConnectionStatus.Disconnected, onDisconnect)
    } else {
        if (!streams[guild_id].conn) {
            streams[guild_id].conn = voice_connection
        }
    }

    streams[guild_id].player.on(voice.AudioPlayerStatus.Idle, async () => {
        streams[guild_id].resource = null
        streams[guild_id].playing = false

        if (streams[guild_id].loop) {
            const result = await playdl.video_info(streams[guild_id].looped_url)
            await broadcast_audio(guild_id, await playdl.stream_from_info(result, {discordPlayerCompatibility: true}))
        }
    })
}

function leave_voice_channel(guild_id) {
    if (streams[guild_id] === undefined) {
        return false
    }

    streams[guild_id].conn?.disconnect()
    streams[guild_id].conn?.destroy()

    delete streams[guild_id]
    global.gc()
    return true
}

function make_simple_embed(string) {
    return new discord.MessageEmbed().setDescription(string)
}

function make_playing_embed(guild_id, member) {
    return new discord.MessageEmbed()
        .setColor('#35cf7d')
        .setTitle("Playing YouTube")
        .setDescription("[" + streams[guild_id].yt_title + "](" + streams[guild_id].yt_url + ")")
        .setThumbnail(streams[guild_id].yt_thumbnail_url)
        .setFooter({
            text: "by " + member.username + "#" + member.discriminator,
            iconURL: member.displayAvatarURL({size: 16, dynamic: true})
        })
}

function get_control_button_row() {
    const play = new discord.MessageButton().setStyle(2).setCustomId("stop").setLabel("STOP ⏹")
    const pause = new discord.MessageButton().setStyle(2).setCustomId("pause").setLabel("PAUSE/RESUME ⏯")
    const loop = new discord.MessageButton().setStyle(2).setCustomId("loop").setLabel("LOOP 🔁")
    return new discord.MessageActionRow().addComponents([play, pause, loop])
}

function any_audio_playing(guild_id) {
    if (streams[guild_id] === undefined) {
        return false
    }
    return streams[guild_id].resource === null ? false : true
}

async function onDisconnect(guild_id) {
    try {
        await Promise.race([
            voice.entersState(streams[guild_id].conn, voice.VoiceConnectionStatus.Signalling, 2_000),
            voice.entersState(streams[guild_id].conn, voice.VoiceConnectionStatus.Connecting, 2_000),
        ])
    } catch (error) {
        leave_voice_channel(guild_id)
    }
}
