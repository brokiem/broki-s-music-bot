package main

import (
	"math/rand"

	"github.com/disgoorg/disgolink/v2/lavalink"
	"github.com/disgoorg/snowflake/v2"
)

type QueueType string

const (
	QueueTypeNormal      QueueType = "normal"
	QueueTypeRepeatTrack QueueType = "repeat_track"
	QueueTypeRepeatQueue QueueType = "repeat_queue"
)

func (q QueueType) String() string {
	switch q {
	case QueueTypeNormal:
		return "Normal"
	case QueueTypeRepeatTrack:
		return "Repeat Track"
	case QueueTypeRepeatQueue:
		return "Repeat Queue"
	default:
		return "unknown"
	}
}

type Queue struct {
	Tracks []lavalink.Track
	Type   QueueType
}

func (q *Queue) Shuffle() {
	indices := rand.Perm(len(q.Tracks))
	for i, newIndex := range indices {
		q.Tracks[i], q.Tracks[newIndex] = q.Tracks[newIndex], q.Tracks[i]
	}
}

func (q *Queue) Add(track ...lavalink.Track) {
	q.Tracks = append(q.Tracks, track...)
}

func (q *Queue) Next() (track lavalink.Track, ok bool) {
	if len(q.Tracks) == 0 {
		return lavalink.Track{}, false
	}
	track, q.Tracks = q.Tracks[0], q.Tracks[1:]
	return track, true
}

func (q *Queue) Skip(amount int) (track lavalink.Track, ok bool) {
	if len(q.Tracks) == 0 {
		return lavalink.Track{}, false
	}
	if amount > len(q.Tracks) {
		amount = len(q.Tracks)
	}
	track, q.Tracks = q.Tracks[amount-1], q.Tracks[amount:]
	return track, true
}

func (q *Queue) Clear() {
	q.Tracks = []lavalink.Track{}
}

type QueueManager struct {
	queues map[snowflake.ID]*Queue
}

func (q *QueueManager) Get(guildID snowflake.ID) *Queue {
	queue, ok := q.queues[guildID]
	if !ok {
		queue = &Queue{
			Tracks: make([]lavalink.Track, 0),
			Type:   QueueTypeNormal,
		}
		q.queues[guildID] = queue
	}
	return queue
}

func (q *QueueManager) Delete(guildID snowflake.ID) {
	delete(q.queues, guildID)
}
