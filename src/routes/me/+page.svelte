<script lang="ts">
	import { currentTrack, isPlaying } from '$lib/stores';
	import { addToPlaylist } from '$lib/stores/trackActions';
	import { enhance } from '$app/forms';
	import 'remixicon/fonts/remixicon.css';
	import { invalidateAll } from '$app/navigation';
	import SongList from '$lib/components/SongList.svelte';

	import { onMount, onDestroy } from 'svelte';
	import { getPocketBase } from '$lib/pocketbase';
	import type PocketBase from 'pocketbase';

	let { data } = $props();
	let user = $derived(data.user);
	let tracks = $derived(data.tracks || []);
	let playlists = $state(data.playlists || []);

	$effect(() => {
		playlists = data.playlists || [];
	});

	let pb: PocketBase;

	onMount(async () => {
		pb = await getPocketBase();
		pb.collection('radio_playlists').subscribe('*', (e) => {
			if (e.action === 'create') {
				// For new playlists, we might not have stats yet, but invalidateAll will fetch them
				invalidateAll();
			} else if (e.action === 'update') {
				invalidateAll();
			} else if (e.action === 'delete') {
				playlists = playlists.filter((p) => p.id !== e.record.id);
			}
		});

		pb.collection('radio_playlist_track').subscribe('*', () => {
			invalidateAll();
		});
	});

	onDestroy(() => {
		if (pb) {
			pb.collection('radio_playlists').unsubscribe();
			pb.collection('radio_playlist_track').unsubscribe();
		}
	});

	// UI state
	let searchQuery = $state('');
	let isCreatingPlaylist = $state(false);
	let newPlaylistName = $state('');
	let showPlaylistModal = $state(false);
	let selectedTrackForPlaylist: any = $state(null);

	// Filtered tracks based on search
	let filteredTracks = $derived(
		searchQuery.trim() === ''
			? tracks
			: tracks.filter((song) => {
					const query = searchQuery.toLowerCase();
					return (
						song.title?.toLowerCase().includes(query) ||
						song.tags?.toLowerCase().includes(query) ||
						song.prompt?.toLowerCase().includes(query)
					);
				})
	);

	function formatDuration(seconds: number): string {
		if (!seconds || isNaN(seconds)) return '0m';
		const mins = Math.floor(seconds / 60);
		return `${mins}m`;
	}

	function openPlaylistModal(track: any) {
		selectedTrackForPlaylist = track;
		showPlaylistModal = true;
	}

	async function handleAddToPlaylist(playlistId: string) {
		if (!selectedTrackForPlaylist) return;
		const success = await addToPlaylist(playlistId, selectedTrackForPlaylist.id);
		if (success) {
			showPlaylistModal = false;
			selectedTrackForPlaylist = null;
		}
	}
</script>

<div
	class="min-h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12 pb-32 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-7xl">
		<!-- Playlists Section -->
		<section class="mb-16">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-white">Your Playlists</h2>
				<button class="btn-primary" onclick={() => (isCreatingPlaylist = true)}>
					<i class="ri-add-line mr-2"></i>Create Playlist
				</button>
			</div>

			{#if isCreatingPlaylist}
				<form
					action="?/createPlaylist"
					method="POST"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							isCreatingPlaylist = false;
							newPlaylistName = '';
						};
					}}
					class="mb-8 rounded-xl border border-white/10 bg-white/5 p-6"
				>
					<h3 class="mb-4 text-lg font-bold text-white">New Playlist</h3>
					<div class="flex gap-4">
						<input
							type="text"
							name="name"
							bind:value={newPlaylistName}
							placeholder="Playlist Name"
							class="input-field flex-1"
						/>
						<button type="submit" class="btn-primary">Create</button>
						<button
							type="button"
							class="rounded-lg border border-white/10 px-4 py-2 font-semibold text-white hover:bg-white/5"
							onclick={() => {
								isCreatingPlaylist = false;
								newPlaylistName = '';
							}}
						>
							Cancel
						</button>
					</div>
				</form>
			{/if}

			{#if playlists.length === 0}
				<div class="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
					<div class="mb-4 flex justify-center">
						<div class="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
							<i class="ri-play-list-line text-3xl text-gray-400"></i>
						</div>
					</div>
					<h3 class="mb-2 text-lg font-bold text-white">No playlists yet</h3>
					<p class="text-gray-400">Create your first playlist to organize your music!</p>
				</div>
			{:else}
				<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
					{#each playlists as playlist}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<a
							href="/me/playlist/{playlist.id}"
							class="group cursor-pointer rounded-xl bg-white/5 p-4 transition-all hover:bg-white/10"
						>
							<div class="mb-4 aspect-square overflow-hidden rounded-lg bg-gray-800 shadow-lg">
								{#if playlist.cover}
									<img
										src={playlist.cover}
										alt={playlist.name}
										class="h-full w-full object-cover"
									/>
								{:else}
									<div
										class="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900 to-slate-900"
									>
										<i class="ri-music-2-line text-4xl text-white/20"></i>
									</div>
								{/if}
							</div>
							<h3 class="truncate font-bold text-white">{playlist.name}</h3>
							<p class="text-sm text-gray-400">
								{playlist.count || 0} songs • {formatDuration(playlist.duration)}
							</p>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Songs Section -->
		<section>
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-white">Your Songs</h2>
				<div class="relative w-64">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search songs..."
						class="input-field pl-10"
					/>
					<i class="ri-search-line absolute top-3 left-3 h-5 w-5 text-gray-400"></i>
				</div>
			</div>

			<div class="card">
				{#if filteredTracks.length === 0}
					<div class="flex flex-1 items-center justify-center py-16 text-center">
						<div>
							<div
								class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5"
							>
								<i class="ri-music-2-line text-3xl text-gray-400"></i>
							</div>
							<h3 class="mb-2 text-lg font-medium text-white">No songs found</h3>
							<p class="text-gray-400">
								{searchQuery
									? 'Try adjusting your search terms'
									: 'Go to the Create page to generate some music!'}
							</p>
						</div>
					</div>
				{:else}
					<SongList
						tracks={filteredTracks}
						onAddToPlaylist={openPlaylistModal}
						userReactions={data.userReactions}
					/>
				{/if}
			</div>
		</section>
	</div>
</div>

{#if showPlaylistModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-xl font-bold text-white">Add to Playlist</h3>
				<button
					class="text-gray-400 hover:text-white"
					onclick={() => {
						showPlaylistModal = false;
						selectedTrackForPlaylist = null;
					}}
				>
					<i class="ri-close-line text-2xl"></i>
				</button>
			</div>

			<div class="space-y-2">
				{#each playlists as playlist}
					<button
						class="flex w-full items-center gap-4 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
						onclick={() => handleAddToPlaylist(playlist.id)}
					>
						<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800">
							{#if playlist.cover}
								<img
									src={playlist.cover}
									alt={playlist.name}
									class="h-full w-full rounded-lg object-cover"
								/>
							{:else}
								<i class="ri-music-2-line text-xl text-white/20"></i>
							{/if}
						</div>
						<div>
							<h4 class="font-bold text-white">{playlist.name}</h4>
							<p class="text-sm text-gray-400">{playlist.count || 0} songs</p>
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	@reference "$lib/../app.css";
</style>
