import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Base URL for your external API - update this with your actual API base URL
const EXTERNAL_API_BASE = 'https://api.example.com';

// Helper function to forward headers
function getForwardedHeaders(request: Request): HeadersInit {
	const headers: HeadersInit = {};
	
	// Forward authorization header if present
	const authHeader = request.headers.get('authorization');
	if (authHeader) {
		headers['authorization'] = authHeader;
	}
	
	// Add any other headers you want to forward
	const contentType = request.headers.get('content-type');
	if (contentType) {
		headers['content-type'] = contentType;
	}
	
	return headers;
}

export const GET: RequestHandler = async ({ params, url, request }) => {
	try {
		const path = params.path || '';
		const queryParams = url.searchParams.toString();
		const targetUrl = `${EXTERNAL_API_BASE}/${path}${queryParams ? `?${queryParams}` : ''}`;

		const response = await fetch(targetUrl, {
			method: 'GET',
			headers: getForwardedHeaders(request)
		});

		// Handle non-JSON responses
		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			const data = await response.json();
			return json(data, { status: response.status });
		} else {
			const text = await response.text();
			return new Response(text, { status: response.status });
		}
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const path = params.path || '';
		const targetUrl = `${EXTERNAL_API_BASE}/${path}`;
		
		// Get request body
		const contentType = request.headers.get('content-type');
		let body: BodyInit;
		
		if (contentType?.includes('application/json')) {
			const jsonBody = await request.json();
			body = JSON.stringify(jsonBody);
		} else {
			body = await request.text();
		}

		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: getForwardedHeaders(request),
			body
		});

		const responseContentType = response.headers.get('content-type');
		if (responseContentType?.includes('application/json')) {
			const data = await response.json();
			return json(data, { status: response.status });
		} else {
			const text = await response.text();
			return new Response(text, { status: response.status });
		}
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const path = params.path || '';
		const targetUrl = `${EXTERNAL_API_BASE}/${path}`;
		
		const contentType = request.headers.get('content-type');
		let body: BodyInit;
		
		if (contentType?.includes('application/json')) {
			const jsonBody = await request.json();
			body = JSON.stringify(jsonBody);
		} else {
			body = await request.text();
		}

		const response = await fetch(targetUrl, {
			method: 'PUT',
			headers: getForwardedHeaders(request),
			body
		});

		const responseContentType = response.headers.get('content-type');
		if (responseContentType?.includes('application/json')) {
			const data = await response.json();
			return json(data, { status: response.status });
		} else {
			const text = await response.text();
			return new Response(text, { status: response.status });
		}
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	try {
		const path = params.path || '';
		const targetUrl = `${EXTERNAL_API_BASE}/${path}`;

		const response = await fetch(targetUrl, {
			method: 'DELETE',
			headers: getForwardedHeaders(request)
		});

		const responseContentType = response.headers.get('content-type');
		if (responseContentType?.includes('application/json')) {
			const data = await response.json();
			return json(data, { status: response.status });
		} else {
			const text = await response.text();
			return new Response(text, { status: response.status });
		}
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Failed to fetch from external API' }, { status: 500 });
	}
};

