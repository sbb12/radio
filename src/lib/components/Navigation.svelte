<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import 'remixicon/fonts/remixicon.css';

	let { user: initialUser } = $props();

	let user = $derived($page.data.user || initialUser);

	let currentPath = $derived($page.url.pathname);
	let isMobileMenuOpen = $state(false);

	async function handleLogout() {
		try {
			await goto('/login');
		} catch (err) {
			console.error('Logout error:', err);
		}
	}

	function isActive(path: string): boolean {
		return currentPath === path;
	}
</script>

<nav class="border-b bg-slate-900 backdrop-blur-lg">
	<div class="mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo and Brand -->
			<div class="flex items-center">
				<a href="/" class="flex items-center space-x-2">
					<i class="ri-music-2-line text-2xl text-purple-400"></i>
					<span class="text-xl font-bold text-white">Surgo</span>
				</a>
			</div>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex md:items-center md:space-x-4">
				<a
					href="/"
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {isActive('/')
						? 'bg-purple-600/20 text-purple-300'
						: 'text-gray-300 hover:bg-white/10 hover:text-white'}"
				>
					<i class="ri-radio-line mr-2"></i>
					Radio
				</a>

				<a
					href="/create"
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {isActive(
						'/create'
					)
						? 'bg-purple-600/20 text-purple-300'
						: 'text-gray-300 hover:bg-white/10 hover:text-white'}"
				>
					<i class="ri-add-circle-line mr-2"></i>
					Create
				</a>

				{#if user}
					<a
						href="/me"
						class="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {isActive(
							'/me'
						)
							? 'bg-purple-600/20 text-purple-300'
							: 'text-gray-300 hover:bg-white/10 hover:text-white'}"
					>
						<i class="ri-user-line mr-2"></i>
						Me
					</a>
					<div class="flex items-center space-x-3 border-l border-white/10 pl-4">
						<button
							onclick={handleLogout}
							class="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20 focus:ring-2 focus:ring-purple-500 focus:outline-none"
						>
							<i class="ri-logout-box-line mr-2"></i>
							Logout
						</button>
					</div>
				{:else}
					<a
						href="/login"
						class="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-pink-700 focus:ring-2 focus:ring-purple-500 focus:outline-none"
					>
						<i class="ri-login-box-line mr-2"></i>
						Login
					</a>
				{/if}
			</div>

			<!-- Mobile menu button -->
			<div class="md:hidden">
				<button
					onclick={() => (isMobileMenuOpen = !isMobileMenuOpen)}
					class="rounded-lg p-2 text-gray-300 hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
					aria-label="Toggle menu"
				>
					{#if isMobileMenuOpen}
						<i class="ri-close-line h-6 w-6"></i>
					{:else}
						<i class="ri-menu-line h-6 w-6"></i>
					{/if}
				</button>
			</div>
		</div>

		<!-- Mobile Navigation -->
		{#if isMobileMenuOpen}
			<div class="border-t border-white/10 py-4 md:hidden">
				<div class="space-y-2">
					<a
						href="/"
						onclick={() => (isMobileMenuOpen = false)}
						class="block rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {isActive(
							'/'
						)
							? 'bg-purple-600/20 text-purple-300'
							: 'text-gray-300 hover:bg-white/10 hover:text-white'}"
					>
						<i class="ri-radio-line mr-2"></i>
						Radio
					</a>

					<a
						href="/create"
						onclick={() => (isMobileMenuOpen = false)}
						class="block rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {isActive(
							'/create'
						)
							? 'bg-purple-600/20 text-purple-300'
							: 'text-gray-300 hover:bg-white/10 hover:text-white'}"
					>
						<i class="ri-add-circle-line mr-2"></i>
						Create
					</a>

					{#if user}
						<a
							href="/me"
							onclick={() => (isMobileMenuOpen = false)}
							class="block rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {isActive(
								'/me'
							)
								? 'bg-purple-600/20 text-purple-300'
								: 'text-gray-300 hover:bg-white/10 hover:text-white'}"
						>
							<i class="ri-user-line mr-2"></i>
							Me
						</a>
						<div class="border-t border-white/10 pt-2">
							<div class="px-4 py-2 text-sm text-gray-300">{user.email}</div>
							<button
								onclick={() => {
									isMobileMenuOpen = false;
									handleLogout();
								}}
								class="w-full rounded-lg bg-white/10 px-4 py-2 text-left text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20"
							>
								<i class="ri-logout-box-line mr-2"></i>
								Logout
							</button>
						</div>
					{:else}
						<a
							href="/login"
							onclick={() => (isMobileMenuOpen = false)}
							class="block rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-center text-sm font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-pink-700"
						>
							<i class="ri-login-box-line mr-2"></i>
							Login
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</nav>
