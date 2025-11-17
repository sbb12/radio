<script lang="ts">
	import { goto } from '$app/navigation';
	import PocketBase from 'pocketbase';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	let pb: PocketBase | null = null;

	if (browser) {
		// Initialize PocketBase client
		const pbUrl = "https://pb.sercan.co.uk";
		pb = new PocketBase(pbUrl);
	}

	async function handleEmailLogin(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		loading = true;

		if (!pb) {
			error = 'PocketBase not configured';
			loading = false;
			return;
		}

		try {
			// Authenticate with email/password
			const authData = await pb.collection('users').authWithPassword(email, password);

			// Set auth cookie via API to ensure proper cookie handling
			await fetch('/api/auth/set-cookie', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					cookie: pb.authStore.exportToCookie({}, 'stoken')
				})
			});

			// Redirect to home page
			await goto('/');
		} catch (err: any) {
			console.error('Login error:', err);
			error = err.message || 'Login failed. Please check your credentials.';
		} finally {
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

			const authData = await pb.collection('users').authWithOAuth2({ provider: 'google', expand: 'user_settings_via_user'})
			const token = authData.token;	

			document.cookie = `stoken=${token}; path=/; max-age=604800; same-site=lax; http-only=false; secure=false`;

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
			
			await goto('/');

		} catch (err: any) {
			console.error('Google login error:', err);
			error = err.message || 'Google login failed';
			loading = false;
		}
	}
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md">
		<div class="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
			<h1 class="mb-2 text-center text-4xl font-bold text-white">Surgo Radio</h1>
			<p class="mb-8 text-center text-gray-300">Sign in to your account</p>

			<!-- Error Message -->
			{#if error}
				<div class="mb-6 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
					<p class="text-sm text-red-200">{error}</p>
				</div>
			{/if}

			<!-- Email/Password Form -->
			<form onsubmit={handleEmailLogin} class="mb-6 space-y-6">
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
						placeholder="••••••••"
						class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-pink-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? 'Signing in...' : 'Sign in with Email'}
				</button>
			</form>

			<!-- Divider -->
			<div class="mb-6 flex flex-row items-center">
				<div class="w-full border-t border-white/20"></div>
				<div class="text-sm shrink-0 bg-white/10 px-2 mx-1">
					<span class="text-gray-300">Or continue with</span>
				</div>
				<div class="w-full border-t border-white/20"></div>
			</div>

			<!-- Google Login Button -->
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
		</div>
	</div>
</div>
