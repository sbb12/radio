<script lang="ts">
	import { goto } from '$app/navigation';
	import PocketBase from 'pocketbase';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let isSignUp = $state(false);

	let pb: PocketBase | null = null;

	onMount(() => {
		// Initialize PocketBase client
		const pbUrl = 'https://pb.sercan.co.uk';
		pb = new PocketBase(pbUrl);
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		loading = true;

		if (!pb) {
			error = 'PocketBase not configured';
			loading = false;
			return;
		}

		try {
			if (isSignUp) {
				// Sign Up Logic
				if (password !== passwordConfirm) {
					throw new Error('Passwords do not match');
				}

				// Create user
				await pb.collection('users').create({
					email,
					name: email.split('@')[0],
					password,
					passwordConfirm
				});

				// Automatically log in after creation
				await login();
			} else {
				// Login Logic
				await login();
			}
		} catch (err: any) {
			console.error('Auth error:', err);
			error = err.message || (isSignUp ? 'Failed to create account' : 'Login failed');
		} finally {
			loading = false;
		}
	}

	async function login() {
		if (!pb) return;

		// Authenticate with email/password
		const authData = await pb.collection('users').authWithPassword(email, password);
		document.cookie = `token=${authData.token}; path=/; max-age=604800; same-site=lax; http-only=false; secure=false`;

		// Redirect to user page
		await goto('/me');
	}

	async function handleDiscordLogin() {
		error = null;
		loading = true;

		if (!pb) {
			error = 'PocketBase not configured';
			loading = false;
			return;
		}

		try {
			// Get OAuth providers
			const authMethods = await pb.collection('users').listAuthMethods();
			const discordProvider = authMethods.oauth2?.providers?.find((p) => p.name === 'discord');

			if (!discordProvider) {
				error = 'Discord authentication is not configured';
				loading = false;
				return;
			}

			const authData = await pb
				.collection('users')
				.authWithOAuth2({ provider: 'discord', expand: 'user_settings_via_user' });
			const token = authData.token;

			document.cookie = `token=${token}; path=/; max-age=604800; same-site=lax; http-only=false; secure=false`;

			const resp = await fetch('/api/auth/set-cookie', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					cookie: token
				})
			});

			if (!resp.ok) {
				error = 'Failed to set cookie';
				loading = false;
				return;
			}

			await goto('/me');
		} catch (err: any) {
			console.error('Discord login error:', err);
			error = err.message || 'Discord login failed';
			loading = false;
		}
	}

	async function handleGoogleLogin() {
		error = null;
		loading = true;

		if (!pb) {
			error = 'PocketBase not configured';
			loading = false;
			return;
		}

		try {
			// Get OAuth providers
			const authMethods = await pb.collection('users').listAuthMethods();
			const googleProvider = authMethods.oauth2?.providers?.find((p) => p.name === 'google');

			if (!googleProvider) {
				error = 'Google authentication is not configured';
				loading = false;
				return;
			}

			const authData = await pb
				.collection('users')
				.authWithOAuth2({ provider: 'google', expand: 'user_settings_via_user' });
			const token = authData.token;

			console.log(token);

			document.cookie = `token=${token}; path=/; max-age=604800; same-site=lax; http-only=false; secure=false`;

			const resp = await fetch('/api/auth/set-cookie', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					cookie: token
				})
			});

			if (!resp.ok) {
				error = 'Failed to set cookie';
				loading = false;
				return;
			}

			await goto('/me');
		} catch (err: any) {
			console.error('Google login error:', err);
			error = err.message || 'Google login failed';
			loading = false;
		}
	}

	function toggleMode() {
		isSignUp = !isSignUp;
		error = null;
		password = '';
		passwordConfirm = '';
	}
</script>

<div
	class="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md">
		<div class="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
			<h1 class="mb-2 text-center text-4xl font-bold text-white">Surgo Radio</h1>
			<p class="mb-8 text-center text-gray-300">
				{isSignUp ? 'Create your account' : 'Sign in to your account'}
			</p>

			<!-- Error Message -->
			{#if error}
				<div class="mb-6 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
					<p class="text-sm text-red-200">{error}</p>
				</div>
			{/if}

			<!-- Email/Password Form -->
			<form onsubmit={handleSubmit} class="mb-6 space-y-6">
				<div>
					<label for="email" class="mb-2 block text-sm font-medium text-gray-200"> Email </label>
					<input
						type="email"
						id="email"
						bind:value={email}
						required
						placeholder="your@email.com"
						class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="password" class="mb-2 block text-sm font-medium text-gray-200">
						Password
					</label>
					<input
						type="password"
						id="password"
						bind:value={password}
						required
						minlength="8"
						placeholder="••••••••"
						class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
					/>
				</div>

				{#if isSignUp}
					<div>
						<label for="passwordConfirm" class="mb-2 block text-sm font-medium text-gray-200">
							Confirm Password
						</label>
						<input
							type="password"
							id="passwordConfirm"
							bind:value={passwordConfirm}
							required
							minlength="8"
							placeholder="••••••••"
							class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
						/>
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-pink-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						{isSignUp ? 'Creating account...' : 'Signing in...'}
					{:else}
						{isSignUp ? 'Create Account' : 'Sign in with Email'}
					{/if}
				</button>
			</form>

			<div class="mt-4 text-center">
				<button
					onclick={toggleMode}
					class="text-sm text-purple-300 hover:text-purple-200 hover:underline focus:outline-none"
				>
					{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
				</button>
			</div>

			<!-- Divider -->
			<div class="my-6 flex flex-row items-center">
				<div class="w-full border-t border-white/20"></div>
				<div class="mx-1 shrink-0 bg-white/10 px-2 text-sm">
					<span class="text-gray-300">Or continue with</span>
				</div>
				<div class="w-full border-t border-white/20"></div>
			</div>

			<!-- Google Login Button -->
			<div class="flex flex-col gap-3">
				<button
					type="button"
					onclick={handleGoogleLogin}
					disabled={loading}
					class="flex w-full items-center justify-center space-x-2 rounded-lg bg-white/10 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-white/20 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="currentColor"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="currentColor"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="currentColor"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					<span>Sign in with Google</span>
				</button>

				<!-- Discord Login Button -->
				<button
					type="button"
					onclick={handleDiscordLogin}
					disabled={loading}
					class="flex w-full items-center justify-center space-x-2 rounded-lg bg-[#5865F2] px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-[#4752C4] focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.772-.6083 1.1588a18.2915 18.2915 0 00-5.4882 0 12.642 12.642 0 00-.6173-1.1588.0775.0775 0 00-.0785-.0371 19.7363 19.7363 0 00-4.8852 1.5151.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"
						/>
					</svg>
					<span>Sign in with Discord</span>
				</button>
			</div>
		</div>
	</div>
</div>
