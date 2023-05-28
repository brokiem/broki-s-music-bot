import { SlashCommandBuilder } from "@discordjs/builders";
import discord from "discord.js";
import { make_simple_embed } from "../utils/utils.js";
import { client } from "../index.js";

export const data = new SlashCommandBuilder().setName("help").setDescription("Help command");

export async function execute(interaction) {
  const loop = new discord.ButtonBuilder()
    .setStyle(discord.ButtonStyle.Link)
    .setLabel("Invite Me!")
    .setURL("https://discord.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=4331667456&scope=bot");
  const row = new discord.ActionRowBuilder().addComponents([loop]);

  await interaction.editReply({
    components: [row],
    embeds: [
      make_simple_embed(
        "- /play: Play a audio\n- /skip: Skip the currently playing audio\n- /seek: Seek to a specific duration in the audio\n- /queue: Display the current audio queue\n- /control: Show the control of the currently playing audio\n- /loop: Enable or disable audio looping\n- /pause: Pause the currently playing audio\n- /resume: Resume the paused audio\n- /stop: Stop playing and clear the queue\n- /leave: Make the bot leave the voice channel\n- /stats: Show bot statistics"
      ).setTitle("Commands"),
    ],
  });
}
