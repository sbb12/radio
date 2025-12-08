import type { PageServerLoad } from './$types';
import { getPocketBase } from '$lib/pocketbase';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
    const pb = await getPocketBase();
    const { id } = params;

    try {
        const track = await pb.collection('radio_music_tracks').getOne(id, {
            expand: 'user'
        });

        let userReactions: Record<string, string> = {};

        if (locals.user) {
            try {
                const reactionRecord = await pb.collection('radio_music_reactions').getFirstListItem(`user="${locals.user.id}" && track="${id}"`);
                userReactions[id] = reactionRecord.type; // 'like' or 'dislike'
            } catch (e) {
                // No reaction found, ignore
            }
        }

        return {
            track,
            userReactions,
            user: locals.user
        };
    } catch (e) {
        console.error('Error fetching track:', e);
        throw error(404, 'Track not found');
    }
};
