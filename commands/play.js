import { SlashCommandBuilder } from "@discordjs/builders";
import { is_same_vc_as, make_simple_embed, make_playing_embed, get_control_button_row, is_voted } from "../utils/utils.js";
import { any_audio_playing, play_audio } from "../utils/audio.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play an audio")
  .addStringOption((option) => option.setName("query").setDescription("Audio search query").setRequired(true));

export async function execute(interaction) {
  const guild = client.guilds.cache.get(interaction.guildId);
  const bot = guild.members.cache.get(client.user.id);
  const user = guild.members.cache.get(interaction.member.id);

  if (!user.voice.channel) {
    await interaction.editReply({
      embeds: [make_simple_embed("You are not in a voice channel!")],
    });
    return;
  }

  if (bot.voice.channel) {
    if (!(await is_same_vc_as(interaction.member.id, interaction.guildId))) {
      await interaction.editReply({
        embeds: [make_simple_embed("You are not in the same voice channel!")],
      });
      return;
    }
  }

  const guild_stream = client.streams.get(interaction.guildId);
  if (guild_stream?.queue?.length >= 5) {
    if (!(await is_voted(interaction.member.id))) {
      const contents = {
        embeds: [
          make_simple_embed(
            "Queue is full (max 5)! However, you can unlock more queue slots by [voting for the bot](https://top.gg/bot/961240507894353970/vote)! (You can vote every 12 hours)"
          ),
        ],
      };

      await interaction.editReply(contents);
      return;
    }

    if (guild_stream?.queue?.length >= 10) {
      const contents = {
        embeds: [make_simple_embed("Queue is full (max 10)!")],
      };

      await interaction.editReply(contents);
      return;
    }
  }

  const query = interaction.options.getString("query");

  await interaction.editReply({
    embeds: [await make_simple_embed(`<a:loading:1032708714605592596>  Searching for \`${query}\`...`)],
    allowedMentions: { repliedUser: false },
  });

  const yt_data = await play_audio(query, interaction.guildId, interaction.member.voice.channelId);

  if (yt_data === null) {
    await interaction.editReply({
      embeds: [make_simple_embed("No results found!")],
    });
    return;
  }

  if (guild_stream?.queue?.length >= 1) {
    await interaction.editReply({
      embeds: [
        await make_playing_embed(interaction.guildId, interaction.member, yt_data)
          .setTitle(`Added to queue (#${guild_stream?.queue?.length})`)
          .setColor("#44DDBF"),
      ],
      allowedMentions: { repliedUser: false },
    });
  } else {
    await interaction.editReply({
      embeds: [await make_playing_embed(interaction.guildId, interaction.member, yt_data)],
      components: [get_control_button_row()],
      allowedMentions: { repliedUser: false },
    });
  }
}
