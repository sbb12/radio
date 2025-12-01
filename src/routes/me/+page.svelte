<script lang="ts">
	import { currentTrack, isPlaying } from '$lib/stores';
	import 'remixicon/fonts/remixicon.css';

	let { data } = $props();
	let user = $state(data.user);
	let tracks = $state(data.tracks || []);
	let playlists = $state(data.playlists || []);

	// UI state
	let searchQuery = $state('');
	let isCreatingPlaylist = $state(false);
	let newPlaylistName = $state('');

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

	function playTrack(track: any) {
		currentTrack.set(track);
		isPlaying.set(true);
	}

	function formatTime(seconds: number): string {
		if (isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function formatDate(dateString: string): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString();
		} catch {
			return dateString;
		}
	}

	function handleCreatePlaylist() {
		if (!newPlaylistName.trim()) return;

		// Mock playlist creation for now
		const newPlaylist = {
			id: crypto.randomUUID(),
			name: newPlaylistName,
			count: 0,
			cover: null,
			created: new Date().toISOString()
		};

		playlists = [newPlaylist, ...playlists];
		newPlaylistName = '';
		isCreatingPlaylist = false;
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
				<div class="mb-8 rounded-xl border border-white/10 bg-white/5 p-6">
					<h3 class="mb-4 text-lg font-bold text-white">New Playlist</h3>
					<div class="flex gap-4">
						<input
							type="text"
							bind:value={newPlaylistName}
							placeholder="Playlist Name"
							class="input-field flex-1"
							onkeydown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
						/>
						<button class="btn-primary" onclick={handleCreatePlaylist}>Create</button>
						<button
							class="rounded-lg border border-white/10 px-4 py-2 font-semibold text-white hover:bg-white/5"
							onclick={() => {
								isCreatingPlaylist = false;
								newPlaylistName = '';
							}}
						>
							Cancel
						</button>
					</div>
				</div>
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
				<div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
					{#each playlists as playlist}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
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
							<p class="text-sm text-gray-400">{playlist.count || 0} songs</p>
						</div>
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
					<div class="space-y-2">
						{#each filteredTracks as track (track.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="group relative overflow-hidden rounded-xl bg-white/5 p-2 transition-all hover:bg-white/10"
							>
								<div class="flex items-center gap-4">
									<!-- Image -->
									<div
										class="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-gray-800"
										onclick={() => playTrack(track)}
									>
										{#if track.image_url}
											<img
												src={track.image_url}
												alt={track.title}
												class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
											/>
										{:else}
											<div class="flex h-full w-full items-center justify-center">
												<i class="ri-music-fill text-2xl text-gray-600"></i>
											</div>
										{/if}

										<!-- Play Overlay -->
										<div
											class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
										>
											<button
												class="flex h-8 w-8 items-center justify-center rounded-full bg-white text-purple-900 shadow-lg transition-transform hover:scale-105"
											>
												<i class="ri-play-fill ml-0.5 text-lg"></i>
											</button>
										</div>
									</div>

									<!-- Content -->
									<div class="flex min-w-0 flex-1 items-center justify-between gap-4">
										<div class="min-w-0 flex-1">
											<h3
												class="cursor-pointer truncate text-base font-bold text-white transition-colors hover:text-purple-400"
												onclick={() => playTrack(track)}
											>
												{track.title}
											</h3>
											<div class="flex items-center gap-2 text-xs text-gray-400">
												<span class="rounded bg-white/10 px-1.5 py-0.5">{track.model_name}</span>
												<span>•</span>
												<span>{formatDate(track.create_time)}</span>
												{#if track.tags}
													<span>•</span>
													<span class="max-w-[200px] truncate">{track.tags}</span>
												{/if}
											</div>
										</div>

										<!-- Actions -->
										<div
											class="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
										>
											<button
												class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-green-400"
												title="Like"
											>
												<i class="ri-thumb-up-line"></i>
											</button>
											<button
												class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-red-400"
												title="Dislike"
											>
												<i class="ri-thumb-down-line"></i>
											</button>
											<button
												class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-purple-400"
												title="Add to Playlist"
											>
												<i class="ri-play-list-add-line"></i>
											</button>
											<button
												class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-blue-400"
												title="Share"
											>
												<i class="ri-share-forward-line"></i>
											</button>
											<a
												href={track.audio_url}
												download
												class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-white"
												title="Download"
												onclick={(e) => e.stopPropagation()}
											>
												<i class="ri-download-line"></i>
											</a>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>

<style lang="postcss">
	@reference "$lib/../app.css";
</style>
