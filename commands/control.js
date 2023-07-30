import { SlashCommandBuilder } from "@discordjs/builders";
import {
  is_same_vc_as,
  make_simple_embed,
  make_playing_embed,
  get_control_button_row,
  create_yt_data_from_playdl_data
} from "../utils/utils.js";
import { any_audio_playing } from "../utils/audio.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("control").setDescription("Control current audio");

export async function execute(interaction) {
  if (!(await is_same_vc_as(interaction.member.id, interaction.guildId))) {
    await interaction.channel.send({
      embeds: [make_simple_embed("You are not in the same voice channel!")],
    });
    return;
  }

  if (!any_audio_playing(interaction.guildId)) {
    await interaction.channel.send({
      embeds: [make_simple_embed("No audio is currently playing")],
    });
    return;
  }

  const stream_data = client.streams.get(interaction.guildId);
  const yt_data = {
    title: stream_data.yt_title,
    url: stream_data.yt_url,
    thumbnail_url: stream_data.yt_thumbnail_url,
    duration: 0
  }
  await interaction.channel.send({
    embeds: [
      make_playing_embed(interaction.guildId, interaction.member, yt_data),
    ],
    components: [get_control_button_row(stream_data.yt_url)],
    allowedMentions: { repliedUser: false },
  });
}
