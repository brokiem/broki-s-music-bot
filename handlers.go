package main

import (
	"context"
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"

	"github.com/disgoorg/disgolink/v2/disgolink"
	"github.com/disgoorg/disgolink/v2/lavalink"

	log "github.com/sirupsen/logrus"
)

// This is the handler for the /play command
func (b *Bot) play(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	identifier := lavalink.SearchTypeYoutube.Apply(data.String("query"))
	username := event.User().Username
	userAvatar := *GetUserAvatarUrl(event.User())

	queue := b.Queues.Get(*event.GuildID())
	voiceState, ok := b.Client.Caches().VoiceState(*event.GuildID(), event.User().ID)

	if !ok {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in a voice channel to use this command").Build()},
		})
	}

	player := b.Lavalink.ExistingPlayer(*event.GuildID())
	if player != nil && player.Track() != nil && !b.IsSameVoiceChannel(*event.GuildID(), &voiceState) {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build()},
		})
	}

	log.Debugf("User %s used /play with query %s\n", event.User().Username, data.String("query"))

	event.CreateMessage(discord.MessageCreate{
		Content: "...",
	})

	// If the player is paused, resume it to start playing the track
	if b.Lavalink.Player(*event.GuildID()).Paused() {
		b.pauseTrack(*event.GuildID(), event.User())
		event.Client().Rest().CreateMessage(event.Channel().ID(), discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("Resuming track").Build()},
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var toPlay *lavalink.Track
	b.Lavalink.BestNode().LoadTracksHandler(ctx, identifier, disgolink.NewResultHandler(
		func(track lavalink.Track) {
			if player := b.Lavalink.ExistingPlayer(*event.GuildID()); player != nil && player.Track() != nil {
				queue.Add(track)
				event.Client().Rest().CreateMessage(event.Channel().ID(), discord.MessageCreate{
					Embeds: []discord.Embed{CreatePlayingEmbed(track.Info.Title, *track.Info.URI, track.Info.Length, username, userAvatar).SetTitle("Added to queue").SetColor(0x44DDBF).Build()},
				})
				return
			}

			event.Client().Rest().CreateMessage(event.Channel().ID(), GetControlButtonsMessageBuilder().AddEmbeds(CreatePlayingEmbed(track.Info.Title, *track.Info.URI, track.Info.Length, username, userAvatar).Build()).Build())
			toPlay = &track
		},
		func(playlist lavalink.Playlist) {
			event.Client().Rest().CreateMessage(event.Channel().ID(), discord.MessageCreate{
				Embeds: []discord.Embed{CreateSimpleEmbed("Playlists are not supported yet").Build()},
			})
		},
		func(tracks []lavalink.Track) {
			track := tracks[0]

			if player := b.Lavalink.ExistingPlayer(*event.GuildID()); player != nil && player.Track() != nil {
				queue.Add(track)
				event.Client().Rest().CreateMessage(event.Channel().ID(), discord.MessageCreate{
					Embeds: []discord.Embed{CreatePlayingEmbed(track.Info.Title, *track.Info.URI, track.Info.Length, username, userAvatar).SetTitle("Added to queue").SetColor(0x44DDBF).Build()},
				})
				return
			}

			event.Client().Rest().CreateMessage(event.Channel().ID(), GetControlButtonsMessageBuilder().AddEmbeds(CreatePlayingEmbed(track.Info.Title, *track.Info.URI, track.Info.Length, username, userAvatar).Build()).Build())
			toPlay = &track
		},
		func() {
			event.Client().Rest().CreateMessage(event.Channel().ID(), discord.MessageCreate{
				Embeds: []discord.Embed{CreateSimpleEmbed("No results found").Build()},
			})
		},
		func(err error) {
			event.Client().Rest().CreateMessage(event.Channel().ID(), discord.MessageCreate{
				Embeds: []discord.Embed{CreateSimpleEmbed(fmt.Sprintf("Error while searching: `%s`", err)).Build()},
			})
		},
	))

	if toPlay == nil {
		return nil
	}

	if err := b.Client.UpdateVoiceState(context.TODO(), *event.GuildID(), voiceState.ChannelID, false, true); err != nil {
		return err
	}

	return b.Lavalink.Player(*event.GuildID()).Update(context.TODO(), lavalink.WithTrack(*toPlay))
}

// This is the handler for the /skip command
func (b *Bot) skip(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	guildID := *event.GuildID()

	player := b.Lavalink.ExistingPlayer(guildID)
	queue := b.Queues.Get(guildID)
	if player == nil || queue == nil {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("No track is currently playing").Build()},
		})
	}

	voiceState, ok := b.Client.Caches().VoiceState(guildID, event.User().ID)
	if !ok {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in a voice channel to use this command").Build()},
		})
	}

	if !b.IsSameVoiceChannel(guildID, &voiceState) {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build()},
		})
	}

	// TODO: check if the user has DJ role

	track, ok := queue.Next()
	if !ok {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("No more tracks in queue").Build()},
		})
	}

	if err := player.Update(context.Background(), lavalink.WithTrack(track)); err != nil {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed(fmt.Sprintf("Error while skipping: `%s`", err)).Build()},
		})
	}

	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{CreatePlayingEmbed(track.Info.Title, *track.Info.URI, track.Info.Length, event.User().Username, *GetUserAvatarUrl(event.User())).Build()},
	})
}

