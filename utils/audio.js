import playdl from "play-dl";
import * as voice from "@discordjs/voice";
import { client } from "./../index.js";
import { leave_voice_channel } from "./utils.js";

export async function play_audio(input, guild_id, voice_channel_id, is_queue) {
  prepare_voice_connection(guild_id, voice_channel_id);

  const options = {};
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

  if (!is_queue && any_audio_playing(guild_id)) {
    client.streams[guild_id].queue.push(input);
    return video_info;
  }

  client.streams[guild_id].yt_title = video_info.video_details.title;
  client.streams[guild_id].yt_url = video_info.video_details.url;
  client.streams[guild_id].yt_thumbnail_url = video_info.video_details.thumbnails[0].url;

  client.streams[guild_id].looped_url = video_info.video_details.url;

  await broadcast_audio(guild_id, await playdl.stream_from_info(video_info, options));
}

export async function seek_audio(guild_id, timeSeconds) {
  const stream = await playdl.stream(client.streams[guild_id].yt_url, {
    seek: timeSeconds,
  });

  await broadcast_audio(guild_id, stream);
}

export async function broadcast_audio(guild_id, stream) {
  client.streams[guild_id].resource = voice.createAudioResource(stream.stream, {
    inputType: stream.type,
  });
  client.streams[guild_id].resource.playStream.on('error', error => {
    console.error(error);
  });

  client.streams[guild_id].player.play(client.streams[guild_id].resource);
  voice.getVoiceConnection(guild_id).subscribe(client.streams[guild_id].player);

  client.streams[guild_id].playing = true;
}

export function stop_audio(guild_id) {
  client.streams[guild_id].queue = [];
  client.streams[guild_id].loop = false;
  client.streams[guild_id].looped_url = null;
  client.streams[guild_id].force_stop = true;
  client.streams[guild_id].player.stop(true);
}

export function pause_audio(guild_id) {
  client.streams[guild_id].playing = !client.streams[guild_id].playing;

  if (client.streams[guild_id].playing) {
    client.streams[guild_id].player.unpause();
    return 0;
  } else {
    client.streams[guild_id].player.pause();
    return 1;
  }
}

export function prepare_voice_connection(guild_id, voice_channel_id) {
  if (client.streams[guild_id] === undefined) {
    client.streams[guild_id] = {};
    client.streams[guild_id].player = voice.createAudioPlayer({
      behaviors: {
        noSubscriber: voice.NoSubscriberBehavior.Pause,
      }
    });
    client.streams[guild_id].player.on("error", (error) => {
      console.error(error);
    });
    client.streams[guild_id].resource = null;
    client.streams[guild_id].playing = false;
    client.streams[guild_id].looped_url = null;
    client.streams[guild_id].loop = false;
    client.streams[guild_id].yt_title = undefined;
    client.streams[guild_id].yt_url = undefined;
    client.streams[guild_id].yt_thumbnail_url = undefined;
    client.streams[guild_id].queue = [];

    client.streams[guild_id].player.on(voice.AudioPlayerStatus.Idle, async () => {
      console.log("Player for guild " + guild_id + " is idling.")
      client.streams[guild_id].resource = null;
      client.streams[guild_id].playing = false;

      if (client.streams[guild_id].loop) {
        const result = await playdl.video_info(client.streams[guild_id].looped_url);
        await broadcast_audio(guild_id, await playdl.stream_from_info(result, {}));
        return;
      }

      if (!client.streams[guild_id].force_stop && client.streams[guild_id].queue.length >= 1) {
        const url = client.streams[guild_id].queue.shift();
        await play_audio(url, guild_id, voice_channel_id, true);
      }
    });
  }

  client.streams[guild_id].force_stop = false;

  const voice_connection = voice.getVoiceConnection(guild_id);
  if (!voice_connection || voice_connection?.state.status === voice.VoiceConnectionStatus.Disconnected) {
    const new_voice_connection = voice.joinVoiceChannel({
      channelId: voice_channel_id,
      guildId: guild_id,
      adapterCreator: client.guilds.cache.get(guild_id).voiceAdapterCreator,
    })

    new_voice_connection.on(voice.VoiceConnectionStatus.Disconnected, on_disconnect);
    new_voice_connection.on('stateChange', (oldState, newState) => {
      Reflect.get(oldState, 'networking')?.off('stateChange', networkStateChangeHandler);
      Reflect.get(newState, 'networking')?.on('stateChange', networkStateChangeHandler);
    });
  }
}

const networkStateChangeHandler = (_, newNetworkState) => {
  const newUdp = Reflect.get(newNetworkState, 'udp');
  clearInterval(newUdp?.keepAliveInterval);
};

export function any_audio_playing(guild_id) {
  if (client.streams[guild_id] === undefined) {
    return false;
  }
  return client.streams[guild_id].resource === null ? false : true;
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
