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

    return {
        user: locals.user,
        tracks
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
    }
};
