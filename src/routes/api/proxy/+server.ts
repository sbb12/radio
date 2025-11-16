import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Replace with your external API URL
const EXTERNAL_API_URL = 'https://api.example.com/endpoint';

export const GET: RequestHandler = async ({ url, request }) => {
	try {
		// Get query parameters from the request
		const queryParams = url.searchParams.toString();
		const targetUrl = `${EXTERNAL_API_URL}${queryParams ? `?${queryParams}` : ''}`;

		// Forward headers (optional - customize as needed)
		const headers: HeadersInit = {};
		
		// Forward specific headers if needed
		const authHeader = request.headers.get('authorization');
		if (authHeader) {
			headers['authorization'] = authHeader;
		}

		// Call the external API
		const response = await fetch(targetUrl, {
			method: 'GET',
			headers
		});

		const data = await response.json();

		// Forward the response with appropriate status
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

// Handle POST requests
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const response = await fetch(EXTERNAL_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				// Forward authorization if present
				...(request.headers.get('authorization') && {
					authorization: request.headers.get('authorization')!
				})
			},
			body: JSON.stringify(body)
		});

		const data = await response.json();
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

// Handle PUT requests
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const response = await fetch(EXTERNAL_API_URL, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				...(request.headers.get('authorization') && {
					authorization: request.headers.get('authorization')!
				})
			},
			body: JSON.stringify(body)
		});

		const data = await response.json();
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

// Handle DELETE requests
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const response = await fetch(EXTERNAL_API_URL, {
			method: 'DELETE',
			headers: {
				...(request.headers.get('authorization') && {
					authorization: request.headers.get('authorization')!
				})
			}
		});

		const data = await response.json();
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

