import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';
import { API_KEY, BASE_URL } from '$env/static/private';

const API_URL = 'https://api.sunoapi.org/api/v1/generate';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const pb = await getPocketBase();
		
		// Get the latest room
		const latestRoom = await pb
			.collection('radio_rooms')
			.getList(1, 1, {
				sort: '-created'
			});

        console.log(latestRoom);

		if (latestRoom.items.length === 0) {
			return json(
				{ error: 'No room available' },
				{ status: 404 }
			);
		}

		const room = latestRoom.items[0];

		// Check if there's already an active request
		if (room.active_request) {
			return json(
				{ error: 'Generation already in progress' },
				{ status: 409 }
			);
		}

		// Check if there's a prompt
		if (!room.prompt || !room.prompt.trim()) {
			return json(
				{ error: 'No prompt available for generation' },
				{ status: 400 }
			);
		}

		// Check if API key is configured
		if (!API_KEY) {
			return json(
				{ error: 'API key is not configured' },
				{ status: 500 }
			);
		}

		// Set active_request to true
		await pb.collection('radio_rooms').update(room.id, {
			active_request: true
		});

		// Call the Suno API
		const body = {
			customMode: false,
			instrumental: room.instrumental || false,
			model: 'V5',
			prompt: room.prompt.trim(),
			callBackUrl: `https://radio.sercan.co.uk/api/music/callback`
		};

		const response = await fetch(API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${API_KEY}`
			},
			body: JSON.stringify(body)
		});

		const data = await response.json();

		if (!response.ok) {
			// Reset active_request on error
			await pb.collection('radio_rooms').update(room.id, {
				active_request: false
			});
			return json(
				{ error: data.error || 'Failed to generate song' },
				{ status: response.status }
			);
		}

		return json({ success: true, data });
	} catch (error) {
		console.error('Error generating song:', error);
		
		// Reset active_request on error
		try {
            const pb = await getPocketBase();
			const latestRoom = await pb
				.collection('radio_rooms')
				.getList(1, 1, { sort: '-created' });
			if (latestRoom.items.length > 0) {
				await pb.collection('radio_rooms').update(latestRoom.items[0].id, {
					active_request: false
				});
			}
		} catch (updateError) {
			console.error('Error resetting active_request:', updateError);
		}

		return json(
			{ error: 'Failed to generate song' },
			{ status: 500 }
		);
	}
};

