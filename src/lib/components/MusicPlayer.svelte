<script lang="ts">
	import { currentTrack, isPlaying, queue } from '$lib/stores';
	import {
		userReactions,
		toggleReaction,
		addToPlaylist,
		fetchReaction
	} from '$lib/stores/trackActions';
	import { toasts } from '$lib/stores/toast';
	import { getPocketBase } from '$lib/pocketbase';
	import PocketBase from 'pocketbase';
	import { onMount, onDestroy } from 'svelte';
	import { playlists } from '$lib/stores/playlists';
	import { removeFromPlaylist } from '$lib/stores/trackActions';

	let audio = $state<HTMLAudioElement>();
	let pb: PocketBase;
	let unsubscribe: () => void;
	let progress = $state(0);
	let duration = $state(0);
	let currentTime = $state(0);
	let volume = $state(1);
	let muted = $state(false);

	let canvas = $state<HTMLCanvasElement>();
	let audioContext: AudioContext;
	let analyser: AnalyserNode;
	let source: MediaElementAudioSourceNode;
	let animationId: number;

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
		if (audioContext && audioContext.state === 'suspended') {
			audioContext.resume();
		}
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
		if (!audio) return;
		currentTime = audio.currentTime;
		progress = (audio.currentTime / (duration || audio.duration)) * 100;
	}

	function handleLoadedMetadata() {
		if (!audio) return;
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
		if (!audio) return;
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
			link.rel = 'external';
			link.click();
		}
	}

	function toggleMute() {
		if (muted && volume === 0) {
			volume = 0.5;
			muted = false;
		} else {
			muted = !muted;
		}
	}

	function handleVolumeChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		volume = +input.value;
		if (volume > 0 && muted) muted = false;
		if (volume === 0) muted = true;
	}

	function initVisualizer() {
		if (!audio || !canvas || audioContext) return;
		const cvs = canvas;

		try {
			const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
			audioContext = new AudioContext();
			analyser = audioContext.createAnalyser();

			source = audioContext.createMediaElementSource(audio);
			source.connect(analyser);
			analyser.connect(audioContext.destination);

			analyser.fftSize = 128;
			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			const ctx = cvs.getContext('2d');
			if (!ctx) return;

			const draw = () => {
				animationId = requestAnimationFrame(draw);

				analyser.getByteFrequencyData(dataArray);

				ctx.clearRect(0, 0, cvs.width, cvs.height);

				const barWidth = (cvs.width / bufferLength) * 2.5;
				let barHeight;
				let x = 0;

				for (let i = 0; i < bufferLength; i++) {
					barHeight = (dataArray[i] / 255) * cvs.height;

					const gradient = ctx.createLinearGradient(0, cvs.height, 0, 0);
					gradient.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
					gradient.addColorStop(1, 'rgba(236, 72, 153, 0.8)');

					ctx.fillStyle = gradient;
					ctx.fillRect(x, cvs.height - barHeight, barWidth - 2, barHeight);

					x += barWidth;
				}
			};

			draw();
		} catch (e) {
			console.error('Visualizer init failed:', e);
		}
	}

	onMount(async () => {
		pb = await getPocketBase();
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
		if (animationId) cancelAnimationFrame(animationId);
		if (audioContext) audioContext.close();
	});

	$effect(() => {
		if (track && audio) {
			// When track changes, auto play
			isPlaying.set(true);
		}

		if (track && audio && canvas && !audioContext) {
			initVisualizer();
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
							const savedTime = audio?.currentTime || 0;
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
	let showQueue = $state(false);
	let showPlaylistModal = $state(false);

	function isInPlaylist(trackId: string) {
		return $playlists.some((p: any) => p.trackIds?.includes(trackId));
	}

	async function handleAddToPlaylist(playlistId: string) {
		if (!track) return;

		const playlist = $playlists.find((p: any) => p.id === playlistId);
		const isAlreadyIn = playlist?.trackIds?.includes(track.id);

		if (isAlreadyIn) {
			await removeFromPlaylist(playlistId, track.id);
		} else {
			await addToPlaylist(playlistId, track.id);
		}
	}

	function formatDuration(seconds: number): string {
		if (!seconds || isNaN(seconds)) return '0m';
		const mins = Math.floor(seconds / 60);
		return `${mins}m`;
	}

	function toggleQueue() {
		showQueue = !showQueue;
	}

	function playQueueTrack(t: any) {
		currentTrack.set(t);
		isPlaying.set(true);
	}

	function removeFromQueue(t: any) {
		const newQueue = trackQueue.filter((track) => track.id !== t.id);
		queue.set(newQueue);
	}

	function shuffleQueue() {
		const shuffled = [...trackQueue].sort(() => Math.random() - 0.5);
		queue.set(shuffled);
	}
</script>

{#if track}
	<!-- Playlist Modal -->
	{#if showPlaylistModal}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
		>
			<div class="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
				<div class="mb-6 flex items-center justify-between">
					<h3 class="text-xl font-bold text-white">Add to Playlist</h3>
					<button
						class="text-gray-400 hover:text-white"
						onclick={() => (showPlaylistModal = false)}
					>
						<i class="ri-close-line text-2xl"></i>
					</button>
				</div>

				<div class="custom-scrollbar max-h-[60vh] space-y-2 overflow-y-auto">
					{#each $playlists as playlist}
						<button
							class="flex w-full items-center gap-4 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/10 {playlist.trackIds?.includes(
								track.id
							)
								? 'border border-green-500/50 bg-green-500/10'
								: ''}"
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
								<p class="text-sm text-gray-400">
									{playlist.count || 0} songs • {formatDuration(playlist.duration)}
								</p>
							</div>
							{#if playlist.trackIds?.includes(track.id)}
								<i class="ri-check-line ml-auto text-xl text-green-500"></i>
							{/if}
						</button>
					{/each}
					{#if $playlists.length === 0}
						<p class="text-center text-gray-400">No playlists found.</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Queue Panel -->
	{#if showQueue}
		<div
			class="fixed right-4 bottom-24 z-50 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-lg sm:right-6"
			style="max-height: calc(100vh - 8rem);"
		>
			<div class="border-b border-white/10 p-4">
				<h3 class="font-bold text-white">Queue</h3>
			</div>
			<div class="custom-scrollbar max-h-[60vh] overflow-y-auto p-2">
				{#if trackQueue.length === 0}
					<div class="p-4 text-center text-gray-400">Queue is empty</div>
				{:else}
					{#each trackQueue as t}
						<div
							class="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5 {t.id ===
							track.id
								? 'bg-white/10'
								: ''}"
						>
							<div
								class="relative h-10 w-10 flex-shrink-0 cursor-pointer overflow-hidden rounded bg-gray-800"
								onclick={() => playQueueTrack(t)}
							>
								{#if t.image_url}
									<img src={t.image_url} alt={t.title} class="h-full w-full object-cover" />
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<i class="ri-music-fill text-gray-400"></i>
									</div>
								{/if}
								<div
									class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
								>
									<i class="ri-play-fill text-white"></i>
								</div>
							</div>
							<div class="min-w-0 flex-1">
								<h4
									class="truncate text-sm font-medium text-white {t.id === track.id
										? 'text-purple-400'
										: ''}"
								>
									{t.title}
								</h4>
								<p class="truncate text-xs text-gray-400">
									{t.model_name === 'chirp-crow' ? 'V5' : t.model_name || 'Unknown'}
								</p>
							</div>
							<button
								class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
								onclick={() => removeFromQueue(t)}
							>
								<i class="ri-close-line"></i>
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<div
		class="fixed right-0 bottom-0 left-0 z-50 border-t border-white/10 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-lg transition-transform duration-300 ease-in-out"
	>
		<div class="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row">
			<!-- Track Info -->
			<div
				class="flex w-full items-center justify-between gap-3 sm:w-1/4 sm:min-w-[150px] sm:justify-start"
			>
				{#if track.image_url}
					<img
						src={track.image_url}
						alt={track.title}
						class="h-10 w-10 rounded bg-gray-800 object-cover shadow-lg sm:h-12 sm:w-12"
					/>
				{:else}
					<div
						class="flex h-10 w-10 items-center justify-center rounded bg-gray-800 sm:h-12 sm:w-12"
					>
						<i class="ri-music-fill text-xl text-gray-400"></i>
					</div>
				{/if}
				<div class="min-w-0 flex-1 overflow-hidden">
					<h3 class="truncate text-sm font-bold text-white">{track.title}</h3>
					<p class="truncate text-xs text-gray-400">
						{track.model_name === 'chirp-crow' ? 'V5' : track.model_name || 'Unknown Model'}
					</p>
				</div>
				<!-- Like/Dislike/Add Buttons -->
				<div class="flex items-center gap-4">
					<button
						class="transition-colors {$userReactions[track.id] === 'like'
							? 'text-green-400'
							: 'text-gray-400 hover:text-green-400'}"
						title="Like"
						onclick={() => toggleReaction(track.id, 'like')}
					>
						<i class={$userReactions[track.id] === 'like' ? 'ri-thumb-up-fill' : 'ri-thumb-up-line'}
						></i>
					</button>
					<button
						class="transition-colors {$userReactions[track.id] === 'dislike'
							? 'text-red-400'
							: 'text-gray-400 hover:text-red-400'}"
						title="Dislike"
						onclick={() => toggleReaction(track.id, 'dislike')}
					>
						<i
							class={$userReactions[track.id] === 'dislike'
								? 'ri-thumb-down-fill'
								: 'ri-thumb-down-line'}
						></i>
					</button>
					<button
						class="transition-colors {isInPlaylist(track.id)
							? 'text-green-400'
							: 'text-gray-400 hover:text-purple-400'}"
						title={isInPlaylist(track.id) ? 'In Playlist' : 'Add to Playlist'}
						onclick={() => {
							showPlaylistModal = true;
						}}
					>
						<i class={isInPlaylist(track.id) ? 'ri-play-list-add-fill' : 'ri-play-list-add-line'}
						></i>
					</button>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex w-full flex-1 flex-col items-center gap-2 sm:gap-1">
				<div class="flex items-center gap-4">
					<button
						class="cursor-pointer text-gray-400 transition-colors hover:text-white"
						onclick={shuffleQueue}
						title="Shuffle"
					>
						<i class="ri-shuffle-line text-lg"></i>
					</button>
					<button
						class="cursor-pointer text-gray-400 transition-colors hover:text-white"
						onclick={playPrevious}
						aria-label="Previous Track"
					>
						<i class="ri-skip-back-fill text-xl"></i>
					</button>
					<button
						onclick={togglePlay}
						class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-purple-900 shadow-lg transition-transform hover:scale-105"
						aria-label={playing ? 'Pause' : 'Play'}
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
						aria-label="Next Track"
					>
						<i class="ri-skip-forward-fill text-xl"></i>
					</button>
					<div class="w-6"></div>
				</div>

				<!-- Visualizer -->
				<canvas bind:this={canvas} width="400" height="20" class="w-full max-w-md opacity-80"
				></canvas>

				<!-- Progress Bar -->
				<div class="flex w-full max-w-md items-center gap-2 text-xs text-gray-400">
					<span>{formatTime(currentTime)}</span>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="group relative h-1 flex-1 cursor-pointer rounded-full bg-white/10"
						onclick={handleSeek}
						role="slider"
						aria-label="Seek"
						aria-valuenow={progress}
						aria-valuemin="0"
						aria-valuemax="100"
						tabindex="0"
						onkeydown={(e) => {
							if (!audio) return;
							if (e.key === 'ArrowRight') audio.currentTime += 5;
							if (e.key === 'ArrowLeft') audio.currentTime -= 5;
						}}
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
			<div class="flex w-full items-center justify-between gap-3 sm:w-1/4 sm:justify-end">
				<div class="flex items-center gap-2">
					<button
						onclick={toggleMute}
						class="flex w-8 cursor-pointer justify-center text-gray-400 transition-colors hover:text-white"
						aria-label={muted ? 'Unmute' : 'Mute'}
					>
						{#if muted || volume === 0}
							<i class="ri-volume-mute-line text-lg"></i>
						{:else if volume < 0.5}
							<i class="ri-volume-down-line text-lg"></i>
						{:else}
							<i class="ri-volume-up-line text-lg"></i>
						{/if}
					</button>

					<div class="group relative flex h-1 w-24 items-center rounded-full bg-white/10">
						<div
							class="absolute h-full rounded-full bg-white transition-all group-hover:bg-purple-400"
							style="width: {volume * 100}%"
						></div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={volume}
							oninput={handleVolumeChange}
							class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
						/>
					</div>
				</div>

				<div class="mx-2 h-4 w-px bg-white/10"></div>

				<button
					onclick={toggleQueue}
					class="cursor-pointer transition-colors {showQueue
						? 'text-purple-400'
						: 'text-gray-400 hover:text-white'}"
					title="Queue"
				>
					<i class="ri-play-list-line text-lg"></i>
				</button>

				<button
					onclick={handleDownload}
					class="cursor-pointer text-gray-400 transition-colors hover:text-white"
					title="Download"
				>
					<i class="ri-download-line text-lg"></i>
				</button>
				<button
					onclick={closePlayer}
					class="cursor-pointer text-gray-400 transition-colors hover:text-red-400"
					title="Close"
				>
					<i class="ri-close-line text-xl"></i>
				</button>
			</div>
		</div>

		<audio
			bind:this={audio}
			bind:volume
			bind:muted
			crossorigin="anonymous"
			src={track.audio_url || track.stream_audio_url}
			ontimeupdate={handleTimeUpdate}
			onloadedmetadata={handleLoadedMetadata}
			onended={handleEnded}
			class="hidden"
		></audio>
	</div>
{/if}
