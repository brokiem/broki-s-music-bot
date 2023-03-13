"use strict";

import discord from "discord.js";
import * as fs from "fs";
import { make_simple_embed, is_same_vc_as, leave_voice_channel, clean, post_stats } from "./utils/utils.js";
import { any_audio_playing, stop_audio, pause_audio } from "./utils/audio.js";
import { inspect } from "util";
import topgg from "@top-gg/sdk";
import * as voice from "@discordjs/voice";

const token = process.env.DISCORD_TOKEN;

export const client = new discord.Client({
  intents: [
    discord.GatewayIntentBits.Guilds,
    discord.GatewayIntentBits.GuildMessages,
    discord.GatewayIntentBits.MessageContent,
    discord.GatewayIntentBits.GuildMembers,
    discord.GatewayIntentBits.GuildVoiceStates,
  ],
});

const prefix = "!";

client.streams = new discord.Collection();
client.commands = new discord.Collection();
client.topgg_api = new topgg.Api(process.env.TOPGG_TOKEN);

client.login(token).catch((e) => {
  console.error("The bot token was incorrect.\n" + e);
});

client.on("ready", async () => {
  console.log("Loading commands...");

  const command_files = fs.readdirSync("./commands").filter((file) => file.endsWith(".js"));
  for await (const file of command_files) {
    const { data, execute } = await import(`./commands/${file}`);

    client.commands.set(data.name, execute);
    //console.log("Loaded command: " + data.name);
  }
  console.log("Loaded " + client.commands.size + " commands!\n");

  post_stats();

  console.log("Bot is ready!\n");
});

client.on("voiceStateUpdate", (oldState, newState) => {
  try {
    // Check if the bot was kicked from a voice channel
    if (oldState.member.user.id === client.user.id && oldState.channel && !newState.channel) {
      // Check if the bot is in a voice channel
      if (client.streams.has(oldState.guild.id)) {
        // Stop the audio
        stop_audio(oldState.guild.id);
        client.streams.delete(oldState.guild.id);

        const conn = voice.getVoiceConnection(oldState.guild.id);
        conn?.destroy();

        console.log("Stopped audio in guild with ID " + oldState.guild.id + " because I was kicked from the voice channel.");
        return;
      }
    }

    // Leave the voice channel if the bot is the only one in it
    if (oldState.channel) {
      if (oldState.channel.members.size === 1 && oldState.channel.members.first().user.id === client.user.id) {
        const guild_stream = client.streams.get(oldState.guild.id);

        clearTimeout(guild_stream.leave_timeout_id);
        guild_stream.leave_timeout_id = setTimeout(async () => {
          const channel = await client.channels.fetch(oldState.channel.id);
          if (channel && channel.members.size === 1) {
            leave_voice_channel(oldState.guild.id);
          }
        }, 30000);
      }
    }
  } catch (e) {
    console.log("An error occurred!");
    console.error(e);
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);

      const migrated_commands = [
        "help",
        "play",
        "p",
        "skip",
        "next",
        "queue",
        "q",
        "stop",
        "s",
        "loop",
        "pause",
        "resume",
        "control",
        "c",
        "leave",
        "l",
        "stats",
      ];

      if (migrated_commands.includes(args[0].toLowerCase())) {
        await message.reply({
          embeds: [make_simple_embed("This command has been migrated to slash commands. Please use `/` to use it.")],
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      switch (args.shift().toLowerCase()) {
        case "servers":
          if (message.author.id === "548120702373593090") {
            await message.reply({
              embeds: [make_simple_embed("Servers: (" + client.guilds.cache.size + ")\n - " + [...client.guilds.cache].join("\n - "))],
              allowedMentions: { repliedUser: false },
            });
          }
          break;
        case "restart":
          if (message.author.id === "548120702373593090") {
            await message.reply({
              embeds: [make_simple_embed("Restarting...")],
              allowedMentions: { repliedUser: false },
            });
            process.exit();
          }
          break;
        case "eval":
          if (message.author.id === "548120702373593090") {
            try {
              const code = args.join(" ");
              let evaled = eval(code);

              if (typeof evaled !== "string") {
                evaled = inspect(evaled);
              }

              await message.reply({
                content: `\`\`\`${clean(evaled)}\`\`\``,
                allowedMentions: { repliedUser: false },
              });
            } catch (e) {
              await message.reply({
                content: `Error: \`\`\`xl\n${clean(e)}\n\`\`\``,
                allowedMentions: { repliedUser: false },
              });
            }
          }
          break;
      }
    }
  } catch (e) {
    await message.reply({
      content: "There was an error while executing this command!",
    });
    console.log("An error occurred!");
    console.error(e);

    if (e.toString().includes("429")) {
      process.exit();
    }
  }
});

client.on("guildCreate", async () => {
  post_stats();
});

client.on("guildDelete", async () => {
  post_stats();
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    // Check if the interaction is valid
    if (interaction.replied || interaction.deferred || !interaction.channel) {
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    const execute = client.commands.get(interaction.commandName);

    if (!execute) return;

    try {
      await execute(interaction);
    } catch (error) {
      console.error(error);

      await interaction.editReply({
        embeds: [make_simple_embed("There was an error while executing this command!")],
      });

      if (error.toString().includes("429")) {
        process.exit();
      }
    }
  }

  if (interaction.isButton()) {
    if (!(await is_same_vc_as(interaction.user.id, interaction.guildId))) {
      await interaction.reply({
        embeds: [make_simple_embed("You are not in the same voice channel!")],
        ephemeral: true,
        fetchReply: true,
      });
      return;
    }

    if (!any_audio_playing(interaction.guildId)) {
      await interaction.reply({
        embeds: [make_simple_embed("No audio is currently playing")],
        ephemeral: true,
        fetchReply: true,
      });
      return;
    }

    const guild_stream = client.streams.get(interaction.guildId);
    let inter = null;

    switch (interaction.customId) {
      case "pause":
        if (pause_audio(interaction.guildId) === 0) {
          inter = await interaction.reply({
            embeds: [
              make_simple_embed("The currently playing audio has been successfully **resumed**").setFooter({
                text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                iconURL: interaction.user.displayAvatarURL({ size: 16 }),
              }),
            ],
            fetchReply: true,
          });
        } else {
          inter = await interaction.reply({
            embeds: [
              make_simple_embed("The currently playing audio has been successfully **paused**").setFooter({
                text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                iconURL: interaction.user.displayAvatarURL({ size: 16 }),
              }),
            ],
            fetchReply: true,
          });
        }
        break;
      case "stop":
        stop_audio(interaction.guildId);
        interaction.reply({
          embeds: [
            make_simple_embed("YouTube audio successfully stopped!").setFooter({
              text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
              iconURL: interaction.user.displayAvatarURL({ size: 16 }),
            }),
          ],
          fetchReply: true,
        });
        break;
      case "loop":
        guild_stream.loop = !guild_stream.loop;
        inter = await interaction.reply({
          embeds: [
            make_simple_embed(
              guild_stream.loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio"
            ).setFooter({
              text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
              iconURL: interaction.user.displayAvatarURL({ size: 16 }),
            }),
          ],
          fetchReply: true,
        });
        break;
    }

    if (inter !== null) {
      setTimeout(function () {
        inter.delete();
      }, 10000);
    }
  }
});
