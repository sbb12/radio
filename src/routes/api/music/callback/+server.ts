import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';

interface MusicTrack {
    id: string;
    audio_url: string;
    source_audio_url: string;
    stream_audio_url: string;
    source_stream_audio_url: string;
    image_url: string;
    source_image_url: string;
    prompt: string;
    model_name: string;
    title: string;
    tags: string;
    createTime: string;
    duration: number;
}

interface CallbackData {
    callbackType: 'text' | 'first' | 'complete' | 'error';
    task_id: string;
    data: MusicTrack[] | null;
}

interface CallbackRequest {
    code: number;
    msg: string;
    data: CallbackData;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const GET: RequestHandler = async ({ request }) => {
    return  json('hello')
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        // Parse the callback request
        const body: CallbackRequest = await request.json();

        console.log({ body })

        const { code, msg, data } = body;
        let { task_id, callbackType, data: musicData } = data;

        // Log callback information
        console.log('Received music generation callback:', {
            taskId: task_id,
            callbackType,
            status: code,
            message: msg
        });

        // Initialize PocketBase
        let pb;
        try {
            pb = await getPocketBase();
        } catch (pbError) {
            console.error('PocketBase initialization error:', pbError);
            // Continue without PocketBase if not configured
        }

        // Save callback to database
        if (pb) {
            try {
                // Save or update callback record
                const callbackRecord = {
                    code,
                    msg,
                    task_id,
                    callbackType,
                    data: musicData
                };

                // Check if callback record already exists for this task_id and callback_type
                const existing = await pb
                    .collection('radio_generate_callbacks').getOne(task_id)
                    .catch(() => null);

                if (existing) {
                    // Update existing record
                    await pb.collection('radio_generate_callbacks').update(existing.id, callbackRecord);
                    console.log('Updated callback record in PocketBase:', existing.id);
                } else {
                    // Create new record
                    const record = await pb.collection('radio_generate_callbacks').create(callbackRecord);
                    console.log('Created callback record in PocketBase:', record.id);
                }
            } catch (dbError) {
                console.error('Error saving callback to PocketBase:', dbError);
                // Continue processing even if database save fails
            }
        }

        // Handle different callback types and status codes
        if (code === 200) {
            // Task completed successfully
            console.log('Music generation completed successfully');

            if (musicData && Array.isArray(musicData) && pb) {
                console.log(`Generated ${musicData.length} music track(s):`);

                // Save each music track to database
                for (const music of musicData) {
                    try {
                        // Check if track already exists
                        const existingTrack = await pb
                            .collection('radio_music_tracks')
                            .getOne(music.id)
                            .catch(() => null);

                        if (existingTrack) {
                            // Update existing track
                            await pb.collection('radio_music_tracks').update(existingTrack.id, music);
                            console.log(`Updated music track in PocketBase: ${music.id}`);
                        } else {
                            // Create new track
                            const record = await pb.collection('radio_music_tracks').create(music);
                            console.log(`Created music track in PocketBase: ${music.id}`);
                        }

                        // Log track details
                        console.log(`Track: ${music.title}`);
                        console.log(`  ID: ${music.id}`);
                        console.log(`  Duration: ${music.duration} seconds`);
                        console.log(`  Tags: ${music.tags}`);
                        console.log(`  Model: ${music.model_name}`);
                        console.log(`  Audio URL: ${music.audio_url}`);
                        console.log(`  Cover URL: ${music.image_url}`);
                        console.log(`  Created: ${music.createTime}`);
                    } catch (trackError) {
                        console.error(`Error saving track ${music.id} to PocketBase:`, trackError);
                        // Continue with next track even if one fails
                    }
                }
            } else if (musicData && Array.isArray(musicData)) {
                // Log tracks even if PocketBase is not available
                musicData.forEach((music, index) => {
                    console.log(`Track ${index + 1}:`);
                    console.log(`  ID: ${music.id}`);
                    console.log(`  Title: ${music.title}`);
                    console.log(`  Duration: ${music.duration} seconds`);
                    console.log(`  Tags: ${music.tags}`);
                    console.log(`  Model: ${music.model_name}`);
                    console.log(`  Audio URL: ${music.audio_url}`);
                    console.log(`  Cover URL: ${music.image_url}`);
                    console.log(`  Created: ${music.createTime}`);
                });
            }

            // Handle different callback stages
            switch (callbackType) {
                case 'text':
                    console.log('Text generation completed for task:', task_id);
                    break;
                case 'first':
                    console.log('First music track completed for task:', task_id);
                    break;
                case 'complete':
                    console.log('All music tracks completed for task:', task_id);
                    break;
            }
        } else {
            // Task failed
            console.error('Music generation failed:', {
                taskId: task_id,
                code,
                message: msg,
                callbackType
            });

            // Handle different error codes
            switch (code) {
                case 400:
                    console.error('Bad Request - Parameter error or content violation');
                    break;
                case 451:
                    console.error('Download Failed - Unable to download related files');
                    break;
                case 500:
                    console.error('Server Error - Please try again later');
                    break;
                default:
                    console.error(`Unknown error code: ${code}`);
            }
        }

        // Return 200 status code immediately to confirm callback received
        // This is important to avoid timeout (must respond within 15 seconds)
        return json({ status: 'received', taskId: task_id }, { status: 200, headers: corsHeaders });
    } catch (error) {
        console.error('Error processing callback:', error);

        // Still return 200 to prevent retries for malformed requests
        // Log the error for debugging
        return json(
            {
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 200 }
        );
    }
};

export const OPTIONS: RequestHandler = async () => {
    // Preflight response
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
};


