import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_KEY, BASE_URL, AI_GATEWAY_API_KEY } from '$env/static/private';
import { getPocketBase, validatePocketbase } from '$lib/pocketbase';
import { createGateway, generateObject } from 'ai';
import { z } from 'zod';

// Suno API endpoint for music generation
// Update this URL to match your Suno API endpoint
// You can also set it via environment variable SUNO_API_URL in .env file
const API_URL = 'https://api.sunoapi.org/api/v1/generate';

const MODELS = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V5'] as const;
const VOCAL_GENDERS = ['m', 'f'] as const;

interface GenerateRequest {
	customMode: boolean;
	instrumental: boolean;
	model: string;
	prompt?: string;
	style?: string;
	title?: string;
	personaId?: string;
	negativeTags?: string;
	vocalGender?: string;
	styleWeight?: number;
	weirdnessConstraint?: number;
	audioWeight?: number;
	generation_prompt?: string;
	enhance?: boolean;
}

export const POST: RequestHandler = async ({ request, locals, cookies }) => {

	const token = cookies.get('token')
	const {
		pb,
		valid,
		e
	} = await validatePocketbase(token)

	if (!pb) {
		return error(401, 'missing auth')
	}
	if (!valid) {
		return error(403, 'unauthorised user')
	}

	const user_id = pb.authStore.record!.id

	let body: any;
	try {
		body = await request.json();
	} catch (parseError) {
		return json(
			{ error: 'Invalid JSON in request body' },
			{ status: 400 }
		);
	}

	// Handle Enhancement if requested
	if (body.enhance && !body.customMode && body.prompt && !body.instrumental) {
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
			});

			const result = await generateObject({
				model: gateway('openai/gpt-5.1-thinking'),
				schema: customPromptSchema,
				messages: [
					{
						role: 'system',
						content: `
You are a music expert. 
Your task is to take a simple song description and convert it into parameters for a music generation AI.

The lyrics should not be overly cliche, or generic.  the lyrics should also not reference the style of the music.

The lyrics, style and title must not contain any copyrighted material or the names of artists, songs, albums, or other copyrighted works.
if an artist is mentioned, that should influence the style and lyrics.

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
						content: body.prompt,
					},
				],
			});

			const enhanced = result.object;

			// Update body to use custom mode with enhanced values
			body.customMode = true;
			body.title = enhanced.title;
			body.style = enhanced.style;
			// Store original prompt + enhanced tag
			body.generation_prompt = body.prompt + ' (Enhanced)';
			// Use enhanced lyrics as the prompt for Suno
			body.prompt = enhanced.prompt;

		} catch (enhanceError) {
			console.error('Enhance error:', enhanceError);
			return json(
				{ error: 'Failed to enhance prompt. Please try again or disable enhance.' },
				{ status: 500 }
			);
		}
	} else if (!body.customMode && body.prompt) {
		// If not enhancing and simple mode, set generation_prompt
		body.generation_prompt = body.prompt;
	}

	body.callBackUrl = `https://radio.sercan.co.uk/api/music/callback`;

	// Validate the request body
	const validation = validateRequest(body);
	if (!validation.valid) {
		return json(
			{ error: validation.error || 'Invalid request body' },
			{ status: 400 }
		);
	}

	// create pb record of request
	let requestRecordId
	try {
		const requestRecord: any = {
			...body,
			user: user_id,
			status: 'pending',
		};

		const record = await pb.collection('radio_generate_requests').create(requestRecord);
		requestRecordId = record.id;
		console.log('Saved generation request to PocketBase:', requestRecordId);
	} catch (e) {
		console.error('Error saving request to PocketBase:', e);
		return error(500)
	}

	// Prepare headers for the Suno API request
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${API_KEY}`
	};

	// Call the Suno API
	const response = await fetch(API_URL, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)

	});

	// Get the response data
	const data = await response.json();

	// Update PocketBase record with response
	if (pb && requestRecordId) {
		try {
			await pb.collection('radio_generate_requests').update(requestRecordId, {
				status: response.ok ? 'submitted' : 'failed',
				taskId: data.data?.taskId
			});
			console.log('Updated generation request in PocketBase:', requestRecordId);

		} catch (updateError) {
			console.error('Error updating request in PocketBase:', updateError);
			// Continue even if update fails
		}
	}

	// Forward the response with the same status code
	// Include enhanced details if they were generated, so frontend can update placeholder
	return json({
		...data,
		recordId: requestRecordId,
		enhanced: body.customMode && body.generation_prompt?.includes('(Enhanced)') ? {
			title: body.title,
			style: body.style,
			prompt: body.prompt
		} : undefined
	}, { status: response.status });
};

function validateRequest(body: any): { valid: boolean; error?: string } {
	// Required fields
	if (typeof body.customMode !== 'boolean') {
		return { valid: false, error: 'customMode must be a boolean' };
	}

	if (typeof body.instrumental !== 'boolean') {
		return { valid: false, error: 'instrumental must be a boolean' };
	}

	if (!body.model || typeof body.model !== 'string') {
		return { valid: false, error: 'model is required and must be a string' };
	}

	if (!MODELS.includes(body.model as any)) {
		return { valid: false, error: `model must be one of: ${MODELS.join(', ')}` };
	}

	// Custom Mode validation
	if (body.customMode) {
		if (!body.style || typeof body.style !== 'string' || !body.style.trim()) {
			return { valid: false, error: 'style is required in Custom Mode' };
		}

		if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
			return { valid: false, error: 'title is required in Custom Mode' };
		}

		// Title max length
		if (body.title.length > 80) {
			return { valid: false, error: 'title must be 80 characters or less' };
		}

		// Style max length based on model
		if (body.model === 'V3_5' || body.model === 'V4') {
			if (body.style.length > 200) {
				return { valid: false, error: 'style must be 200 characters or less for V3_5 and V4 models' };
			}
		} else {
			if (body.style.length > 1000) {
				return { valid: false, error: 'style must be 1000 characters or less for V4_5, V4_5PLUS, and V5 models' };
			}
		}

		// Prompt required if not instrumental
		if (!body.instrumental) {
			if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
				return { valid: false, error: 'prompt is required in Custom Mode when instrumental is false' };
			}

			// Prompt max length based on model
			if (body.model === 'V3_5' || body.model === 'V4') {
				if (body.prompt.length > 3000) {
					return { valid: false, error: 'prompt must be 3000 characters or less for V3_5 and V4 models' };
				}
			} else {
				if (body.prompt.length > 5000) {
					return { valid: false, error: 'prompt must be 5000 characters or less for V4_5, V4_5PLUS, and V5 models' };
				}
			}
		}
	} else {
		// Non-custom Mode validation
		if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
			return { valid: false, error: 'prompt is required in Non-custom Mode' };
		}

		if (body.prompt.length > 500) {
			return { valid: false, error: 'prompt must be 500 characters or less in Non-custom Mode' };
		}
	}

	// Optional field validations
	if (body.vocalGender !== undefined) {
		if (!VOCAL_GENDERS.includes(body.vocalGender)) {
			return { valid: false, error: 'vocalGender must be "m" or "f"' };
		}
	}

	if (body.styleWeight !== undefined) {
		if (typeof body.styleWeight !== 'number' || body.styleWeight < 0 || body.styleWeight > 1) {
			return { valid: false, error: 'styleWeight must be a number between 0 and 1' };
		}
		// Check if it's a multiple of 0.01 (allow for floating point precision issues)
		const rounded = Math.round(body.styleWeight * 100) / 100;
		if (Math.abs(body.styleWeight - rounded) > 0.0001) {
			return { valid: false, error: 'styleWeight must be a multiple of 0.01' };
		}
	}

	if (body.weirdnessConstraint !== undefined) {
		if (typeof body.weirdnessConstraint !== 'number' || body.weirdnessConstraint < 0 || body.weirdnessConstraint > 1) {
			return { valid: false, error: 'weirdnessConstraint must be a number between 0 and 1' };
		}
		const rounded = Math.round(body.weirdnessConstraint * 100) / 100;
		if (Math.abs(body.weirdnessConstraint - rounded) > 0.0001) {
			return { valid: false, error: 'weirdnessConstraint must be a multiple of 0.01' };
		}
	}

	if (body.audioWeight !== undefined) {
		if (typeof body.audioWeight !== 'number' || body.audioWeight < 0 || body.audioWeight > 1) {
			return { valid: false, error: 'audioWeight must be a number between 0 and 1' };
		}
		const rounded = Math.round(body.audioWeight * 100) / 100;
		if (Math.abs(body.audioWeight - rounded) > 0.0001) {
			return { valid: false, error: 'audioWeight must be a multiple of 0.01' };
		}
	}

	return { valid: true };
}
