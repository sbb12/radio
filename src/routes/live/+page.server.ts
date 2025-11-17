import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Only return user data, track will be loaded on client side
	return {
		user: locals.user || null
	};
};

