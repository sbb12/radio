import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const GET: RequestHandler = async () => {
	try {
		const pb = await getPocketBase();
		
		// Get the latest room
		const latestRoom = await pb
			.collection('radio_rooms')
			.getList(1, 1, {
				sort: '-created'
			});

		if (latestRoom.items.length === 0) {
			return json({
				room: null,
				error: 'No room available yet'
			});
		}

		const room = latestRoom.items[0];

		// Helper function to format track data
		const formatTrack = (track: any) => {
			if (!track) return null;
			return {
				id: track.id,
				track_id: track.track_id || track.id,
				title: track.title || 'Untitled',
				audio_url: track.audio_url,
				stream_audio_url: track.stream_audio_url,
				image_url: track.image_url,
				duration: track.duration,
				tags: track.tags,
				prompt: track.prompt,
				model_name: track.model_name,
				create_time: track.create_time
			};
		};

		// Get current and next tracks (either from expand or by fetching)
		let currentTrack = null;
		let nextTrack = null;

		if (room.current_track) {
			// If it's a relation field, it might be expanded or just an ID
			if (typeof room.current_track === 'string') {
				try {
					const track = await pb.collection('radio_music_tracks').getOne(room.current_track);
					currentTrack = formatTrack(track);
				} catch (err) {
					console.error('Error fetching current track:', err);
				}
			} else {
				// Already expanded
				currentTrack = formatTrack(room.current_track);
			}
		}

		if (room.next_track) {
			// If it's a relation field, it might be expanded or just an ID
			if (typeof room.next_track === 'string') {
				try {
					const track = await pb.collection('radio_music_tracks').getOne(room.next_track);
					nextTrack = formatTrack(track);
				} catch (err) {
					console.error('Error fetching next track:', err);
				}
			} else {
				// Already expanded
				nextTrack = formatTrack(room.next_track);
			}
		} else {
            nextTrack = null;
            // if there is no next track, we need to generate one
            fetch('/api/room/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: room.prompt
                })
            });            
        }

		return json({
			room: {
				id: room.id,
				current_track: currentTrack,
				current_start: room.current_start || null,
				next_track: nextTrack,
				prompt: room.prompt || null,
				active_request: room.active_request || false,
				created: room.created,
				updated: room.updated
			}
		});
	} catch (error) {
		console.error('Error loading room:', error);
		return json(
			{
				room: null,
				error: 'Failed to load room'
			},
			{ status: 500 }
		);
	}
};

