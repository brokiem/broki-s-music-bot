import { SlashCommandBuilder } from "@discordjs/builders";
import { is_same_vc_as, make_simple_embed, make_playing_embed, get_control_button_row } from "../utils/utils.js";
import { any_audio_playing, play_audio } from "../utils/audio.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a audio")
  .addStringOption((option) => option.setName("query").setDescription("Audio search query").setRequired(true));

export async function execute(interaction) {
  const initial = !any_audio_playing(interaction.guildId);

  if (!(await is_same_vc_as(interaction.member.id, interaction.guildId, initial))) {
    await interaction.editReply({
      embeds: [make_simple_embed("You are not in the same voice channel!")],
    });
    return;
  }

  if (client.streams[interaction.guildId]?.queue?.length >= 5) {
    await interaction.editReply({
      embeds: [make_simple_embed("Queue is full (max 5)!")],
    });
    return;
  }

  const query = interaction.options.getString("query");

  const yt_data = await play_audio(query, interaction.guildId, interaction.member.voice.channelId);

  if (yt_data === null) {
    await interaction.editReply({
      embeds: [make_simple_embed("No results found!")],
    });
    return;
  }

  if (client.streams[interaction.guildId].queue.length >= 1) {
    await interaction.editReply({
      embeds: [await make_playing_embed(interaction.guildId, interaction.member, yt_data).setTitle("Added to queue").setColor("#44DDBF")],
      allowedMentions: { repliedUser: false },
    });
  } else {
    await interaction.editReply({
      embeds: [await make_playing_embed(interaction.guildId, interaction.member, yt_data)],
      components: [get_control_button_row()],
      allowedMentions: { repliedUser: false },
    });
  }
}
