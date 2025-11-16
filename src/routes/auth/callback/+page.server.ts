import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '$env/static/private';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state) {
		throw redirect(302, '/login?error=oauth_failed');
	}

	try {
		if (!POCKETBASE_URL) {
			throw new Error('POCKETBASE_URL not configured');
		}

		const pb = new PocketBase(POCKETBASE_URL);
		
		// Complete OAuth authentication
		const authData = await pb.collection('users').authWithOAuth2Code('google', code, state, url.origin + '/auth/callback');

		// Extract token from auth store using custom cookie name
		const cookieString = pb.authStore.exportToCookie({}, 'stoken');
		const tokenMatch = cookieString.match(/stoken=([^;]+)/);
		
		if (tokenMatch) {
			cookies.set('stoken', tokenMatch[1], {
				path: '/',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				sameSite: 'lax',
				httpOnly: false,
				secure: false // Set to true in production with HTTPS
			});
		}

		// Redirect to home
		throw redirect(302, '/');
	} catch (error) {
		console.error('OAuth callback error:', error);
		throw redirect(302, '/login?error=oauth_failed');
	}
};

