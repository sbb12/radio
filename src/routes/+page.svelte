<script lang="ts">
	import { onMount } from 'svelte';
	import { currentTrack, isPlaying, queue } from '$lib/stores';
	import SongList from '$lib/components/SongList.svelte';
	import 'remixicon/fonts/remixicon.css';

	let { data } = $props();
	let tracks = $state(data.tracks || []);
	let shuffledTracks = $state<any[]>([]);
	let isRadioActive = $state(false);

	function shuffle(array: any[]) {
		let currentIndex = array.length,
			randomIndex;
		while (currentIndex != 0) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;
			[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
		}
		return array;
	}

	onMount(() => {
		if (tracks.length > 0) {
			shuffledTracks = shuffle([...tracks]);
		}
	});

	function toggleRadio() {
		if (!isRadioActive) {
			// Start radio
			if (shuffledTracks.length > 0) {
				shuffledTracks = shuffle([...tracks]);
				queue.set(shuffledTracks);
				currentTrack.set(shuffledTracks[0]);
				isPlaying.set(true);
				isRadioActive = true;
			}
		} else {
			// Toggle play/pause
			isPlaying.update((v) => !v);
		}
	}

	// Determine if our radio queue is currently playing
	$effect(() => {
		// This is a simple check. In a real app we might want to track the "source" of the queue.
		// For now, if we are playing and the current track is in our shuffled list, we assume radio is active.
		if ($currentTrack && shuffledTracks.find((t) => t.id === $currentTrack.id)) {
			isRadioActive = true;
		}
	});
</script>

<div
	class="min-h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-7xl">
		<div class="flex flex-col items-center justify-center text-center">
			<div class="mb-8 sm:mb-12">
				<h1
					class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-4xl font-extrabold text-transparent sm:text-7xl"
				>
					Lofi Radio
				</h1>
				<p class="mt-2 text-lg text-gray-400 sm:mt-4 sm:text-xl">
					Chill beats for focus and relaxation
				</p>
			</div>

			{#if tracks.length === 0}
				<div></div>
			{:else}
				<div class="relative mb-8 sm:mb-16">
					<!-- Pulsing glow effect behind the play button -->
					{#if !isRadioActive || !$isPlaying}
						<div
							class="absolute top-1/2 left-1/2 -z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-purple-500/20 blur-xl"
						></div>
					{/if}

					<button
						onclick={toggleRadio}
						class="group relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl transition-all hover:scale-105 hover:shadow-purple-500/50 active:scale-95"
					>
						{#if isRadioActive && $isPlaying}
							<i class="ri-pause-fill text-5xl text-white"></i>
						{:else}
							<i class="ri-play-fill ml-1 text-5xl text-white"></i>
						{/if}
					</button>
				</div>

				<!-- Now Playing / Up Next Section -->
				{#if isRadioActive && $currentTrack}
					<div class="w-full max-w-4xl">
						<div
							class="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md"
						>
							<div class="grid grid-cols-1 gap-6 p-4 sm:gap-8 sm:p-8 md:grid-cols-2">
								<!-- Now Playing Art -->
								<div class="flex flex-col items-center justify-center">
									<div
										class="relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
									>
										{#if $currentTrack.image_url}
											<img
												src={$currentTrack.image_url}
												alt={$currentTrack.title}
												class="h-full w-full object-cover"
											/>
										{:else}
											<div
												class="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900 to-slate-900"
											>
												<i class="ri-music-2-line text-6xl text-white/20"></i>
											</div>
										{/if}

										<!-- Visualizer Overlay -->
										{#if $isPlaying}
											<div
												class="absolute inset-0 flex hidden items-center justify-center gap-2 bg-black/40 backdrop-blur-[2px]"
											>
												<div class="flex h-[50%] flex-row items-center justify-center gap-2">
													<div
														class="h-12 w-3 animate-[music-bar_1s_ease-in-out_infinite] rounded-full bg-white"
													></div>
													<div
														class="h-20 w-3 animate-[music-bar_1.2s_ease-in-out_infinite] rounded-full bg-white"
													></div>
													<div
														class="h-16 w-3 animate-[music-bar_0.8s_ease-in-out_infinite] rounded-full bg-white"
													></div>
													<div
														class="h-10 w-3 animate-[music-bar_1.1s_ease-in-out_infinite] rounded-full bg-white"
													></div>
												</div>
											</div>
										{/if}
									</div>
									<div class="mt-6 text-center">
										<h2 class="text-2xl font-bold text-white">{$currentTrack.title}</h2>
										<p class="text-purple-300">{$currentTrack.tags || 'Lofi Vibes'}</p>
									</div>
								</div>

								<!-- Up Next List -->
								<div class="flex flex-col">
									<h3 class="mb-3 text-lg font-bold text-white sm:mb-4">Up Next</h3>
									<div
										class="custom-scrollbar -mr-2 max-h-[300px] flex-1 overflow-y-auto pr-2 sm:-mr-4 sm:max-h-[400px] sm:pr-4"
									>
										<!-- Show next 10 songs from the queue -->
										{#each $queue.slice($queue.findIndex((t) => t.id === $currentTrack.id) + 1, $queue.findIndex((t) => t.id === $currentTrack.id) + 11) as track}
											<div
												class="mb-3 flex items-center gap-4 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
											>
												<div class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-800">
													{#if track.image_url}
														<img
															src={track.image_url}
															alt={track.title}
															class="h-full w-full object-cover"
														/>
													{:else}
														<div class="flex h-full w-full items-center justify-center">
															<i class="ri-music-2-line text-gray-500"></i>
														</div>
													{/if}
												</div>
												<div class="min-w-0 flex-1 text-left">
													<h4 class="truncate font-medium text-white">{track.title}</h4>
													<p class="truncate text-xs text-gray-400">{track.tags || 'Unknown'}</p>
												</div>
											</div>
										{/each}
										{#if $queue.findIndex((t) => t.id === $currentTrack.id) + 11 < $queue.length}
											<p class="text-center text-sm text-gray-500">...and more</p>
										{/if}
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	@reference "$lib/../app.css";

	@keyframes music-bar {
		0%,
		100% {
			height: 1rem;
		}
		50% {
			height: 3rem;
		}
	}
</style>
