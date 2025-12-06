import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
    const pb = await getPocketBase();
    let tracks: any[] = [];

    try {
        const records = await pb.collection('radio_music_tracks').getList(1, 50, {
            filter: `user = "${locals.user.id}" && deleted != true`,
            sort: '-created'
        });

        tracks = records.items;
    } catch (e) {
        console.error('Error fetching user tracks:', e);
    }

    let userReactions = {};
    try {
        if (tracks.length > 0) {
            const trackIds = tracks.map(t => `track="${t.id}"`).join(' || ');
            // PocketBase filter length limit might be an issue if too many tracks, but for 50 it should be fine.
            // If it fails, we might need to fetch all user reactions or chunk it.
            // For 50 tracks, the filter string length is roughly 50 * (25 chars) = 1250 chars, which is fine.
            const reactions = await pb.collection('radio_user_track_reaction').getFullList({
                filter: `user="${locals.user.id}" && (${trackIds})`
            });

            userReactions = reactions.reduce((acc: any, r: any) => {
                acc[r.track] = r.reaction;
                return acc;
            }, {});
        }
    } catch (e) {
        console.error('Error fetching reactions:', e);
    }

    return {
        user: locals.user,
        tracks,
        userReactions
    };
};

export const actions: Actions = {
    delete: async ({ request, locals }) => {
        const data = await request.formData();
        const id = data.get('id') as string;
        const pb = await getPocketBase();

        try {
            await pb.collection('radio_music_tracks').update(id, {
                deleted: true
            });
            return { success: true };
        } catch (e) {
            console.error('Error deleting track:', e);
            return { success: false, error: e };
        }
    },

    addToPlaylist: async ({ request, locals }) => {
        if (!locals.user) {
            return { success: false, error: 'Unauthorized' };
        }

        const data = await request.formData();
        const playlistId = data.get('playlistId') as string;
        const trackId = data.get('trackId') as string;

        if (!playlistId || !trackId) {
            return { success: false, error: 'Missing playlist or track ID' };
        }

        const pb = await getPocketBase();

        try {
            // Check if song is already in playlist
            try {
                const existing = await pb.collection('radio_playlist_track').getFirstListItem(
                    `playlist="${playlistId}" && track="${trackId}"`
                );
                if (existing) {
                    return { success: false, error: 'Song already in playlist' };
                }
            } catch (e) {
                // Not found, proceed to add
            }

            // Add new song
            await pb.collection('radio_playlist_track').create({
                playlist: playlistId,
                track: trackId,
                added_by: locals.user.id
            });

            return { success: true };
        } catch (e) {
            console.error('Error adding to playlist:', e);
            return { success: false, error: 'Failed to add to playlist' };
        }
    }
};
