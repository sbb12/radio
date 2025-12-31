import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Redirect to user page if already authenticated
	if (locals.user) {
		throw redirect(302, '/me');
	}
	return {};
};




