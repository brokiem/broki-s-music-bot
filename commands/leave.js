import { SlashCommandBuilder } from '@discordjs/builders';
import {is_same_vc_as, make_simple_embed, leave_voice_channel} from "../utils/utils.js";
import {client} from "../index.js";

export const data = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel');

export async function execute(interaction) {
    if (!await is_same_vc_as(interaction.member.id, interaction.guildId) && !await interaction.guild.members.fetch(client.user.id).voice.channel) {
        await interaction.editReply({embeds: [make_simple_embed("You are not in the same voice channel!")]})
        return
    }

    await interaction.editReply({embeds: [make_simple_embed("Leaving voice channel...")]})

    leave_voice_channel(interaction.guildId)
}
