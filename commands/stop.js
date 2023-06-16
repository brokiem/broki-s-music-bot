import { SlashCommandBuilder } from "@discordjs/builders";
import { is_same_vc_as, make_simple_embed } from "../utils/utils.js";
import { stop_audio, any_audio_playing } from "../utils/audio.js";

export const data = new SlashCommandBuilder().setName("stop").setDescription("Stop current audio");

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

  stop_audio(interaction.guildId);

  await interaction.channel.send({
    embeds: [
      make_simple_embed("Audio successfully stopped!").setFooter({
        text: "by " + interaction.member.user.username + "#" + interaction.member.user.discriminator,
        iconURL: interaction.member.user.displayAvatarURL({ size: 16 }),
      }),
    ],
    allowedMentions: { repliedUser: false },
  });
}
