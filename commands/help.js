import { SlashCommandBuilder } from "@discordjs/builders";
import discord from "discord.js";
import { make_simple_embed } from "../utils/utils.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("help").setDescription("Help command");

export async function execute(interaction) {
  const loop = new discord.ButtonBuilder()
    .setStyle(discord.ButtonStyle.Link)
    .setLabel("Invite Me!")
    .setURL("https://discord.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=4331667456&scope=bot");
  const row = new discord.ActionRowBuilder().addComponents([loop]);

  await interaction.channel.send({
    components: [row],
    embeds: [make_simple_embed("Command: /play, /skip, /seek, /queue, /control, /loop, /pause, /resume, /stop, /leave, /stats")],
  });
}
