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

const streams = []

client.login().catch((e) => {
    console.error("The bot token was incorrect.\n" + e)
})

client.on("messageCreate", message => {
    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/)

        switch (args.shift().toLowerCase()) {
            case "help":
                message.reply("Command: !play, !control, !loop, !pause, !resume, !stop, !volume, !leave")
                break
            case "play":
            case "p":
                if (!is_same_vc_as(message.member.id, message.guildId)) {
                    message.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
                    return
                }

                play_audio(args, message.guildId, message.channelId).then(() => {
                    message.channel.send({
                        embeds: [make_playing_embed(message.guildId, message.author)],
                        components: [get_control_button_row()]
                    })
                })
                break
        }
    }
})

async function play_audio(input, guild_id, channel_id) {
    prepare_voice_connection(guild_id, channel_id)

    if (playdl.yt_validate(input) === 'video') {
        playdl.video_info(input).then(result => {
            streams[guild_id].yt_title = result.video_details.title
            streams[guild_id].yt_url = result.video_details.url
            streams[guild_id].yt_thumbnail_url = result.video_details.thumbnails[0].url

            streams[guild_id].looped_url = result.video_details.url

            playdl.stream_from_info(result, {discordPlayerCompatibility: true}).then(r => {
                streams[guild_id].stream = r
                broadcast_audio(guild_id)
            })
        })
    } else {
        const results = await playdl.search(input.join(" "), {
            limit: 1
        })
        const res = await playdl.video_info(results[0].url)

        streams[guild_id].yt_title = res.video_details.title
        streams[guild_id].yt_url = res.video_details.url
        streams[guild_id].yt_thumbnail_url = res.video_details.thumbnails[0].url

        streams[guild_id].looped_url = results[0].url

        playdl.stream(results[0].url, {discordPlayerCompatibility: true}).then(r => {
            streams[guild_id].stream = r
            broadcast_audio(guild_id)
        })
    }
}

async function broadcast_audio(guild_id) {
    streams[guild_id].resource = voice.createAudioResource(streams[guild_id].stream, {
        inputType: streams[guild_id].stream.type,
        inlineVolume: true
    })
    streams[guild_id].resource.volume.setVolumeLogarithmic(0.5)

    streams[guild_id].player.play(streams[guild_id].resource)
    streams[guild_id].conn.subscribe(streams[guild_id].player)

    streams[guild_id].playing = true
}

function is_same_vc_as(user_id, guild_id) {
    const guild = client.guilds.cache.get(guild_id)
    if (guild.members.cache.get(user_id).voice.channel && !guild.members.cache.get(client.user.id).voice.channel) {
        return true
    }
    return guild.members.cache.get(user_id).voice.channel?.id === guild.members.cache.get(client.user.id).voice.channel?.id
}

function prepare_voice_connection(guild_id, channel_id) {
    streams[guild_id] = {}
    streams[guild_id].player = voice.createAudioPlayer()
    streams[guild_id].resource = null
    streams[guild_id].stream = null
    streams[guild_id].playing = false
    streams[guild_id].looped_url = null
    streams[guild_id].loop = false
    streams[guild_id].yt_title = undefined
    streams[guild_id].yt_url = undefined
    streams[guild_id].yt_thumbnail_url = undefined

    streams[guild_id].player.on(voice.AudioPlayerStatus.Idle, () => {
        streams[guild_id].resource = null
        streams[guild_id].stream = null
        streams[guild_id].playing = false

        if (streams[guild_id].loop) {
            playdl.video_info(streams[guild_id].looped_url).then(result => {
                playdl.stream_from_info(result, {
                    discordPlayerCompatibility: true
                }).then(r => {
                    streams[guild_id].stream = r
                    broadcast_audio(guild_id)
                })
            })
        }
    })

    const voice_connection = voice.getVoiceConnection(guild_id)
    if (!voice_connection || voice_connection?.state.status === voice.VoiceConnectionStatus.Disconnected) {
        streams[guild_id].conn?.destroy()

        streams[guild_id].conn = voice.joinVoiceChannel({
            channelId: channel_id,
            guildId: client.guilds.cache.get(guild_id).id,
            adapterCreator: client.guilds.cache.get(guild_id).voiceAdapterCreator
        }).on(voice.VoiceConnectionStatus.Disconnected, onDisconnect)
    } else {
        if (!streams[guild_id].conn) {
            streams[guild_id].conn = voice_connection
        }
    }
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

async function onDisconnect(guild_id) {
    try {
        await Promise.race([
            voice.entersState(streams[guild_id].conn, voice.VoiceConnectionStatus.Signalling, 2_000),
            voice.entersState(streams[guild_id].conn, voice.VoiceConnectionStatus.Connecting, 2_000),
        ])
    } catch (error) {
        streams[guild_id].conn?.disconnect()
        streams[guild_id].conn?.destroy()
        streams[guild_id].conn = null
    }
}