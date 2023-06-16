import { SlashCommandBuilder } from "@discordjs/builders";
import { make_simple_embed, convert_seconds_to_minutes } from "../utils/utils.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("queue").setDescription("Show queue");

export async function execute(interaction) {
  if (!client.streams.has(interaction.guildId)) {
    await interaction.channel.send({
      embeds: [make_simple_embed("No queue, start playing audio with /play")],
    });
    return;
  }

  const queue = client.streams.get(interaction.guildId).queue;

  if (queue.length <= 0) {
    await interaction.channel.send({
      embeds: [make_simple_embed("No queue, start playing audio with /play")],
    });
    return;
  }

  let q = "";
  queue.forEach(({ url, title, thumbnail_url, duration }) => {
    q += `- [${title}](${url}) (${convert_seconds_to_minutes(duration)})\n`;
  });

  await interaction.channel.send({
    embeds: [
      make_simple_embed(q)
        .setTitle("Queue (" + queue.length + ")")
        .setFooter({
          text: "by " + interaction.member.user.username + "#" + interaction.member.user.discriminator,
          iconURL: interaction.member.user.displayAvatarURL({ size: 16 }),
        }),
    ],
  });
}
