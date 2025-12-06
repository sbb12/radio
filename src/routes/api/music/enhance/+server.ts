import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AI_GATEWAY_API_KEY } from '$env/static/private';
import { createGateway, generateObject } from 'ai';
import { z } from 'zod';

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
        return json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!AI_GATEWAY_API_KEY) {
        return json({ error: 'Enhance feature is not available (Missing API Key)' }, { status: 503 });
    }

    try {
        const gateway = createGateway({
            apiKey: AI_GATEWAY_API_KEY,
        });

        const customPromptSchema = z.object({
            title: z.string().max(100),
            style: z.string().max(100),
            prompt: z.string().max(5000),
            vocalGender: z.enum(['m', 'f']).optional(),
        });

        const result = await generateObject({
            // model: gateway('openai/gpt-5.1'),
            model: gateway('openai/gpt-5.1-thinking'),
            schema: customPromptSchema,
            messages: [
                {
                    role: 'system',
                    content: `
You are a music expert. 
Your task is to take a simple song description and convert it into parameters for a music generation AI.

The lyrics should not be overly cliche, or generic.  the lyrics should also not reference the style of the music.

Return ONLY a JSON object with the following fields:

- "prompt": Full lyrics or song structure with section tags like [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro].
    - This field MUST contain only:
        • section headers, descriptions of instruments, tempo, or mixing in square brackets
        • lines of singable lyrics
    - DO NOT include:
        • production or arrangement notes
        • comments, directions, or annotations like ">>" or "(guitars enter here)"
        • anything that is not meant to be sung
    - Max 5000 characters.
    - Target a 3-4 minute song.

- "style": Short description of genre and vibe ONLY. 
    - No lyrics here.
    - Max 100 characters.

- "title": Short, catchy song title.
    - No quotes.
    - Max 100 characters.
`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        return json(result.object);
    } catch (e) {
        console.error('Enhance error:', e);
        return json(
            { error: 'Failed to enhance prompt. Please try again or disable enhance.' },
            { status: 500 }
        );
    }
};
