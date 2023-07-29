package main

import (
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgolink/v2/lavalink"
)

// CreateSimpleEmbed creates an embed with description with the given text
func CreateSimpleEmbed(text string) *discord.EmbedBuilder {
	return discord.NewEmbedBuilder().SetDescription(text)
}

// CreatePlayingEmbed creates an embed with the now playing information
func CreatePlayingEmbed(title string, url string, duration lavalink.Duration, username string, userAvatar string) *discord.EmbedBuilder {
	embed := discord.NewEmbedBuilder()
	embed.SetTitle("Now Playing")
	embed.SetDescriptionf("[%s](%s) (%s:%s)", title, url, strconv.FormatInt(duration.Minutes(), 10), strconv.FormatInt(duration.SecondsPart(), 10))
	videoId, err := ExtractVideoID(url)
	if err != nil {
		embed.SetThumbnailf("https://img.youtube.com/vi/%s/0.jpg", videoId)
	}
	embed.SetFooterTextf("by %v", username)
	embed.SetFooterIcon(userAvatar)
	embed.SetColor(0x35cf7d)

	return embed
}

// ExtractVideoID extracts the video ID from a YouTube URL
func ExtractVideoID(url string) (string, error) {
	// Regular expression pattern to match YouTube video IDs
	pattern := `(?i)https?://(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})|(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})`

	// Compile the regular expression
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return "", err
	}

	// Find the video ID in the URL using the regular expression
	match := regex.FindStringSubmatch(url)
	if len(match) == 3 {
		if match[1] != "" {
			return match[1], nil
		}
		return match[2], nil
	}

	return "", fmt.Errorf("no youtube video id found in the url")
}

// FormatPosition formats a position into a string
func FormatPosition(position lavalink.Duration) string {
	if position == 0 {
		return "0:00"
	}
	return fmt.Sprintf("%d:%02d", position.Minutes(), position.SecondsPart())
}

func GetUptime(startTime time.Time) string {
	uptime := time.Since(startTime)

	hours := int(uptime.Hours())
	uptime -= time.Duration(hours) * time.Hour

	minutes := int(uptime.Minutes())
	uptime -= time.Duration(minutes) * time.Minute

	seconds := int(uptime.Seconds())

	return fmt.Sprintf("%dh, %dm and %ds", hours, minutes, seconds)
}

func GetControlButtonsMessageBuilder() *discord.MessageCreateBuilder {
	stopButton := discord.NewSecondaryButton("Stop", "stop")
	pauseButton := discord.NewSecondaryButton("Pause/Resume", "pause")
	loopButton := discord.NewSecondaryButton("Loop", "loop")
	return discord.NewMessageCreateBuilder().AddActionRow(stopButton, pauseButton, loopButton)
}

func GetUserAvatarUrl(user discord.User) *string {
	avatarURL := user.AvatarURL()

	if avatarURL == nil {
		defaultAvatarUrl := fmt.Sprintf("https://cdn.discordapp.com/embed/avatars/%d.png", ((user.ID >> 22) % 6))
		avatarURL = &defaultAvatarUrl
	}

	return avatarURL
}
