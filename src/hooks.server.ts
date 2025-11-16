import { redirect, type Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '$env/static/private';
import { sequence } from '@sveltejs/kit/hooks';

const handleAuth: Handle = async ({ event, resolve }) => {
	// Skip auth check for login page and API routes
	const isLoginPage = event.url.pathname === '/login';
	const isApiRoute = event.url.pathname.startsWith('/api');
	const isAuthApiRoute = event.url.pathname.startsWith('/api/auth');

	// Allow access to login page and auth API routes
	if (isLoginPage || isAuthApiRoute) {
		return resolve(event);
	}

	// Validate token with PocketBase
	try {
		if (!POCKETBASE_URL) {
			console.error('POCKETBASE_URL not configured');
			if (!isApiRoute) {
				throw redirect(302, '/login');
			}
			return new Response(JSON.stringify({ error: 'Server configuration error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const pb = new PocketBase(POCKETBASE_URL);
		const token = event.cookies.get('stoken');

		// Load auth from cookie string using custom cookie name
		if (token) {
			pb.authStore.save(token)
			try {
				await pb.collection('users').authRefresh();
			} catch (error) {
				console.error('Auth refresh error:', error);
				event.cookies.delete('stoken', { path: '/' });
				if (!isApiRoute) {
					throw redirect(302, '/login');
				}
				return new Response(JSON.stringify({ error: 'Authentication failed' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// Verify token is valid
		if (!pb.authStore.isValid || !pb.authStore.model) {
			// Invalid token, clear cookie and redirect
			event.cookies.delete('stoken', { path: '/' });
			if (!isApiRoute) {
				throw redirect(302, '/login');
			}
			return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Token is valid, attach user to event locals
		event.locals.pb = pb;
		event.locals.user = pb.authStore.model;
	} catch (error) {
		console.error('Auth validation error:', error);
		event.cookies.delete('stoken', { path: '/' });
		if (!isApiRoute) {
			throw redirect(302, '/login');
		}
		return new Response(JSON.stringify({ error: 'Authentication failed' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleAuth);

