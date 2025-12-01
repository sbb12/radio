import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	// Redirect to user page if already authenticated
	cookies.delete('token', { path: '/' });
	return {};
};

