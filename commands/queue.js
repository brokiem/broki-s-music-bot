import { SlashCommandBuilder } from '@discordjs/builders';
import {make_simple_embed, convert_seconds_to_minutes} from "../utils/utils.js";
import {client} from "../index.js";
import playdl from "play-dl";

export const data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show queue');

export async function execute(interaction) {
    if (client.streams[interaction.guildId] === undefined) {
        await interaction.editReply({embeds: [make_simple_embed("No queue, start playing audio with /play")]})
        return
    }

    const queue = client.streams[interaction.guildId].queue;

    if (queue.length <= 0) {
        await interaction.editReply({embeds: [make_simple_embed("No queue, start playing audio with /play")]})
        return
    }

    let q = ""

    const promises = [];
    for (const url of client.streams[interaction.guildId].queue) {
        promises.push(playdl.video_info(url))
    }

    const results = await Promise.all(promises)
    for (const result of results) {
        q = q + "- [" + result.video_details.title + "](" + result.video_details.url + ") (" + convert_seconds_to_minutes(result.video_details.durationInSec) + ")\n"
    }

    await interaction.editReply({
        embeds: [make_simple_embed(q).setTitle("Queue (" + queue.length + ")").setFooter({
            text: "by " + interaction.member.user.username + "#" + interaction.member.user.discriminator,
            iconURL: interaction.member.user.displayAvatarURL({size: 16})
        })]
    })
}
