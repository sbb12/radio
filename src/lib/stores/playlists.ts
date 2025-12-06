import { writable } from 'svelte/store';
import { getPocketBase } from '$lib/pocketbase';

export const playlists = writable<any[]>([]);

export async function fetchPlaylists(userId: string) {
    const pb = await getPocketBase();
    try {
        const playlistRecords = await pb.collection('radio_playlists').getList(1, 50, {
            filter: `user = "${userId}"`,
            sort: '-created'
        });

        const rawPlaylists = playlistRecords.items;

        // Fetch all playlist tracks to calculate stats
        let allPlaylistTracks: any[] = [];
        try {
            allPlaylistTracks = await pb.collection('radio_playlist_track').getFullList({
                filter: `playlist.user = "${userId}"`,
                expand: 'track'
            });
        } catch (e) {
            console.log('Error fetching playlist tracks:', e);
        }

        const enhancedPlaylists = rawPlaylists.map(p => {
            const pTracks = allPlaylistTracks.filter(pt => pt.playlist === p.id);
            const duration = pTracks.reduce((acc, pt) => acc + (pt.expand?.track?.duration || 0), 0);
            return {
                ...p,
                count: pTracks.length,
                duration,
                trackIds: pTracks.map(pt => pt.track)
            };
        });

        playlists.set(enhancedPlaylists);
        return enhancedPlaylists;
    } catch (e) {
        console.error('Error fetching playlists:', e);
        return [];
    }
}

export function updatePlaylistInStore(updatedPlaylist: any) {
    playlists.update(current => {
        return current.map(p => p.id === updatedPlaylist.id ? updatedPlaylist : p);
    });
}

export function addPlaylistToStore(newPlaylist: any) {
    playlists.update(current => [newPlaylist, ...current]);
}

export function removePlaylistFromStore(playlistId: string) {
    playlists.update(current => current.filter(p => p.id !== playlistId));
}
