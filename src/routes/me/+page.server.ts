import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
    // Redirect to login if not authenticated
    if (!locals.user) {
        redirect(302, '/login');
    }

    const pb = await getPocketBase();
    let tracks: any[] = [];


    try {
        // Fetch tracks
        const trackRecords = await pb.collection('radio_music_tracks').getList(1, 50, {
            filter: `user = "${locals.user.id}" && deleted != true`,
            sort: '-created'
        });

        tracks = trackRecords.items



    } catch (e) {
        console.error('Error fetching user data:', e);
    }

    let userReactions = {};
    try {
        if (tracks.length > 0) {
            const trackIds = tracks.map(t => `track="${t.id}"`).join(' || ');
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
    createPlaylist: async ({ request, locals }) => {
        if (!locals.user) {
            return { success: false, error: 'Unauthorized' };
        }

        const data = await request.formData();
        const name = data.get('name');

        if (!name) {
            return { success: false, error: 'Name is required' };
        }

        const pb = await getPocketBase();

        try {
            await pb.collection('radio_playlists').create({
                name,
                user: locals.user.id,
                songs: []
            });
            return { success: true };
        } catch (e) {
            console.error('Error creating playlist:', e);
            return { success: false, error: 'Failed to create playlist' };
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
    },

    delete: async ({ request, locals }) => {
        if (!locals.user) {
            return { success: false, error: 'Unauthorized' };
        }

        const data = await request.formData();
        const id = data.get('id') as string;

        if (!id) {
            return { success: false, error: 'Missing ID' };
        }

        const pb = await getPocketBase();

        try {
            await pb.collection('radio_music_tracks').update(id, {
                deleted: true
            });
            return { success: true };
        } catch (e) {
            console.error('Error deleting track:', e);
            return { success: false, error: 'Failed to delete track' };
        }
    }
};
