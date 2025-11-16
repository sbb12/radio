<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();
	let track = $state(data.track);
	let user = $state(data.user);
	let error = $state(data.error);

	let audioElement: HTMLAudioElement | null = null;
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(1);
	let isLoading = $state(false);

	// Get user from page data
	$effect(() => {
		user = $page.data.user;
		track = $page.data.track;
		error = $page.data.error;
	});

	// Initialize audio element
	$effect(() => {
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
			});

			audioElement.addEventListener('play', () => {
				isPlaying = true;
			});

			audioElement.addEventListener('pause', () => {
				isPlaying = false;
			});

			audioElement.addEventListener('loadstart', () => {
				isLoading = true;
			});

			audioElement.addEventListener('canplay', () => {
				isLoading = false;
			});

			audioElement.volume = volume;

			return () => {
				audioElement?.pause();
				audioElement = null;
			};
		}
	});

	function togglePlay() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			audioElement.play().catch((err) => {
				console.error('Play error:', err);
				error = 'Failed to play audio';
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

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			await goto('/login');
		} catch (err) {
			console.error('Logout error:', err);
		}
	}

	function refreshTrack() {
		window.location.reload();
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-4xl mx-auto">
		<div class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
			<!-- Header -->
			<div class="flex justify-between items-center mb-8">
				<div>
					<h1 class="text-4xl font-bold text-white mb-2">Live Radio</h1>
					<p class="text-gray-300">Now Playing</p>
				</div>
				{#if user}
					<div class="flex items-center space-x-4">
						<span class="text-gray-300 text-sm">{user.email}</span>
						<button
							onclick={handleLogout}
							class="px-4 py-2 bg-white/10 text-white text-sm font-semibold rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
						>
							Logout
						</button>
					</div>
				{/if}
			</div>

			{#if error}
				<div class="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
					<p class="text-red-200 text-lg mb-4">{error}</p>
					<button
						onclick={refreshTrack}
						class="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all duration-200"
					>
						Refresh
					</button>
				</div>
			{:else if track}
				<!-- Track Info -->
				<div class="flex flex-col md:flex-row gap-6 mb-8">
					{#if track.image_url}
						<img
							src={track.image_url}
							alt={track.title}
							class="w-full md:w-64 h-64 object-cover rounded-lg shadow-lg"
						/>
					{:else}
						<div class="w-full md:w-64 h-64 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow-lg flex items-center justify-center">
							<svg class="w-24 h-24 text-white/50" fill="currentColor" viewBox="0 0 20 20">
								<path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
							</svg>
						</div>
					{/if}

					<div class="flex-1">
						<h2 class="text-3xl font-bold text-white mb-2">{track.title}</h2>
						{#if track.tags}
							<p class="text-gray-300 mb-2">Tags: {track.tags}</p>
						{/if}
						{#if track.model_name}
							<p class="text-gray-400 text-sm mb-2">Model: {track.model_name}</p>
						{/if}
						{#if track.prompt}
							<p class="text-gray-300 text-sm mt-4 line-clamp-3">{track.prompt}</p>
						{/if}
						{#if track.create_time}
							<p class="text-gray-400 text-xs mt-4">Created: {track.create_time}</p>
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
							class="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600"
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
							class="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center justify-center hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
						>
							{#if isLoading}
								<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else if isPlaying}
								<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
								</svg>
							{:else}
								<svg class="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 20 20">
									<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
								</svg>
							{/if}
						</button>

						<!-- Volume Control -->
						<div class="flex items-center space-x-2">
							<svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4-3.617a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
							</svg>
							<input
								type="range"
								min="0"
								max="100"
								value={volume * 100}
								oninput={handleVolumeChange}
								class="w-24 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600"
							/>
						</div>

						<!-- Refresh Button -->
						<button
							onclick={refreshTrack}
							class="px-4 py-2 bg-white/10 text-white text-sm font-semibold rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
							title="Refresh to get latest track"
						>
							<svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
							Refresh
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

