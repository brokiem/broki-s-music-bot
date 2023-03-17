import { SlashCommandBuilder } from "@discordjs/builders";
import { is_same_vc_as, make_simple_embed, leave_voice_channel } from "../utils/utils.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("leave").setDescription("Leave the voice channel");

export async function execute(interaction) {
  if (!(await is_same_vc_as(interaction.member.id, interaction.guildId))) {
    await interaction.channel.send({
      embeds: [make_simple_embed("You are not in the same voice channel!")],
    });
    return;
  }

  const voice_channel = client.guilds.cache.get(interaction.guildId).voiceStates.cache.find((vs) => vs.member.user.id === client.user.id)?.channel;

  await interaction.channel.send({
    embeds: [make_simple_embed("Leaving voice channel <#" + voice_channel.id + ">")],
  });

  leave_voice_channel(interaction.guildId);
}
