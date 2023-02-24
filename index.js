'use strict'

import discord from 'discord.js'
import * as fs from "fs";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import {make_simple_embed, is_same_vc_as} from "./utils/utils.js";
import {any_audio_playing, stop_audio, pause_audio} from "./utils/audio.js";

const token = process.env.DISCORD_TOKEN;

export const client = new discord.Client({
    intents: [
        discord.GatewayIntentBits.Guilds,
        discord.GatewayIntentBits.GuildMessages,
        discord.GatewayIntentBits.MessageContent,
        discord.GatewayIntentBits.GuildMembers,
        discord.GatewayIntentBits.GuildVoiceStates,
    ]
})
const rest = new REST({ version: '10' }).setToken(token);

const prefix = "!"
const commands = [];

client.streams = []
client.commands = new discord.Collection();

client.login(token).catch((e) => {
    console.error("The bot token was incorrect.\n" + e)
})

client.on("ready", async () => {
    console.log("Loading commands...")

    const command_files = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    for (const file of command_files) {
        const {data, execute} = await import(`./commands/${file}`);

        commands.push(data.toJSON());
        client.commands.set(data.name, execute);
        console.log("Loaded command: " + data.name);
    }
    console.log("Loaded " + client.commands.size + " commands!\n");

    console.log('Started refreshing application (/) commands.');
    client.guilds.cache.forEach(guild => {
        // Check if the command is not registered on the guild
        guild.commands.fetch().then(async (reg_commands) => {
            if (reg_commands.size < commands.length) {
                console.log(`The guild with ID ${guild.id} has less commands than the bot.`);
                console.log(`Registering ${commands.length} commands for guild with ID ${guild.id}...\n`)

                const reg_cmds = await rest.get(Routes.applicationGuildCommands(client.user.id, guild.id));
                for (const command of reg_cmds) {
                    // Delete all commands
                    await rest.delete(Routes.applicationGuildCommand(client.user.id, guild.id, command.id));
                }

                // Register commands
                await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {body: commands})
                console.log(`Successfully registered ${commands.length} commands for guild with ID ${guild.id}`);
            }
        });
    });
    console.log('Successfully reloaded application (/) commands.');

    console.log("\nBot is ready!\n")
})

client.on("guildCreate", async guild => {
    // Register commands
    console.log(`Registering ${commands.length} commands for guild with ID ${guild.id}...`)

    rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
        body: commands
    }).then(() => {
        console.log(`Successfully registered ${commands.length} commands for guild with ID ${guild.id}`);
    });
});

client.on("messageCreate", async message => {
    try {
        if (message.author.bot) return

        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/)

            const migrated_commands = ["help", "play", "p", "skip", "next", "queue", "q", "stop", "s", "loop", "pause", "resume", "control", "c", "leave", "l", "stats"];

            if (migrated_commands.includes(args[0].toLowerCase())) {
                await message.reply({embeds: [make_simple_embed("This command has been migrated to slash commands. Please use `/` to use it.")], allowedMentions: { repliedUser: false }})
                return
            }

            switch (args.shift().toLowerCase()) {
                case "restart":
                    if (message.author.id === "548120702373593090") {
                        await message.reply({embeds: [make_simple_embed("Restarting...")], allowedMentions: { repliedUser: false }})
                        process.exit()
                    }
                    break;
            }
        }
    } catch (e) {
        await message.reply({ content: 'There was an error while executing this command!' });
        console.log("An error occurred!")
        console.error(e)

        if (e.toString().includes("429")) {
            process.exit()
        }
    }
})

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        // Check if the interaction is valid
        if (interaction.replied || interaction.deferred || !interaction.channel) {
            return;
        }

        await interaction.deferReply({ephemeral: false});

        const execute = client.commands.get(interaction.commandName);

        if (!execute) return;

        try {
            await execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (!is_same_vc_as(interaction.user.id, interaction.guildId)) {
            await interaction.reply({
                embeds: [make_simple_embed("You are not in the same voice channel!")],
                ephemeral: true,
                fetchReply: true
            })
            return
        }

        if (!any_audio_playing(interaction.guildId)) {
            await interaction.reply({
                embeds: [make_simple_embed("No audio is currently playing")],
                ephemeral: true,
                fetchReply: true
            })
            return
        }

        let inter = null;

        switch (interaction.customId) {
            case "pause":
                if (pause_audio(interaction.guildId) === 0) {
                    inter = await interaction.reply({
                        embeds: [make_simple_embed("The currently playing audio has been successfully **resumed**").setFooter({
                            text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                            iconURL: interaction.user.displayAvatarURL({size: 16})
                        })], fetchReply: true
                    })
                } else {
                    inter = await interaction.reply({
                        embeds: [make_simple_embed("The currently playing audio has been successfully **paused**").setFooter({
                            text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                            iconURL: interaction.user.displayAvatarURL({size: 16})
                        })], fetchReply: true
                    })
                }
                break;
            case "stop":
                stop_audio(interaction.guildId)
                interaction.reply({
                    embeds: [make_simple_embed("YouTube audio successfully stopped!").setFooter({
                        text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                        iconURL: interaction.user.displayAvatarURL({size: 16})
                    })], fetchReply: true
                })
                break;
            case "loop":
                client.streams[interaction.guildId].loop = !client.streams[interaction.guildId].loop
                inter = await interaction.reply({
                    embeds: [make_simple_embed(client.streams[interaction.guildId].loop ? "Loop successfully **enabled** for current audio" : "Loop successfully **disabled** for current audio").setFooter({
                        text: "by " + interaction.user.username + "#" + interaction.user.discriminator,
                        iconURL: interaction.user.displayAvatarURL({size: 16})
                    })], fetchReply: true
                })
                break;
        }

        if (inter !== null) {
            setTimeout(function () {
                inter.delete()
            }, 10000)
        }
    }
})
