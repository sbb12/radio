<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import PocketBase from 'pocketbase';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import 'remixicon/fonts/remixicon.css';

	let { data } = $props();
	let track = $state<any>(null);
	let nextTrack = $state<any>(null);
	let activeRequest = $state(false);
	let user = $state(data.user);
	let generationPrompt = $state('');
	let instrumental = $state(false);
	let roomId = $state<string | null>(null);
	let promptUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

	let audioElement: HTMLAudioElement | null = null;
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(1);
	let isLoading = $state(false);
	let pb = $state<PocketBase | null>(null);
	let shouldAutoPlay = $state(false);
	let isUserActive = $state(true);
	let lastActivityTime = $state(Date.now());
	let inactivityCheckInterval: ReturnType<typeof setInterval> | null = null;
	let activityUpdateHandler: (() => void) | null = null;
	let isUpdatingPrompt = $state(false);
	let isUpdatingInstrumental = $state(false);
	let currentStart = $state<string | null>(null);
	let disableGenerate = $state(false);
	let allTracks = $state<any[]>([]);
	let isLoadingTracks = $state(false);
	let searchQuery = $state('');

	// Filtered tracks based on search
	let filteredTracks = $derived(
		searchQuery.trim() === ''
			? allTracks
			: allTracks.filter((song) => {
					const query = searchQuery.toLowerCase();
					return (
						song.title?.toLowerCase().includes(query) ||
						song.tags?.toLowerCase().includes(query) ||
						song.prompt?.toLowerCase().includes(query)
					);
				})
	);

	onMount(async () => {
		// Load volume from localStorage
		if (browser) {
			const savedVolume = localStorage.getItem('radio-volume');
			if (savedVolume) {
				const parsedVolume = parseFloat(savedVolume);
				if (!isNaN(parsedVolume) && parsedVolume >= 0 && parsedVolume <= 1) {
					volume = parsedVolume;
				}
			}
		}

		// Initialize audio element once
		if (browser) {
			initializeAudioElement();
		}

		// Use PUBLIC_POCKETBASE_URL if available, otherwise fallback to hardcoded URL
		const pbUrl = (browser && env.PUBLIC_POCKETBASE_URL) || 'https://pb.sercan.co.uk';
		pb = new PocketBase(pbUrl);

		// Track user activity
		const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
		activityUpdateHandler = () => {
			lastActivityTime = Date.now();
			isUserActive = true;
		};

		activityEvents.forEach((event) => {
			window.addEventListener(event, activityUpdateHandler!, { passive: true });
		});

		// Check for inactivity every 30 seconds
		// User is considered inactive after 60 minutes of no activity
		inactivityCheckInterval = setInterval(() => {
			const timeSinceLastActivity = Date.now() - lastActivityTime;
			if (timeSinceLastActivity > 60 * 60 * 1000) {
				// 60 minutes
				isUserActive = false;
			}
		}, 30000); // Check every 30 seconds

		const room = await pb.collection('radio_rooms').getOne('corxga7q86bsc0s', {
			expand: 'current_track,next_track,active_request'
		});

		roomId = room.id;

		if (room.expand?.current_track) {
			track = room.expand.current_track;
			// Update audio source for initial track
			updateAudioSource();
		}
		if (room.expand?.next_track) {
			nextTrack = room.expand.next_track;
		}
		activeRequest = room.active_request || false;
		generationPrompt = room.prompt || '';
		instrumental = room.instrumental || false;
		currentStart = room.current_start || null;
		disableGenerate = room.disable_generate || false;

		// Subscribe to changes only in the specified record
		pb.collection('radio_rooms').subscribe(
			'corxga7q86bsc0s',
			function (e) {
				const currentTrack = e.record.expand?.current_track;
				const newNextTrack = e.record.expand?.next_track;
				const newActiveRequest = e.record.active_request || false;
				const newPrompt = e.record.prompt || '';
				const newInstrumental = e.record.instrumental || false;
				const newCurrentStart = e.record.current_start || null;
				const newDisableGenerate = e.record.disable_generate || false;

				// Update next track and active request status
				nextTrack = newNextTrack || null;
				activeRequest = newActiveRequest;
				currentStart = newCurrentStart;
				disableGenerate = newDisableGenerate;

				// Update prompt and instrumental from room (only if changed externally and we're not currently updating)
				if (!isUpdatingPrompt && newPrompt !== generationPrompt) {
					generationPrompt = newPrompt;
				}
				if (!isUpdatingInstrumental && newInstrumental !== instrumental) {
					instrumental = newInstrumental;
				}

				// Handle current track change
				if (currentTrack && currentTrack.track_id !== track?.track_id) {
					shouldAutoPlay = true;
					track = currentTrack;
					// Update audio source when track changes
					updateAudioSource();
				}

				// handle current track switch to audio url from stream url
				if (
					currentTrack &&
					currentTrack.stream_audio_url &&
					currentTrack.audio_url !== track?.audio_url
				) {
					shouldAutoPlay = true;
					track = currentTrack;
					// Update audio source when track changes
					updateAudioSource();
				}
			},
			{
				expand: 'current_track,next_track,active_request'
			}
		);

		// Load all tracks
		loadAllTracks();
	});

	onDestroy(async () => {
		if (promptUpdateTimeout) {
			clearTimeout(promptUpdateTimeout);
		}
		// Clean up activity listeners and intervals
		if (activityUpdateHandler) {
			const activityEvents = [
				'mousedown',
				'mousemove',
				'keypress',
				'scroll',
				'touchstart',
				'click'
			];
			activityEvents.forEach((event) => {
				window.removeEventListener(event, activityUpdateHandler!);
			});
		}
		if (inactivityCheckInterval) {
			clearInterval(inactivityCheckInterval);
		}
		// Clean up audio element
		if (audioElement) {
			audioElement.pause();
			audioElement.src = '';
			audioElement = null;
		}
		pb?.collection('radio_rooms').unsubscribe('corxga7q86bsc0s');
	});

	// Get user from page data
	$effect(() => {
		user = $page.data.user;
	});

	// Initialize audio element once
	function initializeAudioElement() {
		if (typeof document === 'undefined' || audioElement) return;

		audioElement = new Audio();
		audioElement.volume = volume;

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
			shouldAutoPlay = true;
			handleTrackPlay();
		});

		audioElement.addEventListener('pause', () => {
			isPlaying = false;
			shouldAutoPlay = false;
			handleTrackPause();
		});

		audioElement.addEventListener('loadstart', () => {
			isLoading = true;
		});

		audioElement.addEventListener('canplay', () => {
			isLoading = false;
			// Auto-play when audio is ready if flag is set
			if (shouldAutoPlay && audioElement) {
				// Calculate elapsed time since current_start and skip to that position
				if (currentStart && duration > 0) {
					const startTime = new Date(currentStart).getTime();
					const now = Date.now();
					const elapsedSeconds = (now - startTime) / 1000;

					// Only skip if elapsed time is positive and less than duration
					if (elapsedSeconds > 0 && elapsedSeconds < duration) {
						audioElement.currentTime = elapsedSeconds;
						currentTime = elapsedSeconds;
					}
				}
				audioElement.play().catch((err) => {
					console.error('Auto-play error:', err);
				});
				shouldAutoPlay = false;
			}
		});
	}

	// Update audio source when track changes
	function updateAudioSource() {
		if (!audioElement) {
			initializeAudioElement();
		}

		if (!audioElement) return;

		if (track?.audio_url || track?.stream_audio_url) {
			// Reset audio state
			isPlaying = false;
			currentTime = 0;
			duration = 0;
			isLoading = false;

			// Update the source
			audioElement.pause();
			audioElement.src = track.audio_url || track.stream_audio_url;
			audioElement.load();
		} else {
			audioElement.pause();
			audioElement.src = '';
		}
	}

	function togglePlay() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			// Calculate elapsed time since current_start and skip to that position when play is pressed
			if (currentStart && duration > 0) {
				const startTime = new Date(currentStart).getTime();
				const now = Date.now();
				const elapsedSeconds = (now - startTime) / 1000;

				// Only skip if elapsed time is positive and less than duration
				if (elapsedSeconds > 0 && elapsedSeconds < duration) {
					audioElement.currentTime = elapsedSeconds;
					currentTime = elapsedSeconds;
				}
			}
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
		const newVolume = parseFloat(target.value) / 100;
		volume = newVolume;
		audioElement.volume = newVolume;
		// Save to localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem('radio-volume', newVolume.toString());
		}
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
		// Only auto-advance if user is active
		if (isUserActive) {
			handleAdvanceTrack();
		} else {
			console.log('User inactive, skipping auto-advance');
		}
		// Add your end handling logic here
	}

	function handleTrackPlay() {
		console.log('Track playing');
		// Add your play handling logic here
	}

	async function handleAdvanceTrack() {
		await fetch('/api/room/advance', { method: 'POST' });
	}

	// Update room prompt with debouncing
	async function updateRoomPrompt() {
		if (!pb || !roomId) return;

		// Clear existing timeout
		if (promptUpdateTimeout) {
			clearTimeout(promptUpdateTimeout);
		}

		// Debounce the update
		const currentPb = pb;
		const currentRoomId = roomId;
		const currentPrompt = generationPrompt;
		promptUpdateTimeout = setTimeout(async () => {
			if (!currentPb || !currentRoomId) return;
			try {
				isUpdatingPrompt = true;
				await currentPb.collection('radio_rooms').update(currentRoomId, {
					prompt: currentPrompt
				});
				// Reset flag after a short delay to allow subscription to process
				setTimeout(() => {
					isUpdatingPrompt = false;
				}, 100);
			} catch (err) {
				console.error('Error updating room prompt:', err);
				isUpdatingPrompt = false;
			}
		}, 500); // Wait 500ms after user stops typing
	}

	// Update room instrumental setting
	async function updateRoomInstrumental() {
		if (!pb || !roomId) return;

		try {
			isUpdatingInstrumental = true;
			await pb.collection('radio_rooms').update(roomId, {
				instrumental: instrumental
			});
			// Reset flag after a short delay to allow subscription to process
			setTimeout(() => {
				isUpdatingInstrumental = false;
			}, 100);
		} catch (err) {
			console.error('Error updating room instrumental:', err);
			isUpdatingInstrumental = false;
		}
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			await goto('/login');
		} catch (err) {
			console.error('Logout error:', err);
		}
	}

	async function loadAllTracks() {
		if (!browser) return;

		isLoadingTracks = true;
		try {
			const response = await fetch('/api/music/tracks?perPage=100');
			const data = await response.json();
			if (data.tracks) {
				allTracks = data.tracks;
			}
		} catch (err) {
			console.error('Error loading tracks:', err);
		} finally {
			isLoadingTracks = false;
		}
	}

	async function handlePlayTrack(selectedTrack: any) {
		if (!selectedTrack || !selectedTrack.id) return;

		try {
			const response = await fetch('/api/room/play', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ trackId: selectedTrack.id })
			});

			if (!response.ok) {
				const error = await response.json();
				console.error('Error playing track:', error);
			}
			// The track will be updated via the subscription
		} catch (err) {
			console.error('Error playing track:', err);
		}
	}
