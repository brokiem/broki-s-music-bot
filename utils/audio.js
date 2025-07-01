import {client, voice as lavalink} from "./../index.js";

const trackCache = new Map();

export async function play_audio(input, guild_id, voice_channel_id, is_queue = false) {
    prepare_voice_connection(guild_id, voice_channel_id);

    const guild_stream = client.streams.get(guild_id);
    let track_data = null;
    let search_query = input;

    // Handle URL with timestamp
    if (input.startsWith("https")) {
        const url = new URL(input);
        const timeSeconds = url.searchParams.get("t");

        if (timeSeconds) {
            guild_stream.seek_time = parseInt(timeSeconds);
        }

        search_query = input;
    } else {
        search_query = `ytsearch:${input}`;
    }

    // Check cache first for performance
    if (trackCache.has(search_query)) {
        track_data = trackCache.get(search_query);
    } else {
        try {
            const res = await lavalink.load(search_query);

            if (res.loadType === 'NO_MATCHES' || res.tracks.length === 0) {
                return null;
            }

            track_data = res.tracks[0];

            // Cache the track for 5 minutes
            trackCache.set(search_query, track_data);
            setTimeout(() => trackCache.delete(search_query), 5 * 60 * 1000);

        } catch (e) {
            console.error('Failed to load track:', e);
            return null;
        }
    }

    if (!track_data) {
        return null;
    }

    // If audio is already playing and this isn't from queue, add to queue
    if (!is_queue && any_audio_playing(guild_id)) {
        const queue_item = {
            url: track_data.info.uri,
            title: track_data.info.title,
            thumbnail_url: `https://img.youtube.com/vi/${track_data.info.identifier}/maxresdefault.jpg`,
            duration: Math.floor(track_data.info.length / 1000),
            track: track_data.track
        };

        guild_stream.queue.push(queue_item);

        return createCompatibleTrackData(track_data);
    }

    // Store track info in guild_stream
    guild_stream.yt_title = track_data.info.title;
    guild_stream.yt_url = track_data.info.uri;
    guild_stream.yt_thumbnail_url = `https://img.youtube.com/vi/${track_data.info.identifier}/maxresdefault.jpg`;
    guild_stream.duration = Math.floor(track_data.info.length / 1000);
    guild_stream.looped_url = track_data.info.uri;
    guild_stream.current_track = track_data.track;

    try {
        // Play the track using Lavalink
        const player = lavalink.players.get(guild_id);
        await player.join(voice_channel_id);

        const play_options = {};
        if (guild_stream.seek_time) {
            play_options.start = guild_stream.seek_time * 1000;
            guild_stream.seek_time = null;
        }

        await player.play(track_data.track, play_options);
        guild_stream.playing = true;

        return createCompatibleTrackData(track_data);

    } catch (e) {
        console.error('Failed to play track:', e);
        return null;
    }
}

// Helper function to create compatible track data format
function createCompatibleTrackData(track_data) {
    return {
        video_details: {
            title: track_data.info.title,
            url: track_data.info.uri,
            thumbnails: [{url: `https://img.youtube.com/vi/${track_data.info.identifier}/maxresdefault.jpg`}],
            durationInSec: Math.floor(track_data.info.length / 1000)
        }
    };
}

export async function seek_audio(guild_id, timeSeconds = 0) {
    const guild_stream = client.streams.get(guild_id);
    if (!guild_stream?.current_track) {
        return null;
    }

    try {
        const player = lavalink.players.get(guild_id);
        await player.seek(timeSeconds * 1000);

        return {
            video_details: {
                title: guild_stream.yt_title,
                url: guild_stream.yt_url,
                durationInSec: Math.floor(guild_stream.duration || 0)
            }
        };
    } catch (e) {
        console.error('Failed to seek:', e);
        return null;
    }
}

export function stop_audio(guild_id) {
    const guild_stream = client.streams.get(guild_id);
    if (!guild_stream) {
        return;
    }

    // Clear queue and reset state
    guild_stream.queue = [];
    guild_stream.loop = false;
    guild_stream.looped_url = null;
    guild_stream.force_stop = true;
    guild_stream.playing = false;

    try {
        const player = lavalink.players.get(guild_id);
        player.stop();
    } catch (e) {
        console.error('Failed to stop player:', e);
    }
}

export function pause_audio(guild_id) {
    const guild_stream = client.streams.get(guild_id);
    if (!guild_stream) {
        return 1;
    }

    try {
        const player = lavalink.players.get(guild_id);

        if (!guild_stream.paused) {
            player.pause(true);
            guild_stream.paused = true;
            return 1; // Paused
        } else {
            player.pause(false);
            guild_stream.paused = false;
            return 0; // Resumed
        }
    } catch (e) {
        console.error('Failed to pause/resume player:', e);
        return 1;
    }
}

export function prepare_voice_connection(guild_id, voice_channel_id) {
    if (!client.streams.has(guild_id)) {
        const player = lavalink.players.get(guild_id);

        // Set up optimized event handlers
        player.on('event', async (data) => {
            if (data.type === 'TrackEndEvent' && data.reason !== 'REPLACED') {
                await handleTrackEnd(guild_id, voice_channel_id);
            }
        });

        player.on('error', (error) => {
            console.error('Lavalink player error:', error);
            const guild_stream = client.streams.get(guild_id);
            if (guild_stream) {
                guild_stream.playing = false;
            }
        });

        // Initialize guild stream with optimized structure
        client.streams.set(guild_id, {
            player: player,
            playing: false,
            paused: false,
            loop: false,
            yt_title: undefined,
            yt_url: undefined,
            yt_thumbnail_url: undefined,
            queue: [],
            leave_timeout_id: null,
            force_stop: false,
            current_track: null,
            seek_time: null,
            looped_url: null
        });
    }

    client.streams.get(guild_id).force_stop = false;
}

// Optimized track end handler
async function handleTrackEnd(guild_id, voice_channel_id) {
    const guild_stream = client.streams.get(guild_id);
    if (!guild_stream) return;

    guild_stream.playing = false;

    if (guild_stream.loop && guild_stream.current_track) {
        try {
            const player = lavalink.players.get(guild_id);
            await player.play(guild_stream.current_track);
            guild_stream.playing = true;
        } catch (e) {
            console.error('Failed to loop track:', e);
        }
        return;
    }

    if (!guild_stream.force_stop && guild_stream.queue.length > 0) {
        const next_item = guild_stream.queue.shift();
        try {
            if (next_item.track) {
                const player = lavalink.players.get(guild_id);
                await player.play(next_item.track);

                // Update guild stream efficiently
                Object.assign(guild_stream, {
                    yt_title: next_item.title,
                    yt_url: next_item.url,
                    yt_thumbnail_url: next_item.thumbnail_url,
                    current_track: next_item.track,
                    playing: true
                });
            } else {
                // Fallback to URL-based play
                await play_audio(next_item.url, guild_id, voice_channel_id, true);
            }
        } catch (e) {
            console.error('Failed to play next track from queue:', e);
        }
    }
}

export function any_audio_playing(guild_id) {
    const guild_stream = client.streams.get(guild_id);
    if (!guild_stream) {
        console.log(`No stream found for guild ${guild_id}`);
        return false;
    }

    return guild_stream.playing;
}


