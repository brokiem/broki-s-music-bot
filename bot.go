package main

import (
	"context"
	"fmt"
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgolink/v2/disgolink"
	"github.com/disgoorg/disgolink/v2/lavalink"
	"github.com/disgoorg/snowflake/v2"

	log "github.com/sirupsen/logrus"
)

type Bot struct {
	Client    bot.Client
	Lavalink  disgolink.Client
	Handlers  map[string]func(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error
	Queues    *QueueManager
	StartTime time.Time
}

// createBot creates a new Bot instance
func createBot() *Bot {
	return &Bot{
		StartTime: time.Now(),
		Queues: &QueueManager{
			queues: make(map[snowflake.ID]*Queue),
		},
	}
}

// onReady is called when the bot is ready
func (b *Bot) onReady(event *events.Ready) {
	log.Infof("broki's music bot is ready! (Shard #%v)", event.ShardID())
}

// onApplicationCommand is called when a slash command is executed
func (b *Bot) onApplicationCommand(event *events.ApplicationCommandInteractionCreate) {
	data := event.SlashCommandInteractionData()

	handler, ok := b.Handlers[data.CommandName()]
	if !ok {
		log.Info("unknown command: ", data.CommandName())
		return
	}
	if err := handler(event, data); err != nil {
		log.Error("error handling command: ", err)
	}
}

// onVoiceStateUpdate is called when a user joins or leaves a voice channel
func (b *Bot) onVoiceStateUpdate(event *events.GuildVoiceStateUpdate) {
	if event.VoiceState.UserID != b.Client.ApplicationID() {
		return
	}
	b.Lavalink.OnVoiceStateUpdate(context.TODO(), event.VoiceState.GuildID, event.VoiceState.ChannelID, event.VoiceState.SessionID)
	if event.VoiceState.ChannelID == nil {
		b.Queues.Delete(event.VoiceState.GuildID)
	}
}

// onVoiceServerUpdate is called when a voice server (region) update is received
func (b *Bot) onVoiceServerUpdate(event *events.VoiceServerUpdate) {
	b.Lavalink.OnVoiceServerUpdate(context.TODO(), event.GuildID, event.Token, *event.Endpoint)
}

// onComponentInteractionCreate is called when a button is clicked
func (b *Bot) onComponentInteractionCreate(event *events.ComponentInteractionCreate) {
	if event.ButtonInteractionData().CustomID() == "stop" {
		messageBuilder := b.stopTrack(*event.GuildID(), event.User())
		event.CreateMessage(messageBuilder.Build())
	}

	if event.ButtonInteractionData().CustomID() == "pause" {
		messageBuilder := b.pauseTrack(*event.GuildID(), event.User())
		event.CreateMessage(messageBuilder.Build())
	}

	if event.ButtonInteractionData().CustomID() == "loop" {
		messageBuilder := b.loopTrack(*event.GuildID(), event.User())
		event.CreateMessage(messageBuilder.Build())
	}
}

// stopTrack stops the current track and clears the queue
func (b *Bot) stopTrack(guildID snowflake.ID, user discord.User) *discord.MessageCreateBuilder {
	player := b.Lavalink.ExistingPlayer(guildID)
	if player == nil {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("No track is currently playing").Build())
	}

	voiceState, ok := b.Client.Caches().VoiceState(guildID, user.ID)
	if !ok {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("You need to be in a voice channel to use this command").Build())
	}

	if voiceState.ChannelID.String() != player.ChannelID().String() {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build())
	}

	if err := player.Update(context.Background(), lavalink.WithNullTrack()); err != nil {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed(fmt.Sprintf("Error while stopping: `%s`", err)).Build())
	}

	return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("Track successfully stopped and queue are cleared!").Build())
}

// pauseTrack pauses the current track
func (b *Bot) pauseTrack(guildID snowflake.ID, user discord.User) *discord.MessageCreateBuilder {
	player := b.Lavalink.ExistingPlayer(guildID)
	if player == nil {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("No track is currently playing").Build())
	}

	voiceState, ok := b.Client.Caches().VoiceState(guildID, user.ID)
	if !ok {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("You need to be in a voice channel to use this command").Build())
	}

	if voiceState.ChannelID.String() != player.ChannelID().String() {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build())
	}

	isPaused := !player.Paused()
	if err := player.Update(context.Background(), lavalink.WithPaused(isPaused)); err != nil {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed(fmt.Sprintf("Error while pausing: `%s`", err)).Build())
	}

	status := "playing"
	if isPaused {
		status = "paused"
	}

	return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed(fmt.Sprintf("Player is now %s", status)).Build())
}

// loopTrack loops the current track
func (b *Bot) loopTrack(guildID snowflake.ID, user discord.User) *discord.MessageCreateBuilder {
	return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("Looping feature is currently disabled!").Build())

	queue := b.Queues.Get(guildID)
	player := b.Lavalink.ExistingPlayer(guildID)
	if player == nil {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("No track is currently playing").Build())
	}

	voiceState, ok := b.Client.Caches().VoiceState(guildID, user.ID)

	if !ok {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("You need to be in a voice channel to use this command").Build())
	}

	// Check if the user is in the same voice channel as the bot
	if voiceState.ChannelID.String() != player.ChannelID().String() {
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build())
	}

	if (queue.Type == QueueTypeRepeatTrack) || (queue.Type == QueueTypeRepeatQueue) {
		queue.Type = QueueTypeNormal
		return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("Loop successfully **disabled** for current track").Build())
	}

	queue.Type = QueueTypeRepeatTrack
	return discord.NewMessageCreateBuilder().SetEmbeds(CreateSimpleEmbed("Loop successfully **enabled** for current track").Build())
}
