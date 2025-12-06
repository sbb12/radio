import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await getPocketBase();
	let tracks: any[] = [];

	try {
		// Fetch tracks that match "lofi" in tags or title
		// If you want ALL tracks to be candidates for the radio, remove the filter.
		// But the user specifically asked for "lofi" songs.
		tracks = await pb.collection('radio_music_tracks').getFullList({
			sort: '-created',
			filter: 'generation_prompt ~ "lofi" && generation_prompt ~ "christmas"'
		});

		// If no lofi tracks found, maybe fallback to all tracks? 
		// For now, let's stick to the request. If empty, the UI will show empty state.
	} catch (e) {
		console.error('Error fetching radio tracks:', e);
	}

	return {
		user: locals.user || null,
		tracks
	};
};
