import { writable } from 'svelte/store';

export interface Track {
    id: string;
    title: string;
    audio_url: string;
    image_url?: string;
    model_name?: string;
    duration?: number;
    user?: any;
}

export const currentTrack = writable<Track | null>(null);
export const isPlaying = writable(false);
