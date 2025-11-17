import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	// Clear auth cookie
	cookies.delete('stoken', { path: '/' });

	// Redirect to login page
	throw redirect(302, '/login');
};

