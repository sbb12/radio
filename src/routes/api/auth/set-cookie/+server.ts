import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { cookie } = await request.json();

		if (!cookie) {
			return json({ error: 'Cookie data required' }, { status: 400 });
		}

		// Parse the cookie string to extract the token
		// token cookie format: token=token; path=/; ...
		const tokenMatch = cookie.match(/token=([^;]+)/);
		if (tokenMatch) {
			// Extract just the token value
			const token = tokenMatch[1];
			cookies.set('token', token, {
				path: '/',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				sameSite: 'lax',
				httpOnly: false,
				secure: false // Set to true in production with HTTPS
			});
		} else {
			// If no match, try to extract from the full cookie string
			// Sometimes the format might be different
			const parts = cookie.split(';');
			for (const part of parts) {
				const [key, value] = part.trim().split('=');
				if (key === 'token' && value) {
					cookies.set('token', value, {
						path: '/',
						maxAge: 60 * 60 * 24 * 7,
						sameSite: 'lax',
						httpOnly: false,
						secure: false
					});
					break;
				}
			}
		}

		return json({ success: true });
	} catch (error) {
		console.error('Set cookie error:', error);
		return json({ error: 'Failed to set cookie' }, { status: 500 });
	}
};

