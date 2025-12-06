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
		queue.set(songs);
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
					<div
						class="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600"
					>
						<i class="ri-heart-fill text-6xl text-white"></i>
					</div>
				</div>
				<div>
					<h1 class="mb-2 text-4xl font-bold text-white">{playlist.name}</h1>
					<p class="mb-4 text-gray-400">{songs.length} songs</p>
					<button
						class="btn-primary"
						onclick={() => {
							if (songs.length > 0) {
								playTrack(songs[0]);
							}
						}}
					>
						<i class="ri-play-fill mr-2"></i> Play
					</button>
				</div>
			</div>
		</div>

		<div class="space-y-2">
			{#if songs.length === 0}
				<div class="rounded-lg border border-white/10 bg-white/5 p-12 text-center">
					<div class="mb-4 flex justify-center">
						<div class="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
							<i class="ri-heart-line text-3xl text-gray-400"></i>
						</div>
					</div>
					<h3 class="mb-2 text-lg font-bold text-white">No liked songs yet</h3>
					<p class="text-gray-400">
						Songs you like will appear here. Go explore and find some music!
					</p>
					<a href="/create" class="btn-primary mt-6 inline-block"> Go to Create </a>
				</div>
			{:else}
				<SongList tracks={songs} playlistMode={false} userReactions={data.userReactions} />
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	@reference "$lib/../app.css";
</style>
