<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import MusicPlayer from '$lib/components/MusicPlayer.svelte';

	import Toast from '$lib/components/Toast.svelte';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen flex-col overflow-hidden bg-slate-900">
	<Navigation user={data.user} />
	<Toast />

	<main class="relative flex-1 overflow-y-auto">
		{@render children()}
	</main>

	<MusicPlayer />
</div>
