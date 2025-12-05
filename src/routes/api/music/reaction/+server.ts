import { json } from '@sveltejs/kit';
import { getPocketBase } from '$lib/pocketbase';
import { validatePocketbase } from '$lib/pocketbase';

export async function POST({ request, locals, cookies }) {
    const { pb, valid } = await validatePocketbase(cookies.get('token'));
    if (!valid || !pb) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { trackId, reaction } = await request.json();

    try {
        // Check if reaction exists
        let existing;
        try {
            existing = await pb.collection('radio_user_track_reaction').getFirstListItem(
                `user="${pb.authStore.record?.id}" && track="${trackId}"`
            );
        } catch (e) {
            // Not found
        }

        if (existing) {
            if (existing.reaction === reaction) {
                // Toggle off (remove reaction)
                await pb.collection('radio_user_track_reaction').delete(existing.id);
                return json({ status: 'removed' });
            } else {
                // Update reaction
                await pb.collection('radio_user_track_reaction').update(existing.id, {
                    reaction
                });
                return json({ status: 'updated', reaction });
            }
        } else {
            // Create new reaction
            await pb.collection('radio_user_track_reaction').create({
                user: pb.authStore.record?.id,
                track: trackId,
                reaction
            });
            return json({ status: 'created', reaction });
        }
    } catch (e) {
        console.error('Error handling reaction:', e);
        return json({ error: 'Failed to process reaction' }, { status: 500 });
    }
}
