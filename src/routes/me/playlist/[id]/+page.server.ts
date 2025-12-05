import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals, params }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    const pb = await getPocketBase();
    const playlistId = params.id;

    try {
        const playlist = await pb.collection('radio_playlists').getOne(playlistId);

        const playlistTracks = await pb.collection('radio_playlist_track').getList(1, 200, {
            filter: `playlist = "${playlistId}"`,
            expand: 'track',
            sort: '-created'
        });

        // Map the playlist tracks to get the actual track data, adding the playlist_track id for deletion
        const songs = playlistTracks.items.map(item => {
            const track = item.expand?.track;
            if (track) {
                return {
                    ...track,
                    playlist_track_id: item.id // Store the junction table ID for removal
                };
            }
            return null;
        }).filter(Boolean);

        let userReactions = {};
        if (songs.length > 0) {
            try {
                const trackIds = songs.map((t: any) => `track="${t.id}"`).join(' || ');
                const reactions = await pb.collection('radio_user_track_reaction').getFullList({
                    filter: `user="${locals.user.id}" && (${trackIds})`
                });
                userReactions = reactions.reduce((acc: any, r: any) => {
                    acc[r.track] = r.reaction;
                    return acc;
                }, {});
            } catch (e) {
                console.error('Error fetching reactions:', e);
            }
        }

        return {
            playlist,
            songs,
            userReactions
        };
    } catch (e) {
        console.error('Error fetching playlist:', e);
        // Redirect to me page if playlist not found
        redirect(302, '/me');
    }
};

export const actions: Actions = {
    removeFromPlaylist: async ({ request, locals }) => {
        if (!locals.user) {
            return { success: false, error: 'Unauthorized' };
        }

        const data = await request.formData();
        const playlistTrackId = data.get('playlistTrackId') as string;

        if (!playlistTrackId) {
            return { success: false, error: 'Missing ID' };
        }

        const pb = await getPocketBase();

        try {
            await pb.collection('radio_playlist_track').delete(playlistTrackId);
            return { success: true };
        } catch (e) {
            console.error('Error removing from playlist:', e);
            return { success: false, error: 'Failed to remove from playlist' };
        }
    }
};
