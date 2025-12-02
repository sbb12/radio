import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
    // Redirect to login if not authenticated
    if (!locals.user) {
        redirect(302, '/login');
    }

    const pb = await getPocketBase();
    let tracks: any[] = [];
    let playlists: any[] = [];

    try {
        // Fetch tracks
        const trackRecords = await pb.collection('radio_music_tracks').getList(1, 50, {
            filter: `user = "${locals.user.id}"`,
            sort: '-created'
        });

        tracks = trackRecords.items

        // Fetch playlists (Placeholder for now, assuming collection might not exist or empty)
        // const playlistRecords = await pb.collection('playlists').getList(1, 50, {
        //     filter: `user = "${locals.user.id}"`,
        //     sort: '-created'
        // });
        // playlists = playlistRecords.items;

    } catch (e) {
        console.error('Error fetching user data:', e);
    }

    return {
        user: locals.user,
        tracks,
        playlists
    };
};
