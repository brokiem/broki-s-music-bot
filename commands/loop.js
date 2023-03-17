import { SlashCommandBuilder } from "@discordjs/builders";
import { is_same_vc_as, make_simple_embed } from "../utils/utils.js";
import { any_audio_playing } from "../utils/audio.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("loop").setDescription("Loop current audio");

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

  const guild_stream = client.streams.get(interaction.guildId);
  guild_stream.loop = !guild_stream.loop;
  await interaction.channel.send({
    embeds: [
      make_simple_embed(guild_stream.loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio"),
    ],
    allowedMentions: { repliedUser: false },
  });
}
