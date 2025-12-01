<script lang="ts">
	import { goto } from '$app/navigation';
	import 'remixicon/fonts/remixicon.css';
	import { currentTrack, isPlaying } from '$lib/stores';

	let { data } = $props();
	let user = $state(data.user);
	let tracks = $state(data.tracks || []);

	// Generation form state
	let prompt = $state('');
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

	// UI state
	let isGenerating = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	// Available models
	const models = ['V3_5', 'V4', 'V4_5', 'V4_5PLUS', 'V5'];

	async function handleGenerate(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		success = null;
		isGenerating = true;

		try {
			const requestBody: any = {
				customMode,
				instrumental,
				model
			};

			if (customMode) {
				if (!style.trim()) {
					error = 'Style is required in Custom Mode';
					isGenerating = false;
					return;
				}
				if (!title.trim()) {
					error = 'Title is required in Custom Mode';
					isGenerating = false;
					return;
				}
				requestBody.style = style.trim();
				requestBody.title = title.trim();
				if (!instrumental && prompt.trim()) {
					requestBody.prompt = prompt.trim();
				}
			} else {
				if (!prompt.trim()) {
					error = 'Prompt is required';
					isGenerating = false;
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
				return;
			}

			success = 'Song generation started! It may take a few minutes. Check back soon.';
			// Reset form
			prompt = '';
			style = '';
			title = '';
			vocalGender = '';
			styleWeight = undefined;
			weirdnessConstraint = undefined;
			audioWeight = undefined;
			negativeTags = '';
		} catch (err: any) {
			console.error('Generation error:', err);
			error = err.message || 'Failed to generate song';
		} finally {
			isGenerating = false;
		}
	}

	function playTrack(track: any) {
		currentTrack.set(track);
		isPlaying.set(true);
	}
</script>

<div
	class="flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-6 sm:px-6 lg:h-full lg:overflow-hidden lg:px-8"
>
	<div class="mx-auto flex w-full max-w-7xl flex-col lg:h-full">
		<!-- Header -->
		<div class="mb-8 flex-none text-center">
			<h1 class="mb-2 text-4xl font-bold text-white">Create Music</h1>
			<p class="text-gray-300">Generate new songs with AI</p>
		</div>

		<div class="flex flex-col gap-8 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-2 lg:overflow-hidden">
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
							<div class="mt-2">
								<a href="/me" class="text-sm font-medium text-green-200 underline hover:text-white"
									>View My Songs</a
								>
							</div>
						</div>
					{/if}

					<form onsubmit={handleGenerate} class="space-y-6">
						<!-- Mode Selection -->
						<div>
							<label class="mb-2 block text-sm font-medium text-gray-300">Generation Mode</label>
							<div class="flex gap-4">
								<label class="flex cursor-pointer items-center gap-2">
									<input
										type="radio"
										bind:group={customMode}
										value={false}
										class="h-4 w-4 cursor-pointer text-purple-600 focus:ring-2 focus:ring-purple-500"
									/>
									<span class="text-sm text-gray-300">Simple Mode</span>
								</label>
								<label class="flex cursor-pointer items-center gap-2">
									<input
										type="radio"
										bind:group={customMode}
										value={true}
										class="h-4 w-4 cursor-pointer text-purple-600 focus:ring-2 focus:ring-purple-500"
									/>
									<span class="text-sm text-gray-300">Custom Mode</span>
								</label>
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

						<!-- Prompt (Simple Mode or Custom Mode with vocals) -->
						{#if !customMode || !instrumental}
							<div>
								<label for="prompt" class="mb-2 block text-sm font-medium text-gray-300">
									Prompt {customMode ? '(Optional for instrumental)' : '(Required)'}
								</label>
								<textarea
									id="prompt"
									bind:value={prompt}
									required={!customMode}
									placeholder="e.g., A upbeat electronic dance track with catchy melodies..."
									rows="4"
									maxlength={customMode ? 5000 : 500}
									class="input-field"
								></textarea>
								<p class="mt-1 text-xs text-gray-400">
									{prompt.length}/{customMode ? 5000 : 500} characters
								</p>
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

						<!-- Instrumental Checkbox -->
						<div class="flex items-center gap-3">
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									bind:checked={instrumental}
									class="h-5 w-5 cursor-pointer rounded border-white/20 bg-white/10 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0"
								/>
								<span class="text-sm font-medium text-gray-300">Instrumental</span>
							</label>
						</div>

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

			<!-- Right Column: My Songs -->
			<div class="flex flex-col lg:h-full lg:overflow-hidden">
				<h2 class="mb-6 flex-none text-2xl font-bold text-white">My Songs</h2>
				{#if tracks.length === 0}
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
						{#each tracks as track}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="group relative overflow-hidden rounded-xl p-1 transition-all hover:bg-white/10"
							>
								<div class="flex gap-4">
									<!-- Image -->
									<div
										class="relative h-24 w-24 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-gray-800"
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
												<i class="ri-music-fill text-3xl text-gray-600"></i>
											</div>
										{/if}

										<!-- Play Overlay -->
										<div
											class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
										>
											<button
												class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-purple-900 shadow-lg transition-transform hover:scale-105"
												title="play"
											>
												<i class="ri-play-fill ml-0.5 text-xl"></i>
											</button>
										</div>
									</div>

									<!-- Content -->
									<div class="flex min-w-0 flex-1 flex-col justify-between gap-1 py-1">
										<div>
											<button
												class="cursor-pointer truncate text-lg font-bold text-white transition-colors hover:text-purple-400"
												title={track.title}
												onclick={() => playTrack(track)}
											>
												{track.title}
												<span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400"
													>{track.model_name === 'chirp-crow' ? 'V5' : track.model_name}</span
												>
											</button>
										</div>

										<div class="flex items-center gap-2">
											{#if track.tags}
												<p class="line-clamp-1 text-sm text-gray-400" title={track.tags}>
													{track.tags}
												</p>
											{/if}
										</div>

										<div class="flex items-center justify-between">
											<div class="flex gap-2">
												<button
													class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-green-400"
													title="Like"
													onclick={(e) => {
														e.stopPropagation();
														// TODO: Implement like
													}}
												>
													<i class="ri-thumb-up-line"></i>
												</button>
												<button
													class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-red-400"
													title="Dislike"
													onclick={(e) => {
														e.stopPropagation();
														// TODO: Implement dislike
													}}
												>
													<i class="ri-thumb-down-line"></i>
												</button>
												<button
													class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-purple-400"
													title="Add to Playlist"
													onclick={(e) => {
														e.stopPropagation();
														// TODO: Implement add to playlist
													}}
												>
													<i class="ri-play-list-add-line"></i>
												</button>
												<button
													class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-white/20 hover:text-blue-400"
													title="Share"
													onclick={(e) => {
														e.stopPropagation();
														// TODO: Implement share
													}}
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

								<!-- Audio Player (Hidden by default, could be expanded) -->
								<audio src={track.audio_url} preload="none" class="hidden"></audio>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	@reference "$lib/../app.css";
</style>
