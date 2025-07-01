import {SlashCommandBuilder} from "@discordjs/builders";
import {is_same_vc_as, leave_voice_channel, make_simple_embed} from "../utils/utils.js";
import {client} from "../index.js";

export const data = new SlashCommandBuilder().setName("leave").setDescription("Leave the voice channel");

export async function execute(interaction) {
  if (!(await is_same_vc_as(interaction.member.id, interaction.guildId))) {
    await interaction.editReply({
      embeds: [make_simple_embed("You are not in the same voice channel!")],
    });
    return;
  }

  const voice_channel = client.guilds.cache.get(interaction.guildId).voiceStates.cache.find((vs) => vs.member.user.id === client.user.id)?.channel;

  await interaction.editReply({
    embeds: [make_simple_embed("Leaving voice channel <#" + voice_channel.id + ">")],
  });

  await leave_voice_channel(interaction.guildId);
}
