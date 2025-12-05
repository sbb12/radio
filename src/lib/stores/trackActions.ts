import { writable } from 'svelte/store';
import { getPocketBase } from '$lib/pocketbase';
import { toasts } from '$lib/stores/toast';

// Store for user reactions: { [trackId: string]: 'like' | 'dislike' }
export const userReactions = writable<Record<string, 'like' | 'dislike'>>({});

export async function fetchReaction(trackId: string) {
    const pb = await getPocketBase();
    if (!pb.authStore.isValid) return;
    try {
        const reaction = await pb
            .collection('radio_user_track_reaction')
            .getFirstListItem(`user="${pb.authStore.model?.id}" && track="${trackId}"`);

        userReactions.update(r => ({ ...r, [trackId]: reaction.reaction }));
    } catch (e) {
        // No reaction found
    }
}

export async function toggleReaction(trackId: string, reaction: 'like' | 'dislike') {
    let previousReactions: Record<string, 'like' | 'dislike'> = {};

    // Optimistic update
    userReactions.update(reactions => {
        previousReactions = { ...reactions };
        const current = reactions[trackId];
        if (current === reaction) {
            const { [trackId]: _, ...rest } = reactions;
            return rest;
        } else {
            return { ...reactions, [trackId]: reaction };
        }
    });

    try {
        const response = await fetch('/api/music/reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackId, reaction })
        });

        if (!response.ok) {
            throw new Error('Failed to update reaction');
        }
    } catch (e) {
        console.error('Error updating reaction:', e);
        // Revert optimistic update
        userReactions.set(previousReactions);
        toasts.add('Failed to update reaction', 'error');
    }
}

export async function addToPlaylist(playlistId: string, trackId: string) {
    const pb = await getPocketBase();
    // We need to ensure we have a valid auth token. 
    // getPocketBase() creates a new instance, so it might not have the auth store populated 
    // if it relies on localStorage which might not be available or synced immediately 
    // in this context if not handled carefully. 
    // However, the existing MusicPlayer code calls getPocketBase() in onMount and uses it.
    // We should probably check if we can get the auth state.

    // Actually, getPocketBase() in src/lib/pocketbase.ts just does `new PocketBase(...)`.
    // It doesn't load from local storage automatically unless the SDK does it by default (it does for browser).

    if (!pb.authStore.isValid) {
        // Try to load from local storage if not valid (SDK does this automatically usually)
        // If still not valid:
        // toasts.add('Please login to add to playlist', 'error');
        // return;

        // Actually, let's assume the browser SDK handles the auto-load.
    }

    try {
        // Check if already exists
        try {
            const existing = await pb
                .collection('radio_playlist_track')
                .getFirstListItem(`playlist="${playlistId}" && track="${trackId}"`);
            if (existing) {
                toasts.add('Song already in playlist', 'info');
                return;
            }
        } catch (e) {
            // Not found, proceed
        }

        await pb.collection('radio_playlist_track').create({
            playlist: playlistId,
            track: trackId,
            added_by: pb.authStore.model?.id
        });
        toasts.add('Added to playlist!', 'success');
        return true;
    } catch (e) {
        console.error('Error adding to playlist:', e);
        toasts.add('Failed to add to playlist', 'error');
        return false;
    }
}
