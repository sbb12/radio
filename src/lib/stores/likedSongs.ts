import { writable } from 'svelte/store';

export interface LikedSongsState {
    count: number;
    trackIds: string[];
}

function createLikedSongsStore() {
    const { subscribe, set, update } = writable<LikedSongsState>({
        count: 0,
        trackIds: []
    });

    return {
        subscribe,
        set,
        addTrack: (trackId: string) => update(state => {
            if (state.trackIds.includes(trackId)) return state;
            return {
                count: state.count + 1,
                trackIds: [...state.trackIds, trackId]
            };
        }),
        removeTrack: (trackId: string) => update(state => {
            if (!state.trackIds.includes(trackId)) return state;
            return {
                count: Math.max(0, state.count - 1),
                trackIds: state.trackIds.filter(id => id !== trackId)
            };
        }),
        initialize: (trackIds: string[]) => set({
            count: trackIds.length,
            trackIds
        })
    };
}

export const likedSongs = createLikedSongsStore();
