<script lang="ts">
	import { toasts } from '$lib/stores/toast';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
</script>

<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2">
	{#each $toasts as toast (toast.id)}
		<div
			animate:flip
			in:fly={{ x: 20, duration: 300 }}
			out:fade
			class="flex min-w-[300px] items-center justify-between rounded-lg border border-white/10 p-4 shadow-xl backdrop-blur-md
            {toast.type === 'success' ? 'bg-green-500/20 text-green-200' : ''}
            {toast.type === 'error' ? 'bg-red-500/20 text-red-200' : ''}
            {toast.type === 'info' ? 'bg-blue-500/20 text-blue-200' : ''}"
		>
			<div class="flex items-center gap-3">
				{#if toast.type === 'success'}
					<i class="ri-checkbox-circle-line text-xl"></i>
				{:else if toast.type === 'error'}
					<i class="ri-error-warning-line text-xl"></i>
				{:else}
					<i class="ri-information-line text-xl"></i>
				{/if}
				<span class="text-sm font-medium">{toast.message}</span>
			</div>
			<button onclick={() => toasts.remove(toast.id)} class="ml-4 text-white/50 hover:text-white">
				<i class="ri-close-line text-lg"></i>
			</button>
		</div>
	{/each}
</div>
