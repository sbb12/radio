<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import MusicPlayer from '$lib/components/MusicPlayer.svelte';

	import Toast from '$lib/components/Toast.svelte';
	import {
		playlists,
		addPlaylistToStore,
		updatePlaylistInStore,
		removePlaylistFromStore
	} from '$lib/stores/playlists';
	import { likedSongs } from '$lib/stores/likedSongs';
	import { getPocketBase } from '$lib/pocketbase';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	let { children, data } = $props();

	$effect(() => {
		if (data.playlists) {
			playlists.set(data.playlists);
		}
		if (data.likedTrackIds) {
			likedSongs.initialize(data.likedTrackIds);
		}
	});

	let pb: any;

	onMount(async () => {
		// Restore authentication from localStorage/cookie
		pb = await getPocketBase();
		
		// If we have a token but no user data, try to refresh auth
		if (!data.user && pb.authStore.isValid && pb.authStore.token) {
			try {
				await pb.collection('users').authRefresh();
				// Invalidate to reload page data with user
				await invalidateAll();
			} catch (e) {
				// Token is invalid, clear it
				if (typeof window !== 'undefined') {
					localStorage.removeItem('pb_token');
				}
				pb.authStore.clear();
			}
		}
		
		if (data.user) {
			pb.collection('radio_playlists').subscribe('*', (e: any) => {
				if (e.action === 'create') {
					addPlaylistToStore(e.record);
					invalidateAll();
				} else if (e.action === 'update') {
					updatePlaylistInStore(e.record);
					invalidateAll();
				} else if (e.action === 'delete') {
					removePlaylistFromStore(e.record.id);
				}
			});

			// Also subscribe to playlist tracks to update counts/duration
			pb.collection('radio_playlist_track').subscribe('*', () => {
				invalidateAll();
			});
		}
	});

	onDestroy(() => {
		if (pb) {
			pb.collection('radio_playlists').unsubscribe();
			pb.collection('radio_playlist_track').unsubscribe();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen flex-col overflow-hidden bg-slate-900">
	<Navigation user={data.user} />
	<Toast />

	<main class="relative flex-1 overflow-y-auto">
		{@render children()}
	</main>

	<MusicPlayer />
</div>
