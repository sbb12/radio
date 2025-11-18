import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const pb = await getPocketBase();
		const { trackId } = await request.json();

		if (!trackId) {
			return json(
				{ error: 'Track ID is required' },
				{ status: 400 }
			);
		}

		// Get the latest room
		const latestRoom = await pb
			.collection('radio_rooms')
			.getList(1, 1, {
				sort: '-created'
			});

		if (latestRoom.items.length === 0) {
			return json(
				{ error: 'No room available' },
				{ status: 404 }
			);
		}

		const room = latestRoom.items[0];

		// Verify the track exists
		try {
			await pb.collection('radio_music_tracks').getOne(trackId);
		} catch (err) {
			return json(
				{ error: 'Track not found' },
				{ status: 404 }
			);
		}

		// Update the room to set this track as current
		await pb.collection('radio_rooms').update(room.id, {
			current_track: trackId,
			next_track: null,
			current_start: new Date().toISOString()
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error setting track:', error);
		return json(
			{ error: 'Failed to set track' },
			{ status: 500 }
		);
	}
};

