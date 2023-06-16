import { SlashCommandBuilder } from "@discordjs/builders";
import { is_same_vc_as, make_simple_embed } from "../utils/utils.js";
import { any_audio_playing, pause_audio } from "../utils/audio.js";

export const data = new SlashCommandBuilder().setName("resume").setDescription("Resume current audio");

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

  // 0 = resumed
  // 1 = paused
  if (pause_audio(interaction.guildId) === 0) {
    await interaction.channel.send({
      embeds: [make_simple_embed("The currently playing audio has been successfully **resumed**")],
      allowedMentions: { repliedUser: false },
    });
  } else {
    await interaction.channel.send({
      embeds: [make_simple_embed("The currently playing audio has been successfully **paused**")],
      allowedMentions: { repliedUser: false },
    });
  }
}
