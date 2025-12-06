import type { LayoutServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: LayoutServerLoad = async ({ locals }) => {
	let playlists: any[] = [];
	let likedTrackIds: string[] = [];

	if (locals.user) {
		const pb = await getPocketBase();
		try {
			const playlistRecords = await pb.collection('radio_playlists').getList(1, 50, {
				filter: `user = "${locals.user.id}"`,
				sort: '-created'
			});

			const rawPlaylists = playlistRecords.items;

			// Fetch all playlist tracks
			let allPlaylistTracks: any[] = [];
			try {
				allPlaylistTracks = await pb.collection('radio_playlist_track').getFullList({
					filter: `playlist.user = "${locals.user.id}"`,
					expand: 'track'
				});
			} catch (e) {
				console.log('Error fetching playlist tracks:', e);
			}

			playlists = rawPlaylists.map(p => {
				const pTracks = allPlaylistTracks.filter(pt => pt.playlist === p.id);
				const duration = pTracks.reduce((acc, pt) => acc + (pt.expand?.track?.duration || 0), 0);
				return {
					...p,
					count: pTracks.length,
					duration,
					trackIds: pTracks.map(pt => pt.track)
				};
			});
		} catch (e) {
			console.log('Error fetching playlists:', e);
		}

		try {
			// Fetch liked tracks IDs for the store
			const likedRecords = await pb.collection('radio_user_track_reaction').getFullList({
				filter: `user="${locals.user.id}" && reaction="like"`,
				fields: 'track'
			});
			likedTrackIds = likedRecords.map(r => r.track);
		} catch (e) {
			console.log('Error fetching liked tracks:', e);
		}
	}

	return {
		user: locals.user || null,
		playlists,
		likedTrackIds
	};
};