</script>

<div
	class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-7xl">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
			<!-- All Songs List - Left Tile -->
			<div class="order-2 flex max-h-full flex-col rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg lg:order-1">
				<h2 class="mb-4 text-2xl font-bold text-white">All Songs</h2>

				<!-- Search Input -->
				<div class="mb-4">
					<div class="relative">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search songs..."
							class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 pl-10 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
						/>
						<!-- Search icon -->
						<i class="ri-search-line absolute left-3 top-2 h-5 w-5 text-gray-400"></i>
						{#if searchQuery}
							<button
								onclick={() => (searchQuery = '')}
								aria-label="Clear search"
								class="absolute top-2 right-3 text-gray-400 hover:text-white"
							>
								<i class="ri-close-line h-5 w-5"></i>
							</button>
						{/if}
					</div>
				</div>

				{#if isLoadingTracks}
					<div class="flex flex-1 items-center justify-center py-8">
						<i class="ri-loader-4-line h-8 w-8 animate-spin text-purple-500"></i>
					</div>
				{:else if filteredTracks.length === 0}
					<div class="flex flex-1 items-center justify-center py-8">
						<p class="text-center text-sm text-gray-400">
							{searchQuery ? 'No songs found matching your search' : 'No songs available'}
						</p>
					</div>
				{:else}
					<div class="songs-scrollable flex-1 space-y-2 overflow-y-auto pr-2 max-h-[80vh]">
						{#each filteredTracks as song (song.id)}
							<button
								onclick={() => handlePlayTrack(song)}
								class="w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/10 {track?.id === song.id ? 'border-purple-500 bg-purple-500/20' : ''}"
							>
								<div class="flex items-center gap-3">
									{#if song.image_url}
										<img
											src={song.image_url}
											alt={song.title}
											class="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
										/>
									{:else}
										<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600">
											<i class="ri-music-2-line h-6 w-6 text-white/50"></i>
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<h3 class="truncate text-sm font-semibold text-white">
												{song.title || 'Untitled'}
											</h3>
											{#if track?.id === song.id}
												<i class="ri-play-circle-fill h-4 w-4 flex-shrink-0 text-purple-400"></i>
											{/if}
										</div>
										{#if song.tags}
											<p class="mt-1 truncate text-xs text-gray-400">{song.tags}</p>
										{/if}
										<div class="mt-1 flex items-center gap-3 text-xs text-gray-500">
											{#if song.duration}
												<span>{formatTime(song.duration)}</span>
											{/if}
										</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Main Radio Controls - Right Tile -->
			<div class="order-1 h-fit lg:col-span-2 lg:order-2">
				<div class="flex h-full flex-col rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
					<!-- Header -->
					<div class="mb-8 flex items-center justify-between">
						<div>
							<h1 class="mb-2 text-4xl font-bold text-white">Surgo Radio</h1>
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
									<i class="ri-music-2-line text-6xl text-white/50"></i>
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

						<!-- Next Track Status -->
						<div class="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<h3 class="mb-2 text-sm font-semibold tracking-wide text-gray-400 uppercase">
										Next Track Status
									</h3>
									{#if nextTrack}
										<div class="flex items-center gap-3">
											<div class="flex h-3 w-3 items-center justify-center">
												<div class="h-2 w-2 rounded-full bg-green-500"></div>
											</div>
											<div class="flex-1">
												<p class="font-semibold text-white">{nextTrack.title}</p>
												<p class="text-sm text-gray-400">Ready to play</p>
											</div>
										</div>
									{:else if activeRequest}
										<div class="flex items-center gap-3">
											<div class="flex h-3 w-3 items-center justify-center">
												<i class="ri-loader-4-line h-3 w-3 animate-spin text-yellow-500"></i>
											</div>
											<div class="flex-1">
												<p class="font-semibold text-white">Generating next track...</p>
												<p class="text-sm text-gray-400">Please wait</p>
											</div>
										</div>
									{:else}
										<div class="flex items-center gap-3">
											<div class="flex h-3 w-3 items-center justify-center">
												<div class="h-2 w-2 rounded-full bg-gray-500"></div>
											</div>
											<div class="flex-1">
												<p class="font-semibold text-white">No next track</p>
												<p class="text-sm text-gray-400">Waiting for generation</p>
											</div>
										</div>
									{/if}
								</div>
								{#if nextTrack}
									<button
										onclick={handleAdvanceTrack}
										class="cursor-pointer rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-pink-700 focus:ring-2 focus:ring-purple-500 focus:outline-none"
									>
										Skip
									</button>
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
										<i class="ri-loader-4-line text-3xl animate-spin"></i>
									{:else if isPlaying}
										<i class="ri-pause-fill text-3xl"></i>
									{:else}
										<i class="ri-play-fill ml-1 text-3xl"></i>
									{/if}
								</button>

								<!-- Volume Control -->
								<div class="flex items-center space-x-2">
									<i class="ri-volume-up-line text-2xl text-gray-300"></i>
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

					{#if disableGenerate}
						<!-- Replay Mode Message -->
						<div class="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
							<div class="flex items-center gap-3">
								<i class="ri-refresh-line text-2xl text-purple-400"></i>
								<div>
									<h2 class="text-xl font-bold text-white">Replay Mode</h2>
									<p class="mt-1 text-sm text-gray-300">
										Generation is disabled. The radio is replaying random "lofi" songs from the existing
										collection.
									</p>
								</div>
							</div>
						</div>
					{:else}
						<!-- Generation Prompt Box -->
						<div class="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
							<h2 class="mb-4 text-2xl font-bold text-white">Generation Prompt</h2>
							<div class="space-y-4">
								<div>
									<label for="prompt" class="mb-2 block text-sm font-medium text-gray-300">
										Enter a prompt for the next generated song
									</label>
									<p class="mb-3 text-xs text-gray-400">
										This prompt will be used when generating the next new song. If there's already a
										song queued up, this will apply to the song generated after that.
									</p>
									<textarea
										id="prompt"
										bind:value={generationPrompt}
										oninput={updateRoomPrompt}
										placeholder="e.g., A upbeat electronic dance track with catchy melodies..."
										rows="3"
										maxlength="500"
										class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
									></textarea>
									<p class="mt-1 text-xs text-gray-400">
										{generationPrompt.length}/500 characters
									</p>
								</div>

								<div class="flex items-center gap-3">
									<label class="flex cursor-pointer items-center gap-2">
										<input
											type="checkbox"
											bind:checked={instrumental}
											onchange={updateRoomInstrumental}
											class="h-5 w-5 cursor-pointer rounded border-white/20 bg-white/10 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0"
										/>
										<span class="text-sm font-medium text-gray-300">Instrumental</span>
									</label>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.songs-scrollable::-webkit-scrollbar {
		width: 8px;
	}

	.songs-scrollable::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.songs-scrollable::-webkit-scrollbar-thumb {
		background: linear-gradient(to bottom, rgba(147, 51, 234, 0.6), rgba(219, 39, 119, 0.6));
		border-radius: 4px;
	}

	.songs-scrollable::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(to bottom, rgba(147, 51, 234, 0.8), rgba(219, 39, 119, 0.8));
	}

	/* Firefox scrollbar */
	.songs-scrollable {
		scrollbar-width: thin;
		scrollbar-color: rgba(147, 51, 234, 0.6) rgba(255, 255, 255, 0.05);
	}
</style>
