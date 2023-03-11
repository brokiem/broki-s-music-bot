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
  if (initial) {
    return true;
  }

  const guild = client.guilds.cache.get(guild_id);
  const bot = guild.members.cache.get(client.user.id);
  const user = guild.members.cache.get(user_id);

  if (!bot.voice.channel || !user.voice.channel) {
    return false;
  }

  return bot.voice.channel.id === user.voice.channel.id;
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
  if (!client.streams.has(guild_id)) {
    return false;
  }

  const conn = voice.getVoiceConnection(guild_id);
  conn?.disconnect();
  conn?.destroy();

  client.streams.delete(guild_id);
  console.log("Left voice channel in guild " + guild_id + "");
  return true;
}

export function clean(text) {
  if (typeof text === "string") {
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  } else {
    return text;
  }
}

export function getUptime() {
  let totalSeconds = client.uptime / 1000;
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;

  return hours + "h, " + minutes + "m and " + seconds.toFixed(0) + "s";
}

export async function is_voted(user_id) {
  return new Promise((resolve, reject) => {
    client.topgg_api
      .hasVoted(user_id)
      .then((voted) => {
        resolve(voted);
      })
      .catch(() => {
        resolve(false);
      });
  });
}

export function post_stats() {
  console.log("Posting stats...");
  client.topgg_api
    .postStats({
      serverCount: client.guilds.cache.size,
      shardCount: client.shard?.count,
    })
    .catch(() => {});
  console.log("Stats posted successfully!\n");
}
