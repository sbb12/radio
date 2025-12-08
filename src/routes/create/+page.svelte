<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import 'remixicon/fonts/remixicon.css';
	import { currentTrack, isPlaying, queue } from '$lib/stores';
	import { addToPlaylist, removeFromPlaylist } from '$lib/stores/trackActions';
	import {
		playlists,
		addPlaylistToStore,
		updatePlaylistInStore,
		removePlaylistFromStore
	} from '$lib/stores/playlists';
	import { getPocketBase } from '$lib/pocketbase';
	import type PocketBase from 'pocketbase';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	import SongList from '$lib/components/SongList.svelte';

	let { data } = $props();
	let user = $derived(data.user);
	let tracks = $state(data.tracks || []);
	$effect(() => {
		if (data.tracks) {
			tracks = data.tracks;
		}
	});
	let showPlaylistModal = $state(false);
	let selectedTrackForPlaylist: any = $state(null);

	// Generation form state
	let prompt = $state('');
	let lyrics = $state('');
	let customMode = $state(false);
	let instrumental = $state(false);
	let model = $state('V5');
	let style = $state('');
	let title = $state('');
	let vocalGender = $state<string>('');
	let styleWeight = $state<number | undefined>(undefined);
	let weirdnessConstraint = $state<number | undefined>(0.2);
	let audioWeight = $state<number | undefined>(undefined);
	let negativeTags = $state('');
	let enhancePrompt = $state(false);

	// UI state
	let isGenerating = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let generatingPlaceholder = $state<any>(null);

	// Available models
	const models = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V5'];
	let pb: PocketBase;

	onMount(async () => {
		pb = await getPocketBase();

		// Load prompt from localStorage
		const savedPrompt = localStorage.getItem('create_prompt');
		if (savedPrompt) {
			prompt = savedPrompt;
		}

		// Load instrumental from localStorage
		const savedInstrumental = localStorage.getItem('create_instrumental');
		if (savedInstrumental) {
			instrumental = savedInstrumental === 'true';
		}

		// Subscribe to tracks collection
		pb.collection('radio_music_tracks').subscribe('*', function (e) {
			// Only handle events for the current user's tracks
			if (data.user && e.record.user !== data.user.id) return;

			if (e.action === 'create') {
				// Add new track to the top of the list
				const newTrack = {
					...e.record,
					title: e.record.title || 'Untitled'
				};
				tracks = [newTrack, ...tracks];
				// Remove placeholder if it exists
				generatingPlaceholder = null;
			} else if (e.action === 'update') {
				if (e.record.deleted) {
					tracks = tracks.filter((t) => t.id !== e.record.id);
				} else {
					// Update existing track
					tracks = tracks.map((t) => {
						if (t.id === e.record.id) {
							return {
								...e.record,
								title: e.record.title || 'Untitled'
							};
						}
						return t;
					});
				}
			} else if (e.action === 'delete') {
				tracks = tracks.filter((t) => t.id !== e.record.id);
			}
		});

		// Subscribe to playlists collection
		pb.collection('radio_playlists').subscribe('*', function (e) {
			if (data.user && e.record.user !== data.user.id) return;

			if (e.action === 'create') {
				addPlaylistToStore(e.record);
			} else if (e.action === 'update') {
				updatePlaylistInStore(e.record);
			} else if (e.action === 'delete') {
				removePlaylistFromStore(e.record.id);
			}
		});
	});

	$effect(() => {
		if (prompt) {
			localStorage.setItem('create_prompt', prompt);
		}
		localStorage.setItem('create_instrumental', String(instrumental));
	});

	$effect(() => {
		if (data.playlists) {
			playlists.set(data.playlists);
		}
	});

	onDestroy(() => {
		if (pb) {
			pb.collection('radio_music_tracks').unsubscribe();
			pb.collection('radio_playlists').unsubscribe();
		}
	});

	async function handleGenerate(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		success = null;
		isGenerating = true;

		// Set placeholder immediately
		generatingPlaceholder = {
			id: 'generating',
			title: customMode ? title : 'Untitled',
			model_name: model,
			tags: customMode ? style : prompt,
			image_url: null,
			status: 'generating'
		};

		try {
			const requestBody: any = {
				customMode,
				instrumental,
				model,
				enhance: enhancePrompt
			};

			if (customMode) {
				if (!style.trim()) {
					error = 'Style is required in Custom Mode';
					isGenerating = false;
					generatingPlaceholder = null;
					return;
				}
				if (!title.trim()) {
					error = 'Title is required in Custom Mode';
					isGenerating = false;
					generatingPlaceholder = null;
					return;
				}
				requestBody.style = style.trim();
				requestBody.title = title.trim();
				if (!instrumental && lyrics.trim()) {
					requestBody.prompt = lyrics.trim();
				}
			} else {
				if (!prompt.trim()) {
					error = 'Prompt is required';
					isGenerating = false;
					generatingPlaceholder = null;
					return;
				}
				requestBody.prompt = prompt.trim();
			}

			// Optional fields
			if (vocalGender) requestBody.vocalGender = vocalGender;
			if (styleWeight !== undefined) requestBody.styleWeight = styleWeight;
			if (weirdnessConstraint !== undefined) requestBody.weirdnessConstraint = weirdnessConstraint;
			if (audioWeight !== undefined) requestBody.audioWeight = audioWeight;
			if (negativeTags.trim()) requestBody.negativeTags = negativeTags.trim();

			const response = await fetch('/api/music/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			const result = await response.json();

			if (!response.ok) {
				error = result.error || 'Failed to generate song';
				generatingPlaceholder = null;
				return;
			}

			// Update placeholder if enhanced
			if (result.enhanced) {
				generatingPlaceholder = {
					...generatingPlaceholder,
					title: result.enhanced.title,
					tags: result.enhanced.style
				};
			}

			success = 'Song generation started! It will take a moment';

			setTimeout(() => {
				success = null;
			}, 10000);
		} catch (err: any) {
			console.error('Generation error:', err);
			error = err.message || 'Failed to generate song';
		} finally {
			if (isGenerating) {
				setTimeout(() => {
					isGenerating = false;
					error = null;
				}, 10000);
			}
		}
	}

	function playTrack(track: any) {
		currentTrack.set(track);
		isPlaying.set(true);
		queue.set(tracks);
	}

	function downloadTrack(track: any) {
		if (track) {
			const url = pb.files.getURL(track, track.audio);
			const link = document.createElement('a');
			link.href = url;
			link.download = track.title + '.mp3';
			link.rel = 'external';
			link.click();
		}
	}

	function openPlaylistModal(track: any) {
		selectedTrackForPlaylist = track;
		showPlaylistModal = true;
	}
	function formatDuration(seconds: number): string {
		if (!seconds || isNaN(seconds)) return '0m';
		const mins = Math.floor(seconds / 60);
		return `${mins}m`;
	}

	async function handleAddToPlaylist(playlistId: string) {
		if (!selectedTrackForPlaylist) return;

		const playlist = $playlists.find((p: any) => p.id === playlistId);
		const isAlreadyIn = playlist?.trackIds?.includes(selectedTrackForPlaylist.id);

		if (isAlreadyIn) {
			await removeFromPlaylist(playlistId, selectedTrackForPlaylist.id);
		} else {
			await addToPlaylist(playlistId, selectedTrackForPlaylist.id);
		}
	}
</script>

<div
	class="flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-6 sm:px-6 lg:h-full lg:overflow-hidden lg:px-8"
>
	<div class="max-w-9xl mx-auto flex w-full flex-col lg:h-full">
		<!-- Header -->
		<div class="mb-8 flex-none text-center">
			<h1 class="mb-2 text-4xl font-bold text-white">Create Music</h1>
			<p class="text-gray-300">Generate new songs with AI</p>
		</div>

		<div class="flex flex-col gap-8 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-3 lg:overflow-hidden">
			<!-- Left Column: Create Form -->
			<div class="custom-scrollbar pb-32 lg:h-full lg:overflow-y-auto">
				<div class="card">
					<h2 class="mb-6 text-2xl font-bold text-white">Generate New Song</h2>

					<!-- Error Message -->
					{#if error}
						<div class="mb-6 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
							<p class="text-sm text-red-200">{error}</p>
						</div>
					{/if}

					<!-- Success Message -->
					{#if success}
						<div class="mb-6 rounded-lg border border-green-500/50 bg-green-500/20 p-4">
							<p class="text-sm text-green-200">{success}</p>
						</div>
					{/if}

					<form onsubmit={handleGenerate} class="space-y-6">
						<!-- Mode Selection -->
						<div>
							<label class="mb-2 block text-sm font-medium text-gray-300">Generation Mode</label>
							<div class="flex rounded-lg bg-white/5 p-1">
								<button
									type="button"
									class="flex-1 rounded-md py-2 text-sm font-medium transition-all {customMode ===
									false
										? 'bg-purple-600 text-white shadow-lg'
										: 'text-gray-400 hover:text-white'}"
									onclick={() => (customMode = false)}
								>
									Simple Mode
								</button>
								<button
									type="button"
									class="flex-1 rounded-md py-2 text-sm font-medium transition-all {customMode ===
									true
										? 'bg-purple-600 text-white shadow-lg'
										: 'text-gray-400 hover:text-white'}"
									onclick={() => (customMode = true)}
								>
									Custom Mode
								</button>
							</div>
						</div>

						<!-- Model Selection -->
						<div class="hidden">
							<label for="model" class="mb-2 block text-sm font-medium text-gray-300">
								Model
							</label>
							<select id="model" bind:value={model} class="input-field">
								{#each models as m}
									<option value={m}>{m}</option>
								{/each}
							</select>
						</div>

						<!-- Prompt (Simple Mode) -->
						{#if !customMode}
							<div>
								<label for="prompt" class="mb-2 block text-sm font-medium text-gray-300">
									Prompt (Required)
								</label>
								<textarea
									id="prompt"
									bind:value={prompt}
									required
									placeholder="e.g., A upbeat electronic dance track with catchy melodies..."
									rows="4"
									maxlength="500"
									class="input-field"
								></textarea>
								<p class="mt-1 text-xs text-gray-400">
									{prompt.length}/500 characters
								</p>

								<div class="mt-2" class:hidden={instrumental}>
									<button
										type="button"
										class="flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-all {enhancePrompt
											? 'border-purple-500/50 bg-purple-600/20 text-purple-300'
											: 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
										onclick={() => (enhancePrompt = !enhancePrompt)}
									>
										<div class="flex items-center gap-3">
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full {enhancePrompt
													? 'bg-purple-500/20'
													: 'bg-white/10'}"
											>
												<i class="ri-magic-line text-lg"></i>
											</div>
											<div class="text-left">
												<div class="font-medium">Enhance Prompt</div>
												<div class="text-xs opacity-70">
													Additional AI to enhance Lyrics and style
												</div>
											</div>
										</div>
										<div
											class="relative h-6 w-11 rounded-full transition-colors {enhancePrompt
												? 'bg-purple-500'
												: 'bg-gray-600'}"
										>
											<div
												class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform {enhancePrompt
													? 'translate-x-5'
													: 'translate-x-0'}"
											></div>
										</div>
									</button>
								</div>
							</div>
						{/if}

						<!-- Custom Mode Fields -->
						{#if customMode}
							<div>
								<label for="style" class="mb-2 block text-sm font-medium text-gray-300">
									Style <span class="text-red-400">*</span>
								</label>
								<textarea
									id="style"
									bind:value={style}
									required
									placeholder="e.g., Electronic, upbeat, energetic..."
									rows="3"
									maxlength={model === 'V3_5' || model === 'V4' ? 200 : 1000}
									class="input-field"
								></textarea>
								<p class="mt-1 text-xs text-gray-400">
									{style.length}/{model === 'V3_5' || model === 'V4' ? 200 : 1000} characters
								</p>
							</div>

							<div>
								<label for="title" class="mb-2 block text-sm font-medium text-gray-300">
									Title <span class="text-red-400">*</span>
								</label>
								<input
									type="text"
									id="title"
									bind:value={title}
									required
									placeholder="My Awesome Song"
									maxlength="80"
									class="input-field"
								/>
								<p class="mt-1 text-xs text-gray-400">{title.length}/80 characters</p>
							</div>

							<!-- Lyrics (Custom Mode) -->
							{#if !instrumental}
								<div>
									<label for="lyrics" class="mb-2 block text-sm font-medium text-gray-300">
										Lyrics
									</label>
									<textarea
										id="lyrics"
										bind:value={lyrics}
										placeholder="Enter lyrics here, or leave empty for instrumental..."
										rows="6"
										maxlength="5000"
										class="input-field"
									></textarea>
									<p class="mt-1 text-xs text-gray-400">
										{lyrics.length}/5000 characters
									</p>
								</div>
							{/if}

							<div>
								<label for="negativeTags" class="mb-2 block text-sm font-medium text-gray-300">
									Negative Tags (Optional)
								</label>
								<input
									type="text"
									id="negativeTags"
									bind:value={negativeTags}
									placeholder="e.g., slow, sad, acoustic"
									class="input-field"
								/>
							</div>
							<div>
								<label for="vocalGender" class="mb-2 block text-sm font-medium text-gray-300">
									Vocal Gender (Optional)
								</label>
								<select id="vocalGender" bind:value={vocalGender} class="input-field">
									<option value="">None</option>
									<option value="m">Male</option>
									<option value="f">Female</option>
								</select>
							</div>

							<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<div>
									<label for="styleWeight" class="mb-2 block text-sm font-medium text-gray-300">
										Style Weight (0-1)
									</label>
									<input
										type="number"
										id="styleWeight"
										bind:value={styleWeight}
										min="0"
										max="1"
										step="0.01"
										placeholder="0.5"
										class="input-field"
									/>
								</div>
								<div>
									<label
										for="weirdnessConstraint"
										class="mb-2 block text-sm font-medium text-gray-300"
									>
										Weirdness (0-1)
									</label>
									<input
										type="number"
										id="weirdnessConstraint"
										bind:value={weirdnessConstraint}
										min="0"
										max="1"
										step="0.01"
										placeholder="0.5"
										class="input-field"
									/>
								</div>
								<div>
									<label for="audioWeight" class="mb-2 block text-sm font-medium text-gray-300">
										Audio Weight (0-1)
									</label>
									<input
										type="number"
										id="audioWeight"
										bind:value={audioWeight}
										min="0"
										max="1"
										step="0.01"
										placeholder="0.5"
										class="input-field"
									/>
								</div>
							</div>
						{/if}

						<!-- Instrumental Toggle -->
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-all {instrumental
								? 'border-purple-500/50 bg-purple-600/20 text-purple-300'
								: 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
							onclick={() => (instrumental = !instrumental)}
						>
							<div class="flex items-center gap-3">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full {instrumental
										? 'bg-purple-500/20'
										: 'bg-white/10'}"
								>
									<i class="ri-music-line text-lg"></i>
								</div>
								<span class="font-medium">Instrumental</span>
							</div>
							<div
								class="relative h-6 w-11 rounded-full transition-colors {instrumental
									? 'bg-purple-500'
									: 'bg-gray-600'}"
							>
								<div
									class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform {instrumental
										? 'translate-x-5'
										: 'translate-x-0'}"
								></div>
							</div>
						</button>

						<!-- Submit Button -->
						<button type="submit" disabled={isGenerating} class="btn-primary w-full">
							{#if isGenerating}
								<i class="ri-loader-4-line mr-2 inline-block animate-spin"></i>
								Generating...
							{:else}
								<i class="ri-music-2-line mr-2 inline-block"></i>
								Generate Song
							{/if}
						</button>
					</form>
				</div>
			</div>

			<!-- Middle Column: My Songs -->
			<div class="flex flex-col lg:h-full lg:overflow-hidden">
				<h2 class="mb-6 flex-none text-2xl font-bold text-white">My Songs</h2>
				{#if tracks.length === 0 && !generatingPlaceholder}
					<div class="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
						<div class="mb-4 flex justify-center">
							<div class="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
								<i class="ri-music-2-line text-3xl text-gray-400"></i>
							</div>
						</div>
						<h3 class="mb-2 text-lg font-medium text-white">No songs yet</h3>
						<p class="text-gray-400">Create your first song using the form on the left!</p>
					</div>
				{:else}
					<div class="custom-scrollbar flex-1 space-y-2 overflow-y-auto pb-32">
						{#if generatingPlaceholder}
							<div
								class="group relative animate-pulse overflow-hidden rounded-xl border border-purple-500/30 bg-white/5 p-1"
							>
								<div class="flex gap-4">
									<!-- Image Placeholder -->
									<div
										class="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-800"
									>
										<i class="ri-loader-4-line animate-spin text-3xl text-purple-500"></i>
									</div>

									<!-- Content -->
									<div class="flex min-w-0 flex-1 flex-col justify-between gap-1 py-1">
										<div>
											<h3 class="truncate text-lg font-bold text-white">
												{generatingPlaceholder.title}
											</h3>
										</div>

										<div class="flex items-center gap-2">
											<p class="line-clamp-1 text-sm text-gray-400">
												{generatingPlaceholder.tags}
											</p>
										</div>

										<div>
											<span
												class="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300"
												>Generating</span
											>
										</div>
									</div>
								</div>
							</div>
						{/if}

						<SongList
							{tracks}
							onAddToPlaylist={openPlaylistModal}
							userReactions={data.userReactions}
						/>
					</div>
				{/if}
			</div>

			<!-- Right Column: Song Info -->
			<div class="flex flex-col lg:h-full lg:overflow-hidden lg:border-l lg:border-white/5 lg:pl-8">
				<h2 class="mb-6 flex-none text-2xl font-bold text-white">Song Info</h2>
				{#if $currentTrack}
					<div class="custom-scrollbar flex-1 overflow-y-auto pr-4 pb-32">
						<div class="space-y-6">
							<!-- Large Image -->
							<div class="mx-auto w-fit overflow-hidden rounded-xl bg-gray-800 shadow-2xl">
								{#if $currentTrack.image_url}
									<img
										src={$currentTrack.image_url}
										alt={$currentTrack.title}
										class="max-w-60 object-cover"
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<i class="ri-music-fill text-6xl text-gray-600"></i>
									</div>
								{/if}
							</div>

							<!-- Title & Model -->
							<div>
								<h3 class="text-2xl font-bold text-white">{$currentTrack.title}</h3>
								<div class="mt-2 flex flex-wrap gap-2">
									<span class="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300">
										{$currentTrack.model_name === 'chirp-crow'
											? 'V5'
											: $currentTrack.model_name || 'Unknown Model'}
									</span>
									{#if $currentTrack.tags}
										<span class="rounded bg-white/10 px-2 py-1 text-xs text-gray-400">
											{$currentTrack.tags}
										</span>
									{/if}
								</div>
							</div>

							<!-- Generation prompt -->
							{#if $currentTrack.generation_prompt}
								<div class="rounded-xl bg-white/5 p-4">
									<h4 class="mb-2 text-sm font-medium text-gray-400">Generation Prompt</h4>
									<p class="text-sm leading-relaxed whitespace-pre-wrap text-gray-200">
										{$currentTrack.generation_prompt}
									</p>
								</div>
							{/if}

							<!-- Prompt / Lyrics -->
							{#if $currentTrack.prompt}
								<div class="rounded-xl bg-white/5 p-4">
									<h4 class="mb-2 text-sm font-medium text-gray-400">Prompt / Lyrics</h4>
									<p class="text-sm leading-relaxed whitespace-pre-wrap text-gray-200">
										{$currentTrack.prompt}
									</p>
								</div>
							{/if}

							<!-- Download Button -->
							<button
								class="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-3 font-medium text-white transition-colors hover:bg-white/20"
								onclick={() => downloadTrack($currentTrack)}
							>
								<i class="ri-download-line"></i>
								Download MP3
							</button>
						</div>
					</div>
				{:else}
					<div class="flex flex-1 flex-col items-center justify-center text-center text-gray-500">
						<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
							<i class="ri-disc-line text-3xl"></i>
						</div>
						<p>Select a song to view details</p>
					</div>
				{/if}
			</div>
		</div>
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
				{#each $playlists as playlist}
					<button
						class="flex w-full items-center gap-4 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/10 {playlist.trackIds?.includes(
							selectedTrackForPlaylist?.id
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
						{#if playlist.trackIds?.includes(selectedTrackForPlaylist?.id)}
							<i class="ri-check-line ml-auto text-xl text-green-500"></i>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	@reference "$lib/../app.css";

	@keyframes music-bar {
		0%,
		100% {
			height: 0.5rem;
		}
		50% {
			height: 1.5rem;
		}
	}
</style>
