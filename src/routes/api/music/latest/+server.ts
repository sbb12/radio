import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const GET: RequestHandler = async () => {
	try {
		const pb = await getPocketBase();
		
		// Get the latest music track
		const latestTrack = await pb
			.collection('radio_music_tracks')
			.getList(1, 1, {
				sort: '-created'
			});

		if (latestTrack.items.length === 0) {
			return json({
				track: null,
				error: 'No tracks available yet'
			});
		}

		const track = latestTrack.items[0];

		return json({
			track: {
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
			}
		});
	} catch (error) {
		console.error('Error loading latest track:', error);
		return json(
			{
				track: null,
				error: 'Failed to load track'
			},
			{ status: 500 }
		);
	}
};

