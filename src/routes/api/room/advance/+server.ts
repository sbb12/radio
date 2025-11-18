import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';
import { base } from '$app/paths';
import { BASE_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const pb = await getPocketBase();

        // Get the latest room
        const latestRoom = await pb
            .collection('radio_rooms')
            .getList(1, 1, {
                sort: '-created'
            });

        if (latestRoom.items.length === 0) {
            return json(
                { error: 'No room available' },
                { status: 404 }
            );
        }

        const room = latestRoom.items[0];
        let updateData = {}

        if (room.next_track) {
            const nextTrack = await pb.collection('radio_music_tracks').getOne(room.next_track);
            if (nextTrack) {
                updateData = {
                    ...updateData,
                    current_track: nextTrack.id,
                    next_track: null,
                    current_start: new Date().toISOString()
                };
            }
        }
        // no next track at this point, generate if one isnt already on the way
        if (!room.active_request) {
            // If generation is disabled, just randomly select a song
            if (room.disable_generate) {
                try {
                    // Get all tracks (fetch in batches if needed)
                    const allTracks = await pb.collection('radio_music_tracks').getFullList({
                        sort: '-created'
                    });
                    
                    if (allTracks.length > 0) {
                        // Randomly select a track
                        const randomIndex = Math.floor(Math.random() * allTracks.length);
                        const randomTrack = allTracks[randomIndex];
                        
                        updateData = {
                            ...updateData,
                            next_track: randomTrack.id
                        };
                        console.log('Generation disabled, randomly selected track:', randomTrack.id);
                    } else {
                        return json(
                            { error: 'No tracks available' },
                            { status: 500 }
                        );
                    }
                } catch (error) {
                    console.error('Error selecting random track:', error);
                    return json(
                        { error: 'Failed to select random track' },
                        { status: 500 }
                    );
                }
            } else {
                // Generation is enabled, try to generate a new song
                const response = await fetch(BASE_URL + '/api/music/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        customMode: false,
                        instrumental: room.instrumental || false,
                        model: 'V5',
                        prompt: room.prompt
                    }),
                });
                if (response.ok) {
                    const data = await response.json();                
                    console.log({data});
                    updateData = {
                        ...updateData,
                        active_request: data.data.recordId
                    };
                } else {
                    // If generation fails, randomly select a song from all available songs
                    try {
                        // Get all tracks (fetch in batches if needed)
                        const allTracks = await pb.collection('radio_music_tracks').getFullList({
                            sort: '-created'
                        });
                        
                        if (allTracks.length > 0) {
                            // Randomly select a track
                            const randomIndex = Math.floor(Math.random() * allTracks.length);
                            const randomTrack = allTracks[randomIndex];
                            
                            updateData = {
                                ...updateData,
                                next_track: randomTrack.id
                            };
                            console.log('Generation failed, randomly selected track:', randomTrack.id);
                        } else {
                            return json(
                                { error: 'Failed to generate song and no tracks available' },
                                { status: 500 }
                            );
                        }
                    } catch (error) {
                        console.error('Error selecting random track:', error);
                        return json(
                            { error: 'Failed to generate song and failed to select random track' },
                            { status: 500 }
                        );
                    }
                }
            }
        }

        if (Object.keys(updateData).length > 0) {
            console.log({updateData});
            try {                
                await pb.collection('radio_rooms').update(room.id, updateData);
            } catch (error) {
                console.error('Error updating room:', error);
                return json({ error: 'Failed to update room' }, { status: 500 });
            }
        }

        return json({ success: true });
    } catch (error) {
        console.error('Error advancing room:', error);
        return json(
            { error: 'Failed to advance room' },
            { status: 500 }
        );
    }
};

