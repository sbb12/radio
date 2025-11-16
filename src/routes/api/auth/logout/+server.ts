import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	// Clear auth cookie
	cookies.delete('stoken', { path: '/' });

	return json({ success: true });
};

