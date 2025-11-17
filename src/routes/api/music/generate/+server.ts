import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_KEY, BASE_URL } from '$env/static/private';
import { getPocketBase } from '$lib/pocketbase';

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
}

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

export const POST: RequestHandler = async ({ request }) => {	
	try {
		// Check if API key is configured
		if (!API_KEY) {
			return json(
				{ error: 'API key is not configured on the server' },
				{ status: 500 }
			);
		}

		// Check if base URL is configured
		if (!BASE_URL) {
			return json(
				{ error: 'BASE_URL is not configured on the server' },
				{ status: 500 }
			);
		}

		// Get and parse the request body
		let body: any;
		try {
			body = await request.json();
		} catch (parseError) {
			return json(
				{ error: 'Invalid JSON in request body' },
				{ status: 400 }
			);
		}

		// Automatically set callback URL from environment variable
		body.callBackUrl = `https://radio.sercan.co.uk/api/music/callback`;

		// Validate the request body
		const validation = validateRequest(body);
		if (!validation.valid) {
			return json(
				{ error: validation.error || 'Invalid request body' },
				{ status: 400 }
			);
		}

		// Initialize PocketBase
		let pb;
		let requestRecordId: string | null = null;
		try {
			pb = await getPocketBase();
		} catch (pbError) {
			console.error('PocketBase initialization error:', pbError);
			// Continue without PocketBase if not configured
		}

		// Save request to PocketBase before sending to API
		if (pb) {
			try {
				const requestRecord = {
					...body,
					status: 'pending',
					created_at: new Date().toISOString()
				};

				const record = await pb.collection('radio_generate_requests').create(requestRecord);
				requestRecordId = record.id;
				console.log('Saved generation request to PocketBase:', requestRecordId);
			} catch (dbError) {
				console.error('Error saving request to PocketBase:', dbError);
				// Continue even if database save fails
			}
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
		const contentType = response.headers.get('content-type');
		let data: any;

		if (contentType?.includes('application/json')) {
			data = await response.json();	
		} else {
			const text = await response.text();
			// If response is not JSON, return it as text
			return new Response(text, {
				status: response.status,
				headers: {
					'Content-Type': contentType || 'text/plain'
				}
			});
		}

		// Update PocketBase record with response
		if (pb && requestRecordId) {
			try {
				await pb.collection('radio_generate_requests').update(requestRecordId, {
					status: response.ok ? 'submitted' : 'failed',
					taskId: data.data?.taskId 
				});
				console.log('Updated generation request in PocketBase:', requestRecordId);

				await pb.collection('radio_rooms').update('corxga7q86bsc0s', { active_request: requestRecordId });
			} catch (updateError) {
				console.error('Error updating request in PocketBase:', updateError);
				// Continue even if update fails
			}
		}

		// Forward the response with the same status code
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Suno API proxy error:', error);

		return json(
			{ error: 'Failed to communicate with Suno API' },
			{ status: 500 }
		);
	}
};

