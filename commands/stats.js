import { SlashCommandBuilder } from '@discordjs/builders';
import {make_simple_embed} from "../utils/utils.js";
import os from "os";
import {client} from "../index.js";
import discord from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop current audio');

export async function execute(interaction) {
    const loop = new discord.ButtonBuilder().setStyle(discord.ButtonStyle.Link).setLabel("Invite Me!").setURL("https://discord.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=2184547392&scope=bot")
    const row = new discord.ActionRowBuilder().addComponents([loop])

    await interaction.editReply({
        components: [row],
        embeds: [make_simple_embed("" +
            "**❯  broki's music bot** - v2.0.0" +
            "\n\n" +
            "• CPU Usage: " + os.loadavg().toString().split(",")[0] + "%\n" +
            "• RAM Usage: " + (Math.round(process.memoryUsage().rss / 10485.76) / 100) + " MB\n" +
            "\n" +
            "• Latency: " + client.ws.ping + "ms\n" +
            "• Guilds: " + client.guilds.cache.size + "\n" +
            "\n" +
            "• Developer: [brokiem](https://github.com/brokiem)\n" +
            "• Library: discord.js\n" +
            "• Github: [broki's music bot](https://github.com/brokiem/broki-s-music-bot)"
        )],
        allowedMentions: {repliedUser: false}
    })
}
