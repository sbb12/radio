import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/login');
    }

    const pb = await getPocketBase();
    let songs: any[] = [];
    let userReactions = {};

    try {
        // Fetch liked tracks
        const reactions = await pb.collection('radio_user_track_reaction').getFullList({
            filter: `user="${locals.user.id}" && reaction="like"`,
            expand: 'track'
        });

        // Extract tracks from reactions
        songs = reactions
            .map((r) => r.expand?.track)
            .filter((t) => t && !t.deleted) // Filter out deleted tracks
            .map((t: any) => ({
                ...t,
                // Add reaction to the track object itself if needed, though we pass userReactions separately
            }));

        // Also fetch all user reactions for the SongList component to display correct state
        const allReactions = await pb.collection('radio_user_track_reaction').getFullList({
            filter: `user="${locals.user.id}"`
        });

        userReactions = allReactions.reduce((acc: any, r: any) => {
            acc[r.track] = r.reaction;
            return acc;
        }, {});

    } catch (e) {
        console.error('Error fetching liked songs:', e);
    }

    return {
        playlist: {
            id: 'liked',
            name: 'Liked Songs',
            description: 'Your collection of liked tracks',
            cover: null, // We can handle a default cover in the UI
            isVirtual: true // Flag to indicate this isn't a real database playlist
        },
        songs,
        userReactions
    };
};
