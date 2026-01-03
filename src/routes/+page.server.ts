import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await getPocketBase();
	let tracks: any[] = [];

	try {
		// Fetch ALL liked songs from all users
		const reactions = await pb.collection('radio_user_track_reaction').getFullList({
			filter: `reaction="like"`,
			expand: 'track'
		});

		// Extract unique tracks from reactions and filter out deleted ones
		const trackMap = new Map();
		for (const r of reactions) {
			const track = r.expand?.track;
			if (track && !track.deleted && !trackMap.has(track.id)) {
				trackMap.set(track.id, track);
			}
		}
		tracks = Array.from(trackMap.values());
	} catch (e) {
		console.error('Error fetching liked tracks:', e);
	}

	return {
		user: locals.user || null,
		tracks
	};
};
