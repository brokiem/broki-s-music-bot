import { SlashCommandBuilder } from '@discordjs/builders';
import {is_same_vc_as, make_simple_embed, leave_voice_channel} from "../utils/utils.js";
import {client} from "../index.js";

export const data = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel');

export async function execute(interaction) {
    if (!is_same_vc_as(interaction.member.id, interaction.guildId) && !interaction.guild.members.cache.get(client.user.id).voice.channel) {
        interaction.channel.send({embeds: [make_simple_embed("You are not in the same voice channel!")]})
        return
    }

    leave_voice_channel(interaction.guildId)
}
