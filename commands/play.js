import { SlashCommandBuilder } from "@discordjs/builders";
import {
  is_same_vc_as,
  make_simple_embed,
  make_playing_embed,
  get_control_button_row,
  is_voted,
  create_yt_data_from_playdl_data
} from "../utils/utils.js";
import { play_audio } from "../utils/audio.js";
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
    await interaction.channel.send({
      embeds: [make_simple_embed("You are not in a voice channel!")],
    });
    return;
  }

  if (bot.voice.channel) {
    if (!(await is_same_vc_as(interaction.member.id, interaction.guildId))) {
      await interaction.channel.send({
        embeds: [make_simple_embed("You are not in the same voice channel!")],
      });
      return;
    }
  }

  let message = null;
  const guild_stream = client.streams.get(interaction.guildId);
  if (guild_stream?.queue?.length >= 5) {
    const timeoutId = setTimeout(async () => {
      message = await interaction.channel.send({
        embeds: [make_simple_embed("<a:loading:1032708714605592596>  Loading...")],
      });
    }, 1500);

    if (!(await is_voted(interaction.member.id))) {
      clearTimeout(timeoutId);
      const contents = {
        embeds: [
          make_simple_embed(
            "Queue is full (max 5)! However, you can unlock more queue slots by [voting for the bot](https://top.gg/bot/961240507894353970/vote)! (You can vote every 12 hours)"
          ),
        ],
      };

      if (message) {
        await message.edit(contents);
      } else {
        await interaction.channel.send(contents);
      }
      return;
    }

    clearTimeout(timeoutId);

    if (guild_stream?.queue?.length >= 10) {
      const contents = {
        embeds: [make_simple_embed("Queue is full (max 10)!")],
      };

      if (message) {
        await message.edit(contents);
      } else {
        await interaction.channel.send(contents);
      }
      return;
    }
  }

  const query = interaction.options.getString("query");

  message = await interaction.channel.send({
    embeds: [await make_simple_embed(`<a:loading:1032708714605592596>  Searching for \`${query}\`...`)],
    allowedMentions: { repliedUser: false },
  });

  const stream_data = await play_audio(query, interaction.guildId, interaction.member.voice.channelId);

  if (stream_data === null) {
    await message.edit({
      embeds: [make_simple_embed("No results found!")],
    });
    return;
  }

  const yt_data = create_yt_data_from_playdl_data(stream_data)

  if (guild_stream?.queue?.length >= 1) {
    await message.edit({
      embeds: [
        await make_playing_embed(interaction.guildId, interaction.member, yt_data)
          .setTitle(`Added to queue (#${guild_stream?.queue?.length})`)
          .setColor(0x44DDBF),
      ],
      allowedMentions: { repliedUser: false },
    });
  } else {
    await message.edit({
      embeds: [await make_playing_embed(interaction.guildId, interaction.member, yt_data)],
      components: [get_control_button_row()],
      allowedMentions: { repliedUser: false },
    });
  }
}
