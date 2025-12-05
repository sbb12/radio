<script lang="ts">
	import { currentTrack, isPlaying, queue } from '$lib/stores';
	import { enhance } from '$app/forms';
	import 'remixicon/fonts/remixicon.css';

	import SongList from '$lib/components/SongList.svelte';

	let { data } = $props();
	let playlist = $state(data.playlist);
	let songs = $state(data.songs || []);

	$effect(() => {
		playlist = data.playlist;
		songs = data.songs || [];
	});

	function playTrack(track: any) {
		currentTrack.set(track);
		isPlaying.set(true);
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
</script>

<div
	class="min-h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12 pb-32 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-7xl">
		<div class="mb-8">
			<a href="/me" class="mb-4 inline-flex items-center text-gray-400 hover:text-white">
				<i class="ri-arrow-left-line mr-2"></i> Back to Library
			</a>
			<div class="flex items-end gap-6">
				<div class="h-48 w-48 overflow-hidden rounded-xl bg-gray-800 shadow-2xl">
					{#if playlist.cover}
						<img src={playlist.cover} alt={playlist.name} class="h-full w-full object-cover" />
					{:else}
						<div
							class="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900 to-slate-900"
						>
							<i class="ri-music-2-line text-6xl text-white/20"></i>
						</div>
					{/if}
				</div>
				<div>
					<h1 class="mb-2 text-4xl font-bold text-white">{playlist.name}</h1>
					<p class="mb-4 text-gray-400">{songs.length} songs</p>
					<button
						class="btn-primary"
						onclick={() => {
							if (songs.length > 0) {
								currentTrack.set(songs[0]);
								isPlaying.set(true);
								queue.set(songs);
							}
						}}
					>
						<i class="ri-play-fill mr-2"></i> Play
					</button>
				</div>
			</div>
		</div>

		<div class="space-y-2">
			<SongList tracks={songs} playlistMode={true} userReactions={data.userReactions} />
		</div>
	</div>
</div>

<style lang="postcss">
	@reference "$lib/../app.css";
</style>
