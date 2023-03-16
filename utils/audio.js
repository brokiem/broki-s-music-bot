import playdl from "play-dl";
import * as voice from "@discordjs/voice";
import { client } from "./../index.js";
import { leave_voice_channel } from "./utils.js";

export async function play_audio(input, guild_id, voice_channel_id, is_queue) {
  prepare_voice_connection(guild_id, voice_channel_id);

  const guild_stream = client.streams.get(guild_id);
  const options = {
    quality: 1,
  };
  let video_info = null;

  if (input.startsWith("https")) {
    const url = new URL(input);
    const timeSeconds = url.searchParams.get("t");

    if (timeSeconds) {
      options.seek = timeSeconds;
    }

    if (playdl.yt_validate(input) === "video") {
      video_info = await playdl.video_info(input);
    }
  }

  if (video_info === null) {
    const search_results = await playdl.search(input, { limit: 1 });

    if (search_results.length <= 0) {
      return null;
    }

    video_info = await playdl.video_info(search_results[0].url);
  }

  if (video_info === null) {
    return null;
  }

  if (options.seek && (options.seek > video_info.video_details.durationInSec || options.seek < 0)) {
    options.seek = 0;
  }

  if (!is_queue && any_audio_playing(guild_id)) {
    guild_stream.queue.push(video_info.video_details.url);
    return video_info;
  }

  guild_stream.yt_title = video_info.video_details.title;
  guild_stream.yt_url = video_info.video_details.url;
  guild_stream.yt_thumbnail_url = video_info.video_details.thumbnails[0].url;

  guild_stream.looped_url = video_info.video_details.url;

  await broadcast_audio(guild_id, await playdl.stream_from_info(video_info, options));
  return video_info;
}

export async function seek_audio(guild_id, timeSeconds = 0) {
  const video_info = await playdl.video_info(client.streams.get(guild_id).yt_url);

  if (timeSeconds > video_info.video_details.durationInSec || timeSeconds < 0) {
    return video_info;
  }

  await broadcast_audio(
    guild_id,
    await playdl.stream_from_info(video_info, {
      quality: 1,
      seek: timeSeconds,
    })
  );
  return video_info;
}

export async function broadcast_audio(guild_id, stream) {
  const guild_stream = client.streams.get(guild_id);

  guild_stream.resource = voice.createAudioResource(stream.stream, {
    inputType: stream.type,
  });

  guild_stream.player.play(guild_stream.resource);
  voice.getVoiceConnection(guild_id).subscribe(guild_stream.player);

  guild_stream.playing = true;
}

export function stop_audio(guild_id) {
  const guild_stream = client.streams.get(guild_id);
  guild_stream.queue = [];
  guild_stream.loop = false;
  guild_stream.looped_url = null;
  guild_stream.force_stop = true;
  guild_stream.player.stop(true);
}

export function pause_audio(guild_id) {
  const guild_stream = client.streams.get(guild_id);

  guild_stream.playing = !guild_stream.playing;

  if (guild_stream.playing) {
    guild_stream.player.unpause();
    return 0;
  } else {
    guild_stream.player.pause();
    return 1;
  }
}

export function prepare_voice_connection(guild_id, voice_channel_id) {
  if (!client.streams.has(guild_id)) {
    client.streams.set(guild_id, {
      player: voice.createAudioPlayer({
        behaviors: {
          noSubscriber: voice.NoSubscriberBehavior.Pause,
        },
      }),
      resource: null,
      playing: false,
      looped_url: null,
      loop: false,
      yt_title: undefined,
      yt_url: undefined,
      yt_thumbnail_url: undefined,
      queue: [],
      leave_timeout_id: null,
    });

    const guild_stream = client.streams.get(guild_id);

    guild_stream.player.on(voice.AudioPlayerStatus.Idle, async () => {
      console.log("Player for guild " + guild_id + " is idling.");
      guild_stream.resource = null;
      guild_stream.playing = false;

      if (guild_stream.loop) {
        const result = await playdl.video_info(guild_stream.looped_url);
        await broadcast_audio(guild_id, await playdl.stream_from_info(result, {}));
        return;
      }

      if (!guild_stream.force_stop && guild_stream.queue.length >= 1) {
        const url = guild_stream.queue.shift();
        await play_audio(url, guild_id, voice_channel_id, true);
      }
    });
  }

  client.streams.get(guild_id).force_stop = false;

  const voice_connection = voice.getVoiceConnection(guild_id);
  if (!voice_connection || voice_connection?.state.status === voice.VoiceConnectionStatus.Disconnected) {
    const new_voice_connection = voice.joinVoiceChannel({
      channelId: voice_channel_id,
      guildId: guild_id,
      adapterCreator: client.guilds.cache.get(guild_id).voiceAdapterCreator,
    });

    new_voice_connection.on(voice.VoiceConnectionStatus.Disconnected, on_disconnect);
  }
}

export function any_audio_playing(guild_id) {
  const guild_stream = client.streams.get(guild_id);

  if (guild_stream === undefined) {
    return false;
  }
  return guild_stream.resource === null ? false : true;
}

export async function on_disconnect(guild_id) {
  try {
    const conn = voice.getVoiceConnection(guild_id);
    await Promise.race([
      voice.entersState(conn, voice.VoiceConnectionStatus.Signalling, 2_000),
      voice.entersState(conn, voice.VoiceConnectionStatus.Connecting, 2_000),
    ]);
  } catch (error) {
    leave_voice_channel(guild_id);
  }
}
