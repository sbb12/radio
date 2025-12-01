import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const load: PageServerLoad = async ({ locals }) => {
    const pb = await getPocketBase();
    let tracks: any[] = [];

    try {
        const records = await pb.collection('radio_music_tracks').getList(1, 50, {
            filter: `user = "${locals.user.id}"`,
            sort: '-created'
        });

        tracks = records.items.map((track) => ({
            id: track.id,
            track_id: track.track_id || track.id,
            title: track.title || 'Untitled',
            audio_url: track.audio_url,
            stream_audio_url: track.stream_audio_url,
            image_url: track.image_url,
            duration: track.duration,
            tags: track.tags,
            prompt: track.prompt,
            model_name: track.model_name,
            create_time: track.create_time,
            status: track.status || 'complete' // Assuming complete if not specified
        }));
    } catch (e) {
        console.error('Error fetching user tracks:', e);
    }

    return {
        user: locals.user,
        tracks
    };
};
