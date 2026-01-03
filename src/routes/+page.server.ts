import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await getPocketBase();
	let tracks: any[] = [];

	try {
		// Fetch ALL reactions to get likes and dislikes
		const allReactions = await pb.collection('radio_user_track_reaction').getFullList({
			expand: 'track'
		});

		// Build sets of liked and disliked track IDs
		const dislikedTrackIds = new Set<string>();
		const trackMap = new Map();

		// First pass: collect all disliked track IDs
		for (const r of allReactions) {
			if (r.reaction === 'dislike') {
				dislikedTrackIds.add(r.track);
			}
		}

		// Second pass: collect liked tracks that aren't disliked
		for (const r of allReactions) {
			if (r.reaction === 'like') {
				const track = r.expand?.track;
				if (track && !track.deleted && !trackMap.has(track.id) && !dislikedTrackIds.has(track.id)) {
					trackMap.set(track.id, track);
				}
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
