package main

import (
	"context"
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgolink/v2/disgolink"
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
