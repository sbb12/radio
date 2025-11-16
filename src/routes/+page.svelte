<script lang="ts">
	let formData = $state({
		customMode: false,
		instrumental: false,
		model: 'V5',
		prompt: '',
		style: '',
		title: '',
		personaId: '',
		negativeTags: '',
		vocalGender: '',
		styleWeight: '',
		weirdnessConstraint: '',
		audioWeight: ''
	});

	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state<string | null>(null);

	const models = ['V5', 'V4_5PLUS', 'V4_5', 'V4', 'V3_5'];
	const vocalGenders = ['m', 'f'];

	function validateForm(): string | null {
		if (formData.customMode) {
			if (!formData.style.trim()) {
				return 'Style is required in Custom Mode';
			}
			if (!formData.title.trim()) {
				return 'Title is required in Custom Mode';
			}
			if (!formData.instrumental && !formData.prompt.trim()) {
				return 'Prompt is required in Custom Mode when instrumental is false';
			}
		} else {
			if (!formData.prompt.trim()) {
				return 'Prompt is required in Non-custom Mode';
			}
		}

		// Validate numeric fields
		if (formData.styleWeight && (parseFloat(formData.styleWeight) < 0 || parseFloat(formData.styleWeight) > 1)) {
			return 'Style Weight must be between 0 and 1';
		}
		if (formData.weirdnessConstraint && (parseFloat(formData.weirdnessConstraint) < 0 || parseFloat(formData.weirdnessConstraint) > 1)) {
			return 'Weirdness Constraint must be between 0 and 1';
		}
		if (formData.audioWeight && (parseFloat(formData.audioWeight) < 0 || parseFloat(formData.audioWeight) > 1)) {
			return 'Audio Weight must be between 0 and 1';
		}

		return null;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		result = null;

		const validationError = validateForm();
		if (validationError) {
			error = validationError;
			return;
		}

		loading = true;

		try {
			// Build request body
			const body: any = {
				customMode: formData.customMode,
				instrumental: formData.instrumental,
				model: formData.model
			};

			// Add optional fields only if they have values
			if (formData.prompt.trim()) {
				body.prompt = formData.prompt.trim();
			}
			if (formData.customMode) {
				if (formData.style.trim()) {
					body.style = formData.style.trim();
				}
				if (formData.title.trim()) {
					body.title = formData.title.trim();
				}
				if (formData.personaId.trim()) {
					body.personaId = formData.personaId.trim();
				}
			}
			if (formData.negativeTags.trim()) {
				body.negativeTags = formData.negativeTags.trim();
			}
			if (formData.vocalGender) {
				body.vocalGender = formData.vocalGender;
			}
			if (formData.styleWeight) {
				body.styleWeight = parseFloat(formData.styleWeight);
			}
			if (formData.weirdnessConstraint) {
				body.weirdnessConstraint = parseFloat(formData.weirdnessConstraint);
			}
			if (formData.audioWeight) {
				body.audioWeight = parseFloat(formData.audioWeight);
			}

			const response = await fetch('/api/music/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || `Error: ${response.status} ${response.statusText}`;
				return;
			}

			result = data;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		formData = {
			customMode: false,
			instrumental: false,
			model: 'V5',
			prompt: '',
			style: '',
			title: '',
			personaId: '',
			negativeTags: '',
			vocalGender: '',
			styleWeight: '',
			weirdnessConstraint: '',
			audioWeight: ''
		};
		result = null;
		error = null;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-4xl mx-auto">
		<div class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
			<h1 class="text-4xl font-bold text-white mb-2 text-center">Suno Music Generator</h1>
			<p class="text-gray-300 text-center mb-8">Generate music using the Suno API</p>

			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Custom Mode (Hidden) -->
				<input
					type="checkbox"
					id="customMode"
					bind:checked={formData.customMode}
					class="hidden"
				/>

				<!-- Instrumental Toggle -->
				<div class="flex items-center justify-between">
					<label for="instrumental" class="text-sm font-medium text-gray-200">
						Instrumental <span class="text-red-400">*</span>
					</label>
					<button
						type="button"
						role="switch"
						aria-checked={formData.instrumental}
						aria-label="Toggle instrumental mode"
						onclick={() => formData.instrumental = !formData.instrumental}
						class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 {formData.instrumental ? 'bg-purple-600' : 'bg-gray-600'}"
					>
						<span
							class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {formData.instrumental ? 'translate-x-6' : 'translate-x-1'}"
						></span>
					</button>
				</div>

				<!-- Model -->
				<div>
					<label for="model" class="block text-sm font-medium text-gray-200 mb-2">
						Model <span class="text-red-400">*</span>
					</label>
					<select
						id="model"
						bind:value={formData.model}
						class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					>
						{#each models as model}
							<option value={model} class="bg-slate-800">{model}</option>
						{/each}
					</select>
				</div>

				<!-- Prompt -->
				<div>
					<label for="prompt" class="block text-sm font-medium text-gray-200 mb-2">
						Prompt
						{#if !formData.customMode}
							<span class="text-red-400">*</span>
						{:else if !formData.instrumental}
							<span class="text-red-400">*</span>
						{/if}
					</label>
					<textarea
						id="prompt"
						bind:value={formData.prompt}
						rows="4"
						placeholder={formData.customMode ? "Lyrics (used strictly if instrumental is false)" : "A description of the desired audio content"}
						class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
					></textarea>
					<p class="mt-1 text-xs text-gray-400">
						{#if formData.customMode}
							{#if formData.model === 'V3_5' || formData.model === 'V4'}
								Max 3000 characters
							{:else}
								Max 5000 characters
							{/if}
						{:else}
							Max 500 characters
						{/if}
					</p>
				</div>

				{#if formData.customMode}
					<!-- Style (Custom Mode only) -->
					<div>
						<label for="style" class="block text-sm font-medium text-gray-200 mb-2">
							Style <span class="text-red-400">*</span>
						</label>
						<input
							type="text"
							id="style"
							bind:value={formData.style}
							placeholder="Jazz, Classical, Electronic, etc."
							class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							required={formData.customMode}
						/>
						<p class="mt-1 text-xs text-gray-400">
							{#if formData.model === 'V3_5' || formData.model === 'V4'}
								Max 200 characters
							{:else}
								Max 1000 characters
							{/if}
						</p>
					</div>

					<!-- Title (Custom Mode only) -->
					<div>
						<label for="title" class="block text-sm font-medium text-gray-200 mb-2">
							Title <span class="text-red-400">*</span>
						</label>
						<input
							type="text"
							id="title"
							bind:value={formData.title}
							placeholder="Peaceful Piano Meditation"
							maxlength="80"
							class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							required={formData.customMode}
						/>
						<p class="mt-1 text-xs text-gray-400">Max 80 characters</p>
					</div>

					<!-- Persona ID (Custom Mode only) -->
					<div>
						<label for="personaId" class="block text-sm font-medium text-gray-200 mb-2">
							Persona ID
						</label>
						<input
							type="text"
							id="personaId"
							bind:value={formData.personaId}
							placeholder="persona_123"
							class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
					</div>
				{/if}

				<!-- Negative Tags -->
				<div>
					<label for="negativeTags" class="block text-sm font-medium text-gray-200 mb-2">
						Negative Tags
					</label>
					<input
						type="text"
						id="negativeTags"
						bind:value={formData.negativeTags}
						placeholder="Heavy Metal, Upbeat Drums"
						class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					/>
				</div>

				<!-- Vocal Gender -->
				<div>
					<label for="vocalGender" class="block text-sm font-medium text-gray-200 mb-2">
						Vocal Gender
					</label>
					<select
						id="vocalGender"
						bind:value={formData.vocalGender}
						class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					>
						<option value="" class="bg-slate-800"></option>
						{#each vocalGenders as gender}
							<option value={gender} class="bg-slate-800">{gender === 'm' ? 'Male' : 'Female'}</option>
						{/each}
					</select>
				</div>

				<!-- Advanced Options -->
				<div class="border-t border-white/20 pt-6">
					<h3 class="text-lg font-semibold text-white mb-4">Advanced Options</h3>
					
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<!-- Style Weight -->
						<div>
							<label for="styleWeight" class="block text-sm font-medium text-gray-200 mb-2">
								Style Weight (0-1)
							</label>
							<input
								type="number"
								id="styleWeight"
								bind:value={formData.styleWeight}
								placeholder="0.65"
								min="0"
								max="1"
								step="0.01"
								class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							/>
						</div>

						<!-- Weirdness Constraint -->
						<div>
							<label for="weirdnessConstraint" class="block text-sm font-medium text-gray-200 mb-2">
								Weirdness Constraint (0-1)
							</label>
							<input
								type="number"
								id="weirdnessConstraint"
								bind:value={formData.weirdnessConstraint}
								placeholder="0.65"
								min="0"
								max="1"
								step="0.01"
								class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							/>
						</div>

						<!-- Audio Weight -->
						<div>
							<label for="audioWeight" class="block text-sm font-medium text-gray-200 mb-2">
								Audio Weight (0-1)
							</label>
							<input
								type="number"
								id="audioWeight"
								bind:value={formData.audioWeight}
								placeholder="0.65"
								min="0"
								max="1"
								step="0.01"
								class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							/>
						</div>
					</div>
				</div>

				<!-- Error Message -->
				{#if error}
					<div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
						<p class="text-red-200 text-sm">{error}</p>
					</div>
				{/if}

				<!-- Success Result -->
				{#if result}
					<div class="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
						<h4 class="text-green-200 font-semibold mb-2">Success!</h4>
						<pre class="text-green-100 text-xs overflow-auto max-h-64 bg-black/20 p-3 rounded">{JSON.stringify(result, null, 2)}</pre>
					</div>
				{/if}

				<!-- Submit Button -->
				<div class="flex space-x-4">
					<button
						type="submit"
						disabled={loading}
						class="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
					>
						{loading ? 'Generating...' : 'Generate Music'}
					</button>
					<button
						type="button"
						onclick={resetForm}
						class="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200"
					>
						Reset
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
