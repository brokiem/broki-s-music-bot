import { SlashCommandBuilder } from "@discordjs/builders";
import { make_simple_embed, convert_seconds_to_minutes } from "../utils/utils.js";
import { client } from "../index.js";
import playdl from "play-dl";

export const data = new SlashCommandBuilder().setName("queue").setDescription("Show queue");

export async function execute(interaction) {
  if (!client.streams.has(interaction.guildId)) {
    await interaction.editReply({
      embeds: [make_simple_embed("No queue, start playing audio with /play")],
    });
    return;
  }

  const queue = client.streams.get(interaction.guildId).queue;

  if (queue.length <= 0) {
    await interaction.editReply({
      embeds: [make_simple_embed("No queue, start playing audio with /play")],
    });
    return;
  }

  await interaction.editReply({
    embeds: [await make_simple_embed(`<a:loading:1032708714605592596>  Fetching queue...`)],
    allowedMentions: { repliedUser: false },
  });

  const promises = [];
  for (const url of queue) {
    promises.push(playdl.video_info(url));
  }
  const results = await Promise.all(promises);

  let q = "";
  results.forEach((result) => {
    q += `- [${result.video_details.title}](${result.video_details.url}) (${convert_seconds_to_minutes(result.video_details.durationInSec)})\n`;
  });

  await interaction.editReply({
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
