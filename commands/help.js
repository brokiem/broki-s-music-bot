import { SlashCommandBuilder } from '@discordjs/builders';
import discord from "discord.js";
import {make_simple_embed} from "../utils/utils.js";

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Help command');

export async function execute(interaction) {
    const loop = new discord.ButtonBuilder().setStyle(discord.ButtonStyle.Link).setLabel("Invite Me!").setURL("https://discord.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=2184547392&scope=bot")
    const row = new discord.ActionRowBuilder().addComponents([loop])

    await interaction.editReply({
        components: [row],
        embeds: [make_simple_embed("Command: !play, !skip, !queue, !control, !loop, !pause, !resume, !stop, !volume, !leave, !stats")]
    })
}
