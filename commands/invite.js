import { SlashCommandBuilder } from "@discordjs/builders";
import { make_simple_embed } from "../utils/utils.js";
import { client } from "../index.js";
import discord from "discord.js";

export const data = new SlashCommandBuilder().setName("invite").setDescription("Invite command");

export async function execute(interaction) {
  const loop = new discord.ButtonBuilder()
    .setStyle(discord.ButtonStyle.Link)
    .setLabel("Invite Link")
    .setURL("https://discord.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=4331670528&scope=bot");
  const row = new discord.ActionRowBuilder().addComponents([loop]);

  await interaction.channel.send({
    components: [row],
    embeds: [make_simple_embed("Add me to your server!")],
    allowedMentions: { repliedUser: false },
  });
}
