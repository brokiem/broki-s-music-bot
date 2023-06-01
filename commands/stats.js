import { SlashCommandBuilder } from "@discordjs/builders";
import { getUptime, make_simple_embed } from "../utils/utils.js";
import os from "os";
import { client } from "../index.js";
import discord from "discord.js";

export const data = new SlashCommandBuilder().setName("stats").setDescription("Stats command");

export async function execute(interaction) {
  const loop = new discord.ButtonBuilder()
    .setStyle(discord.ButtonStyle.Link)
    .setLabel("Invite Me!")
    .setURL("https://discord.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=4331670528&scope=bot");
  const row = new discord.ActionRowBuilder().addComponents([loop]);

  await interaction.editReply({
    components: [row],
    embeds: [
      make_simple_embed(
        "" +
          "**❯  broki's music bot**" +
          "\n\n" +
          "• Uptime: " +
          getUptime() +
          "\n" +
          "\n" +
          "• RAM Usage: " +
          Math.round(process.memoryUsage().rss / 10485.76) / 100 +
          " MB\n" +
          "• Latency: " +
          client.ws.ping +
          "ms\n" +
          "• Guilds: " +
          client.guilds.cache.size
      ),
    ],
    allowedMentions: { repliedUser: false },
  });
}
