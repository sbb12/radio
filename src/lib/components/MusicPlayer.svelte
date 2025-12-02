<script lang="ts">
	import { currentTrack, isPlaying, queue } from '$lib/stores';
	import { getPocketBase } from '$lib/pocketbase';
	import PocketBase from 'pocketbase';
	import { onMount, onDestroy } from 'svelte';

	let audio: HTMLAudioElement;
	let pb: PocketBase;
	let unsubscribe: () => void;
	let progress = $state(0);
	let duration = $state(0);
	let currentTime = $state(0);

	// Subscribe to store changes
	let track = $state($currentTrack);
	let playing = $state($isPlaying);
	let trackQueue = $state($queue);

	// Update local state when store changes
	currentTrack.subscribe((value) => {
		if (value?.id != track?.id) {
			track = value;
			console.log('updated');
		}
	});

	queue.subscribe((value) => {
		trackQueue = value;
	});

	isPlaying.subscribe((value) => {
		playing = value;
		if (audio) {
			if (value) {
				audio.play().catch(() => isPlaying.set(false));
			} else {
				audio.pause();
			}
		}
	});

	function togglePlay() {
		isPlaying.update((v) => !v);
	}

	function playNext() {
		if (!trackQueue.length || !track) return;
		const currentIndex = trackQueue.findIndex((t) => t.id === track.id);
		if (currentIndex !== -1 && currentIndex < trackQueue.length - 1) {
			currentTrack.set(trackQueue[currentIndex + 1]);
			isPlaying.set(true);
		}
	}

	function playPrevious() {
		if (!trackQueue.length || !track) return;
		const currentIndex = trackQueue.findIndex((t) => t.id === track.id);
		if (currentIndex !== -1 && currentIndex > 0) {
			currentTrack.set(trackQueue[currentIndex - 1]);
			isPlaying.set(true);
		}
	}

	function handleTimeUpdate() {
		currentTime = audio.currentTime;
		progress = (audio.currentTime / (duration || audio.duration)) * 100;
	}

	function handleLoadedMetadata() {
		duration = audio.duration;
		if (playing) {
			audio.play().catch(() => isPlaying.set(false));
		}
	}

	function handleEnded() {
		progress = 0;
		playNext();
	}

	function formatTime(seconds: number) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function closePlayer() {
		isPlaying.set(false);
		currentTrack.set(null);
	}

	function handleSeek(e: MouseEvent) {
		const progressBar = e.currentTarget as HTMLDivElement;
		const rect = progressBar.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = x / rect.width;
		const newTime = percentage * duration;
		audio.currentTime = newTime;
	}

	function handleDownload() {
		if (track) {
			const pb = new PocketBase('https://pb.sercan.co.uk');
			const url = pb.files.getURL(track, track.audio);
			const link = document.createElement('a');
			link.href = url;
			link.download = track.title + '.mp3';
			link.click();
		}
	}

	onMount(async () => {
		pb = await getPocketBase();
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	$effect(() => {
		if (track && audio) {
			// When track changes, auto play
			isPlaying.set(true);
		}

		// Smart streaming subscription
		if (track && track.stream_audio_url && !track.duration && pb) {
			// Unsubscribe previous if exists
			if (unsubscribe) unsubscribe();

			pb.collection('radio_music_tracks')
				.subscribe(track.id, (e) => {
					console.log(e);
					if (e.action === 'update') {
						const updatedTrack = e.record;
						// If we now have audio_url and duration, update the track
						if (updatedTrack.audio_url && updatedTrack.duration) {
							// Save current time to restore after reload
							const savedTime = audio.currentTime;
							duration = updatedTrack.duration;
						}
					}
				})
				.then((unsub) => {
					unsubscribe = unsub;
				});
			console.log('listening for updates');
		}
	});
</script>

{#if track}
	<div
		class="fixed right-0 bottom-0 left-0 z-50 border-t border-white/10 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-lg transition-transform duration-300 ease-in-out"
	>
		<div class="mx-auto flex max-w-7xl items-center gap-4">
			<!-- Track Info -->
			<div class="flex w-1/4 min-w-[150px] items-center gap-3">
				{#if track.image_url}
					<img
						src={track.image_url}
						alt={track.title}
						class="h-12 w-12 rounded bg-gray-800 object-cover shadow-lg"
					/>
				{:else}
					<div class="flex h-12 w-12 items-center justify-center rounded bg-gray-800">
						<i class="ri-music-fill text-xl text-gray-400"></i>
					</div>
				{/if}
				<div class="overflow-hidden">
					<h3 class="truncate text-sm font-bold text-white">{track.title}</h3>
					<p class="truncate text-xs text-gray-400">{track.model_name || 'Unknown Model'}</p>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex flex-1 flex-col items-center gap-1">
				<div class="flex items-center gap-4">
					<button
						class="cursor-pointer text-gray-400 transition-colors hover:text-white"
						onclick={playPrevious}
					>
						<i class="ri-skip-back-fill text-xl"></i>
					</button>
					<button
						onclick={togglePlay}
						class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-purple-900 shadow-lg transition-transform hover:scale-105"
					>
						{#if playing}
							<i class="ri-pause-fill text-xl"></i>
						{:else}
							<i class="ri-play-fill ml-0.5 text-xl"></i>
						{/if}
					</button>
					<button
						class="cursor-pointer text-gray-400 transition-colors hover:text-white"
						onclick={playNext}
					>
						<i class="ri-skip-forward-fill text-xl"></i>
					</button>
				</div>

				<!-- Progress Bar -->
				<div class="flex w-full max-w-md items-center gap-2 text-xs text-gray-400">
					<span>{formatTime(currentTime)}</span>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="group relative h-1 flex-1 cursor-pointer rounded-full bg-white/10"
						onclick={handleSeek}
					>
						<div
							class="absolute h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
							style="width: {progress}%"
						></div>
						<div
							class="absolute -top-1 h-3 w-3 rounded-full bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
							style="left: {progress}%; transform: translateX(-50%)"
						></div>
					</div>
					{#if duration && duration != Infinity}
						<span>{formatTime(duration)}</span>
					{:else}
						<!-- remix icon loading -->
						<span><i class="ri-loader-line animate-spin"></i></span>
					{/if}
				</div>
			</div>

			<!-- Volume / Actions -->
			<div class="flex w-1/4 items-center justify-end gap-4">
				<button
					onclick={handleDownload}
					class="hidden text-gray-400 transition-colors hover:text-white"
				>
					<i class="ri-download-line text-lg"></i>
				</button>
				<button
					onclick={closePlayer}
					class="cursor-pointer text-gray-400 transition-colors hover:text-red-400"
				>
					<i class="ri-close-line text-xl"></i>
				</button>
			</div>
		</div>

		<audio
			bind:this={audio}
			src={track.audio_url || track.stream_audio_url}
			ontimeupdate={handleTimeUpdate}
			onloadedmetadata={handleLoadedMetadata}
			onended={handleEnded}
			class="hidden"
		></audio>
	</div>
{/if}
