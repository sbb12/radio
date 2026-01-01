import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createGateway, generateObject } from 'ai';
import { z } from 'zod';
import { AI_GATEWAY_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
        return json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log(new Date().toISOString(), 'Enhance request received');

    try {

        const gateway = createGateway({
            apiKey: AI_GATEWAY_API_KEY,
        });

        const availableModels = await gateway.getAvailableModels();

        availableModels.models.forEach((model) => {
            console.log(`${model.id}: ${model.name}`);
            if (model.description) {
                console.log(`  Description: ${model.description}`);
            }
            if (model.pricing) {
                console.log(`  Input: $${model.pricing.input}/token`);
                console.log(`  Output: $${model.pricing.output}/token`);
                if (model.pricing.cachedInputTokens) {
                    console.log(
                        `  Cached input (read): $${model.pricing.cachedInputTokens}/token`,
                    );
                }
                if (model.pricing.cacheCreationInputTokens) {
                    console.log(
                        `  Cache creation (write): $${model.pricing.cacheCreationInputTokens}/token`,
                    );
                }
            }
        });

        const enhancedPromptSchema = z.object({
            prompt: z.string().max(500)
        });

        const result = await generateObject({
            model: gateway('openai/gpt-5.1-instant'),
            schema: enhancedPromptSchema,
            temperature: 0.5,
            messages: [
                {
                    role: 'system',
                    content: `
You are a music prompt formatter for Suno.

INPUT (from the user):
- A short, casual descriptor string such as: pop, glitchy electro-pop banger with heavy bass
- The input may include optional hints like: female vocals, male vocals, duet, instrumental, fast/slow, dark/uplifting, etc.

OUTPUT (what you must return):
- Return ONLY a Suno prompt-style block (no explanations, no tips, no extra text).
- Always include these lines at the very top, exactly as written:
  [Is_MAX_MODE: MAX](MAX)
  [QUALITY: MAX](MAX)
  [REALISM: MAX](MAX)
  [REAL_INSTRUMENTS: MAX](MAX)

- Then output exactly these fields in this order (one per line):
  genre:
  instruments:
  vocals:
  tempo & feel:
  arrangement cues:
  mix & production:

Formatting rules (critical):
- Keep everything "metadata-ish": compact noun phrases, comma-separated.
- Do NOT write full sentences. Do NOT include quotes around catchy phrases or anything chantable.
- Do NOT include verse/chorus headings, brackets like [Verse], ALL CAPS slogans, or anything that looks like lyrics/poetry.
- Do NOT include URLs.
- Do NOT output any lyrics or placeholders for lyrics.
- Avoid the words "start immediately" / "write lyrics" / "real instruments" / "ultra realism" in the fields.
- Prefer specific audio/production terms over vague vibe words.
- If the user mentions a specific artist/band, DO NOT name them; translate it into descriptive genre/era/production traits instead.
- If the user doesn't specify vocals, choose the most likely option for the genre; otherwise follow their request.
- Keep arrangement cues concise; no long intro by default unless the user asks.

Optional control (only if user explicitly requests it):
- If the user includes a clear start-on instruction like: start_on: first few words
  then insert these two lines directly under the MAX lines (before genre:):
  [START_ON: TRUE]
  [START_ON: first few words]

Goal:
- Produce a high-quality, realistic, genre-appropriate Suno prompt that matches the user's descriptor while minimizing lyric/prompt bleed.
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
