import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPocketBase } from '$lib/pocketbase';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const pb = await getPocketBase();
		
		// Get pagination parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const perPage = parseInt(url.searchParams.get('perPage') || '50');
		
		// Get all music tracks
		const tracks = await pb
			.collection('radio_music_tracks')
			.getList(page, perPage, {
				sort: '-created'
			});

		// Format tracks
		const formattedTracks = tracks.items.map((track) => ({
			id: track.id,
			track_id: track.track_id || track.id,
			title: track.title || 'Untitled',
			audio_url: track.audio_url,
			stream_audio_url: track.stream_audio_url,
			image_url: track.image_url,
			duration: track.duration,
			tags: track.tags,
			prompt: track.prompt,
			model_name: track.model_name,
			create_time: track.create_time
		}));

		return json({
			tracks: formattedTracks,
			page: tracks.page,
			perPage: tracks.perPage,
			totalItems: tracks.totalItems,
			totalPages: tracks.totalPages
		});
	} catch (error) {
		console.error('Error loading tracks:', error);
		return json(
			{
				tracks: [],
				error: 'Failed to load tracks'
			},
			{ status: 500 }
		);
	}
};

