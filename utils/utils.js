import { client } from "../index.js";
import discord from "discord.js";
import * as voice from "@discordjs/voice";

export function convert_seconds_to_minutes(value) {
  const hrs = ~~(value / 3600);
  const mins = ~~((value % 3600) / 60);
  const secs = ~~value % 60;

  let ret = "";
  if (hrs > 0) {
    ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
  }

  ret += "" + String(mins).padStart(2, "0") + ":" + (secs < 10 ? "0" : "");
  ret += "" + secs;
  return ret;
}

export async function is_same_vc_as(user_id, guild_id, initial = false) {
  const guild = client.guilds.cache.get(guild_id);
  const user = await guild.members.fetch(user_id);
  const bot = await guild.members.fetch(client.user.id);

  if (initial) {
    return true;
  }

  if (!user.voice.channel || !bot.voice.channel) {
    return false;
  }

  return user.voice.channel && bot.voice.channel && user.voice.channel.id === bot.voice.channel.id;
}

export function make_simple_embed(string) {
  return new discord.EmbedBuilder().setDescription(string);
}

export function make_playing_embed(guild_id, member, yt_data, title = null, url = null, thumbnail_url = null, isControl = false) {
  if (yt_data !== null) {
    title = yt_data.video_details.title;
    url = yt_data.video_details.url;
    thumbnail_url = yt_data.video_details.thumbnails[0].url;
  }

  return new discord.EmbedBuilder()
    .setColor("#35cf7d")
    .setTitle(isControl ? "Now Playing" : "Playing YouTube")
    .setDescription("[" + title + "](" + url + ")")
    .setThumbnail(thumbnail_url)
    .setFooter({
      text: "by " + member.user.username + "#" + member.user.discriminator,
      iconURL: member.user.displayAvatarURL({ size: 16 }),
    });
}

export function get_control_button_row() {
  const play = new discord.ButtonBuilder().setStyle(discord.ButtonStyle.Secondary).setCustomId("stop").setLabel("Stop");
  const pause = new discord.ButtonBuilder().setStyle(discord.ButtonStyle.Secondary).setCustomId("pause").setLabel("Pause/Resume");
  const loop = new discord.ButtonBuilder().setStyle(discord.ButtonStyle.Secondary).setCustomId("loop").setLabel("Loop");
  return new discord.ActionRowBuilder().addComponents([play, pause, loop]);
}

export function leave_voice_channel(guild_id) {
  if (client.streams[guild_id] === undefined) {
    return false;
  }

  const conn = voice.getVoiceConnection(guild_id);
  conn?.disconnect();
  conn?.destroy();

  delete client.streams[guild_id];
  console.log("Left voice channel in guild " + guild_id + "");
  return true;
}

export function clean(text) {
  if (typeof (text) === "string") {
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203))
  } else {
    return text
  }
}
