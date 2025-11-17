<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import PocketBase from 'pocketbase';
	import { onDestroy, onMount } from 'svelte';

	let { data } = $props();
	let track = $state<any>(null);
	let user = $state(data.user);
	let generationPrompt = $state('');

	let audioElement: HTMLAudioElement | null = null;
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(1);
	let isLoading = $state(false);
	let pb = $state<PocketBase | null>(null);

	onMount(async () => {
		pb = new PocketBase('https://pb.sercan.co.uk');

		const room = await pb.collection('radio_rooms').getOne('corxga7q86bsc0s', {
			expand: 'current_track,next_track,active_request'
		});

		if (room.expand?.current_track) {
			track = room.expand.current_track;

			if (!room.expand?.next_track) {
				handleAdvanceTrack();
			}
		}

		// Subscribe to changes only in the specified record
		pb.collection('radio_rooms').subscribe('corxga7q86bsc0s',
			function (e) {
				console.log(e.action);
				console.log(e.record);

				const currentTrack = e.record.expand?.current_track;
				if (currentTrack && currentTrack.track_id !== track?.track_id) {
					track = currentTrack;
				}
			},
			{
				expand: 'current_track,next_track,active_request'
			}
		);
	});
	onDestroy(async () => {
		pb?.collection('radio_rooms').unsubscribe('corxga7q86bsc0s');
	});

	// Get user from page data
	$effect(() => {
		user = $page.data.user;
	});

	// Reset audio state when track changes
	$effect(() => {
		if (track) {
			isPlaying = false;
			currentTime = 0;
			duration = 0;
			isLoading = false;
		}
	});

	// Initialize audio element
	$effect(() => {
		// Clean up previous audio element if track changes or becomes null
		if (audioElement) {
			audioElement.pause();
			audioElement = null;
		}

		if (track?.audio_url && typeof document !== 'undefined') {
			audioElement = new Audio(track.audio_url);

			audioElement.addEventListener('loadedmetadata', () => {
				duration = audioElement?.duration || 0;
			});

			audioElement.addEventListener('timeupdate', () => {
				currentTime = audioElement?.currentTime || 0;
			});

			audioElement.addEventListener('ended', () => {
				isPlaying = false;
				currentTime = 0;
				handleTrackEnded();
			});

			audioElement.addEventListener('play', () => {
				isPlaying = true;
				handleTrackPlay();
			});

			audioElement.addEventListener('pause', () => {
				isPlaying = false;
				handleTrackPause();
			});

			audioElement.addEventListener('loadstart', () => {
				isLoading = true;
			});

			audioElement.addEventListener('canplay', () => {
				isLoading = false;
			});

			return () => {
				audioElement?.pause();
				audioElement = null;
			};
		}
	});

	$effect(() => {
		if (audioElement) {
			audioElement.volume = volume;
		}
	});

	function togglePlay() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			audioElement.play().catch((err) => {
				console.error('Play error:', err);
			});
		}
	}

	function handleSeek(event: Event) {
		if (!audioElement) return;
		const target = event.target as HTMLInputElement;
		const newTime = (parseFloat(target.value) / 100) * duration;
		audioElement.currentTime = newTime;
		currentTime = newTime;
	}

	function handleVolumeChange(event: Event) {
		if (!audioElement) return;
		const target = event.target as HTMLInputElement;
		volume = parseFloat(target.value) / 100;
		audioElement.volume = volume;
	}

	function formatTime(seconds: number): string {
		if (isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Event handlers for pause and end - customize these as needed
	function handleTrackPause() {
		console.log('Track paused at', currentTime);
		// Add your pause handling logic here
	}

	function handleTrackEnded() {
		console.log('Track ended');
		// Add your end handling logic here
	}

	function handleTrackPlay() {
		console.log('Track playing');
		// Add your play handling logic here
	}

	async function handleAdvanceTrack() {
		await fetch('/api/room/advance', { method: 'POST' });
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			await goto('/login');
		} catch (err) {
			console.error('Logout error:', err);
		}
	}
</script>

<div
	class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-4xl">
		<div class="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
			<!-- Header -->
			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 text-4xl font-bold text-white">Live Radio</h1>
					<p class="text-gray-300">Now Playing</p>
				</div>
				{#if user}
					<div class="flex items-center space-x-4">
						<span class="text-sm text-gray-300">{user.email}</span>
						<button
							onclick={handleLogout}
							class="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20 focus:ring-2 focus:ring-purple-500 focus:outline-none"
						>
							Logout
						</button>
					</div>
				{/if}
			</div>

			{#if track}
				<!-- Track Info -->
				<div class="mb-8 flex flex-col gap-6 md:flex-row">
					{#if track.image_url}
						<img
							src={track.image_url}
							alt={track.title}
							class="h-64 w-full rounded-lg object-cover shadow-lg md:w-64"
						/>
					{:else}
						<div
							class="flex h-64 w-full items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg md:w-64"
						>
							<svg class="h-24 w-24 text-white/50" fill="currentColor" viewBox="0 0 20 20">
								<path
									d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"
								/>
							</svg>
						</div>
					{/if}

					<div class="flex-1">
						<h2 class="mb-2 text-3xl font-bold text-white">{track.title}</h2>
						{#if track.tags}
							<p class="mb-2 text-gray-300">Tags: {track.tags}</p>
						{/if}
						{#if track.model_name}
							<p class="mb-2 text-sm text-gray-400">Model: {track.model_name}</p>
						{/if}
						{#if track.prompt}
							<p class="mt-4 line-clamp-3 text-sm text-gray-300">{track.prompt}</p>
						{/if}
						{#if track.create_time}
							<p class="mt-4 text-xs text-gray-400">Created: {track.create_time}</p>
						{/if}
					</div>
				</div>

				<!-- Audio Player -->
				<div class="space-y-4">
					<!-- Progress Bar -->
					<div class="space-y-2">
						<input
							type="range"
							min="0"
							max="100"
							value={duration > 0 ? (currentTime / duration) * 100 : 0}
							oninput={handleSeek}
							class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-purple-600"
						/>
						<div class="flex justify-between text-xs text-gray-400">
							<span>{formatTime(currentTime)}</span>
							<span>{formatTime(duration)}</span>
						</div>
					</div>

					<!-- Controls -->
					<div class="flex items-center justify-center space-x-6">
						<!-- Play/Pause Button -->
						<button
							onclick={togglePlay}
							disabled={isLoading}
							class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transition-all duration-200 hover:from-purple-700 hover:to-pink-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isLoading}
								<svg class="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							{:else if isPlaying}
								<svg class="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
										clip-rule="evenodd"
									/>
								</svg>
							{:else}
								<svg class="ml-1 h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
									/>
								</svg>
							{/if}
						</button>

						<!-- Volume Control -->
						<div class="flex items-center space-x-2">
							<svg class="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4-3.617a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
									clip-rule="evenodd"
								/>
							</svg>
							<input
								type="range"
								min="0"
								max="100"
								value={volume * 100}
								oninput={handleVolumeChange}
								class="h-2 w-24 cursor-pointer appearance-none rounded-lg bg-white/20 accent-purple-600"
							/>
						</div>
					</div>
				</div>
			{/if}

			<!-- Generation Prompt Box -->
			<div class="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
				<h2 class="mb-4 text-2xl font-bold text-white">Generation Prompt</h2>
				<div>
					<label for="prompt" class="mb-2 block text-sm font-medium text-gray-300">
						Enter a prompt for the next song
					</label>
					<textarea
						id="prompt"
						bind:value={generationPrompt}
						placeholder="e.g., A upbeat electronic dance track with catchy melodies..."
						rows="3"
						maxlength="500"
						class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
					></textarea>
					<p class="mt-1 text-xs text-gray-400">
						{generationPrompt.length}/500 characters
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
