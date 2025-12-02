import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const GET: RequestHandler = async ({ locals, cookies, url }) => {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json(
				{
					tracks: [],
					error: 'Unauthorized'
				},
				{ status: 401 }
			);
		}

		const pb = await getPocketBase();
		const userId = locals.user.id;

		// Get pagination parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const perPage = parseInt(url.searchParams.get('perPage') || '50');

		// Get user's generated tracks by filtering requests by user_id
		// First, get the user's generation requests
		const requests = await pb
			.collection('radio_generate_requests')
			.getList(page, perPage, {
				filter: `user_id = "${userId}"`,
				sort: '-created',
				expand: 'task_id'
			});

		// Get task IDs from requests
		const taskIds = requests.items
			.map((req: any) => req.taskId)
			.filter((id: string | null) => id !== null && id !== undefined && id !== '');

		// Get tracks associated with these task IDs
		// Fetch in batches to avoid filter length limits
		let tracks: any[] = [];
		if (taskIds.length > 0) {
			// Process in batches of 50 to avoid filter length issues
			const batchSize = 50;
			for (let i = 0; i < taskIds.length; i += batchSize) {
				const batch = taskIds.slice(i, i + batchSize);
				const taskIdFilter = batch.map((id: string) => `task_id = "${id}"`).join(' || ');
				try {
					const tracksResult = await pb
						.collection('radio_music_tracks')
						.getList(1, batchSize * 2, {
							filter: taskIdFilter,
							sort: '-created'
						});
					tracks.push(...tracksResult.items);
				} catch (filterError) {
					console.error('Error fetching tracks batch:', filterError);
					// Continue with next batch even if one fails
				}
			}
		}

		// Format tracks
		const formattedTracks = tracks.map((track) => ({
			...track,
			title: track.title || 'Untitled',
		}));

		// Sort by created date (most recent first)
		formattedTracks.sort((a, b) => {
			const dateA = a.created ? new Date(a.created).getTime() : 0;
			const dateB = b.created ? new Date(b.created).getTime() : 0;
			return dateB - dateA;
		});

		return json({
			tracks: formattedTracks,
			page: requests.page,
			perPage: requests.perPage,
			totalItems: formattedTracks.length,
			totalPages: Math.ceil(formattedTracks.length / perPage)
		});
	} catch (error) {
		console.error('Error loading user tracks:', error);
		return json(
			{
				tracks: [],
				error: 'Failed to load tracks'
			},
			{ status: 500 }
		);
	}
};

