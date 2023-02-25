import { SlashCommandBuilder } from '@discordjs/builders';
import {convert_seconds_to_minutes, is_same_vc_as, make_simple_embed} from "../utils/utils.js";
import {any_audio_playing, seek_audio} from "../utils/audio.js";

export const data = new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek current audio')
    .addNumberOption(option =>
        option
            .setName('time')
            .setDescription('Time to seek to (in seconds)')
            .setRequired(true)
    );

export async function execute(interaction) {
    if (!is_same_vc_as(interaction.member.id, interaction.guildId)) {
        await interaction.editReply({embeds: [make_simple_embed("You are not in the same voice channel!")]})
        return
    }

    if (!any_audio_playing(interaction.guildId)) {
        await interaction.editReply({embeds: [make_simple_embed("No audio is currently playing")]})
        return
    }

    const seekTime = interaction.options.getNumber('time');

    await seek_audio(interaction.guildId, seekTime)

    await interaction.editReply({
        embeds: [make_simple_embed(`Audio successfully seeked to ${convert_seconds_to_minutes(seekTime)}!`).setFooter({
            text: "by " + interaction.member.user.username + "#" + interaction.member.user.discriminator,
            iconURL: interaction.member.user.displayAvatarURL({size: 16})
        })],
        allowedMentions: {repliedUser: false}
    })
}
