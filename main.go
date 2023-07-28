package main

import (
	"context"
	"encoding/json"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/disgoorg/disgo"
	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/gateway"
	"github.com/disgoorg/disgo/sharding"
	"github.com/disgoorg/disgolink/v2/disgolink"

	log "github.com/sirupsen/logrus"
)

func main() {
	log.SetFormatter(&log.TextFormatter{FullTimestamp: true})
	log.Infof("Starting broki's music bot...")

	// Create a new bot instance
	b := createBot()

	token := os.Getenv("DISCORD_TOKEN")

	// Create a new discord client instance
	client, _ := disgo.New(token,
		bot.WithShardManagerConfigOpts(
			sharding.WithShardIDs(0),
			sharding.WithShardCount(1),
			sharding.WithAutoScaling(true),
			sharding.WithGatewayConfigOpts(
				gateway.WithIntents(gateway.IntentGuilds, gateway.IntentGuildVoiceStates),
				gateway.WithCompress(true),
			),
		),
		bot.WithCacheConfigOpts(
			cache.WithCaches(cache.FlagVoiceStates),
		),
		bot.WithEventListenerFunc(b.onReady),
		bot.WithEventListenerFunc(b.onApplicationCommand),
		bot.WithEventListenerFunc(b.onVoiceStateUpdate),
		bot.WithEventListenerFunc(b.onVoiceServerUpdate),
		bot.WithEventListenerFunc(b.onComponentInteractionCreate),
	)

	b.Client = client
	b.Lavalink = disgolink.New(client.ApplicationID(),
		disgolink.WithListenerFunc(b.onTrackEnd),
		disgolink.WithListenerFunc(b.onTrackException),
		disgolink.WithListenerFunc(b.onTrackStuck),
	)

	// Setup command handlers
	b.Handlers = map[string]func(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error{
		"play":    b.play,
		"pause":   b.pause,
		"resume":  b.pause,
		"control": b.nowPlaying,
		"loop":    b.loop,
		"stop":    b.stop,
		"queue":   b.queue,
		"seek":    b.seek,
		"skip":    b.skip,
		"leave":   b.disconnect,
		"stats":   b.stats,
		"help":    b.help,
		"invite":  b.invite,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client.OpenShardManager(ctx)

	defer client.Close(context.TODO())

	// Create a slice of disgolink.NodeConfig to hold the parsed data
	var nodeConfigs []disgolink.NodeConfig

	// Unmarshal the JSON string into the slice of nodeConfigs
	lavaNodesJson := os.Getenv("LAVA_NODES")
	err := json.Unmarshal([]byte(lavaNodesJson), &nodeConfigs)
	if err != nil {
		log.Error("Error parsing JSON: ", err)
		return
	}

	for _, nodeConfig := range nodeConfigs {
		b.Lavalink.AddNode(ctx, nodeConfig)
	}

	// Wait for a signal to quit
	s := make(chan os.Signal, 1)
	signal.Notify(s, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-s
}
