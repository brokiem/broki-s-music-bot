import { SlashCommandBuilder } from "@discordjs/builders";
import { get_control_button_row, is_same_vc_as, make_playing_embed, make_simple_embed } from "../utils/utils.js";
import { any_audio_playing, play_audio } from "../utils/audio.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("skip").setDescription("Skip to next audio");

export async function execute(interaction) {
  if (!interaction.member.roles.cache.find((role) => role.name.toLowerCase() === "dj")) {
    await interaction.channel.send({
      embeds: [make_simple_embed("You dont have permission! (You need `DJ` role to skip)")],
    });
    return;
  }

  if (!(await is_same_vc_as(interaction.member.id, interaction.guildId))) {
    await interaction.channel.send({
      embeds: [make_simple_embed("You are not in the same voice channel!")],
    });
    return;
  }

  if (!any_audio_playing(interaction.guildId)) {
    await interaction.channel.send({
      embeds: [make_simple_embed("No audio is currently playing")],
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  const guild_stream = client.streams.get(interaction.guildId);

  if (guild_stream.queue.length <= 0) {
    await interaction.channel.send({
      embeds: [make_simple_embed("No queue left, cannot skipping")],
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  let message = await interaction.channel.send({
    embeds: [await make_simple_embed(`<a:loading:1032708714605592596>  Skipping to next queue...`)],
    allowedMentions: { repliedUser: false },
  });

  const url = guild_stream.queue.shift();
  const yt_data = await play_audio(url, interaction.guildId, interaction.member.voice.channelId, true);

  await message.edit({
    embeds: [
      make_simple_embed("Audio skipped to next queue").setFooter({
        text: "by " + interaction.member.user.username + "#" + interaction.member.user.discriminator,
        iconURL: interaction.member.user.displayAvatarURL({ size: 16 }),
      }),
    ],
    allowedMentions: { repliedUser: false },
  });

  await interaction.channel.send({
    embeds: [await make_playing_embed(interaction.guildId, interaction.member, yt_data)],
    components: [get_control_button_row()],
    allowedMentions: { repliedUser: false },
  });
}
