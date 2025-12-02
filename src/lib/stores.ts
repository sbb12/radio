import { writable } from 'svelte/store';

export interface Track {
    [key: string]: any;
}

export const currentTrack = writable<Track | null>(null);
export const isPlaying = writable(false);
export const queue = writable<Track[]>([]);
