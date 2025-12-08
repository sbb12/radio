import { redirect, type Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '$env/static/private';
import { sequence } from '@sveltejs/kit/hooks';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const handleAuth: Handle = async ({ event, resolve }) => {
	// Handle CORS preflight requests
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders
		});
	}

	// Skip auth check for login page and API routes
	const isLoginPage = event.url.pathname === '/login';
	const isApiRoute = event.url.pathname.startsWith('/api');

	// Allow access to login page and API routes without auth
	if (isLoginPage || isApiRoute) {
		const response = await resolve(event);
		// Add CORS headers to API responses
		if (isApiRoute) {
			Object.entries(corsHeaders).forEach(([key, value]) => {
				response.headers.set(key, value);
			});
		}
		return response;
	}

	// Validate token with PocketBase for protected routes
	try {
		if (!POCKETBASE_URL) {
			console.error('POCKETBASE_URL not configured');
			throw redirect(302, '/login');
		}

		const pb = new PocketBase(POCKETBASE_URL);
		const token = event.locals.token || event.cookies.get('token');

		// Load auth from cookie string using custom cookie name
		if (token) {
			pb.authStore.save(token);
			try {
				await pb.collection('users').authRefresh();
			} catch (error) {
				console.error('Auth refresh error:', error);
				event.cookies.delete('token', { path: '/' });
				// Only redirect if it's a protected route
				const isPublicRoute = event.url.pathname === '/' || event.url.pathname.startsWith('/track');
				if (!isPublicRoute) {
					throw redirect(302, '/login');
				}
			}
		}

		// Verify token is valid
		if (pb.authStore.isValid && pb.authStore.model) {
			// Token is valid, attach user to event locals
			event.locals.pb = pb;
			event.locals.user = pb.authStore.model;
		} else {
			// Invalid or no token
			event.cookies.delete('token', { path: '/' });

			const isPublicRoute = event.url.pathname === '/' || event.url.pathname.startsWith('/track');
			if (!isPublicRoute) {
				throw redirect(302, '/login');
			}
		}

	} catch (error) {
		// If it's a redirect, re-throw it
		if (error instanceof Response && error.status >= 300 && error.status < 400) {
			throw error;
		}
		console.error('Auth validation error:', error);

		const isPublicRoute = event.url.pathname === '/' || event.url.pathname.startsWith('/track');
		if (!isPublicRoute) {
			event.cookies.delete('token', { path: '/' });
			throw redirect(302, '/login');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleAuth);