// This is the handler for the /seek command
func (b *Bot) seek(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{CreateSimpleEmbed("Seeking feature is currently disabled!").Build()},
	})

	player := b.Lavalink.ExistingPlayer(*event.GuildID())
	if player == nil {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("No track is currently playing").Build()},
		})
	}

	voiceState, ok := b.Client.Caches().VoiceState(*event.GuildID(), event.User().ID)
	if !ok {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in a voice channel to use this command").Build()},
		})
	}

	if !b.IsSameVoiceChannel(*event.GuildID(), &voiceState) {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build()},
		})
	}

	seconds := data.Int("time")
	finalPosition := lavalink.Duration(seconds / 1000)
	if err := player.Update(context.TODO(), lavalink.WithPosition(finalPosition)); err != nil {
		return event.CreateMessage(discord.MessageCreate{
			Content: fmt.Sprintf("Error while seeking: `%s`", err),
		})
	}

	return event.CreateMessage(discord.MessageCreate{
		Content: fmt.Sprintf("Seeked to `%s`", FormatPosition(finalPosition)),
	})
}

// This is the handler for the /queue command
func (b *Bot) queue(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	queue := b.Queues.Get(*event.GuildID())
	if queue == nil || len(queue.Tracks) == 0 {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("Queue is empty").Build()},
		})
	}

	var tracks strings.Builder
	for i, track := range queue.Tracks {
		tracks.WriteString(fmt.Sprintf("%d. [`%s`](<%s>) (%s:%s)\n", i+1, track.Info.Title, *track.Info.URI, strconv.FormatInt(track.Info.Length.Minutes(), 10), strconv.FormatInt(track.Info.Length.SecondsPart(), 10)))
	}

	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{CreateSimpleEmbed(tracks.String()).SetTitlef("Queue (%d)", len(queue.Tracks)).Build()},
	})
}

// This is the handler for the /pause command
func (b *Bot) pause(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	guildID := *event.GuildID()
	messageBuilder := b.pauseTrack(guildID, event.User())
	return event.CreateMessage(messageBuilder.Build())
}

// This is the handler for the /loop command
func (b *Bot) loop(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	guildID := *event.GuildID()
	messageBuilder := b.loopTrack(guildID, event.User())
	return event.CreateMessage(messageBuilder.Build())
}

// This is the handler for the /stop command
func (b *Bot) stop(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	guildID := *event.GuildID()
	messageBuilder := b.stopTrack(guildID, event.User())
	return event.CreateMessage(messageBuilder.Build())
}

// This is the handler for the /leave command
func (b *Bot) disconnect(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	guildID := *event.GuildID()

	player := b.Lavalink.ExistingPlayer(guildID)
	if player == nil {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("No track is currently playing").Build()},
		})
	}

	voiceState, ok := b.Client.Caches().VoiceState(guildID, event.User().ID)
	if !ok {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in a voice channel to use this command").Build()},
		})
	}

	if !b.IsSameVoiceChannel(guildID, &voiceState) {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("You need to be in the same voice channel as the bot to use this command").Build()},
		})
	}

	if err := b.Client.UpdateVoiceState(context.Background(), guildID, nil, false, false); err != nil {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed(fmt.Sprintf("Error while disconnecting: `%s`", err)).Build()},
		})
	}

	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{CreateSimpleEmbed("Disconnected from the voice channel").Build()},
	})
}

// This is the handler for the /control command
func (b *Bot) nowPlaying(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	guildID := *event.GuildID()

	player := b.Lavalink.ExistingPlayer(guildID)
	if player == nil || player.Track() == nil {
		return event.CreateMessage(discord.MessageCreate{
			Embeds: []discord.Embed{CreateSimpleEmbed("No track is currently playing").Build()},
		})
	}

	track := player.Track()
	return event.CreateMessage(GetControlButtonsMessageBuilder().AddEmbeds(CreatePlayingEmbed(track.Info.Title, *track.Info.URI, track.Info.Length, event.User().Username, *GetUserAvatarUrl(event.User())).Build()).Build())
}

// This is the handler for the /stats command
func (b *Bot) stats(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Calculate RAM usage in MB using the total allocated memory (Alloc) and converting to MB.
	allocMB := memStats.Alloc >> 20

	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{
			CreateSimpleEmbed(fmt.Sprintf(
				"• Uptime: %s\n• RAM Usage: %d MB",
				GetUptime(b.StartTime),
				allocMB,
			)).Build(),
		},
	})
}

func (b *Bot) help(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{
			CreateSimpleEmbed(
				"- /play: Play an audio\n" +
					"- /skip: Skip the currently playing audio\n" +
					"- /seek: Seek to a specific duration in the audio\n" +
					"- /queue: Display the current audio queue\n" +
					"- /control: Show the control of the currently playing audio\n" +
					"- /loop: Enable or disable audio looping\n" +
					"- /pause: Pause the currently playing audio\n" +
					"- /resume: Resume the paused audio\n" +
					"- /stop: Stop playing and clear the queue\n" +
					"- /leave: Make the bot leave the voice channel\n" +
					"- /stats: Show bot statistics",
			).SetTitle("Commands").Build(),
		},
	})
}

func (b *Bot) invite(event *events.ApplicationCommandInteractionCreate, data discord.SlashCommandInteractionData) error {
	return event.CreateMessage(discord.MessageCreate{
		Embeds: []discord.Embed{
			CreateSimpleEmbed("You can invite the bot to your server by clicking the `Add to Server` button in the bot profile!").Build(),
		},
	})
}
