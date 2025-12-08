<script lang="ts">
	import { currentTrack, isPlaying, queue } from '$lib/stores';
	import { userReactions, toggleReaction } from '$lib/stores/trackActions';
	import { playlists } from '$lib/stores/playlists';
	import { toasts } from '$lib/stores/toast';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	let {
		tracks = [],
		playlistMode = false,
		onAddToPlaylist = undefined,
		userReactions: initialReactions = {}
	} = $props();

	function isInPlaylist(trackId: string) {
		return $playlists.some((p: any) => p.trackIds?.includes(trackId));
	}

	// Sync initial reactions to the store
	$effect(() => {
		if (initialReactions) {
			userReactions.update((current) => ({ ...current, ...initialReactions }));
		}
	});

	function playTrack(track: any) {
		currentTrack.set(track);
		isPlaying.set(true);
		queue.set(tracks);
	}

	function formatDate(dateString: string): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString();
		} catch {
			return dateString;
		}
	}

	function copyTrackLink(track: any) {
		const url = `${window.location.origin}/track/${track.id}`;
		navigator.clipboard.writeText(url).then(() => {
			toasts.add('Track link copied!', 'success');
		});
	}
</script>

<div class="space-y-2">
	{#each tracks as track (track.id)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="group relative overflow-hidden rounded-xl bg-white/5 p-2 transition-all hover:bg-white/10 {track.id ===
			$currentTrack?.id
				? 'bg-white/10'
				: ''}"
		>
			<div class="flex items-center gap-4">
				<!-- Image -->
				<div
					class="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-gray-800"
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
							<i class="ri-music-fill text-2xl text-gray-600"></i>
						</div>
					{/if}

					<!-- Play Overlay -->
					<div
						class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
					>
						<button
							class="flex h-8 w-8 items-center justify-center rounded-full bg-white text-purple-900 shadow-lg transition-transform hover:scale-105"
						>
							<i class="ri-play-fill ml-0.5 text-lg"></i>
						</button>
					</div>

					<!-- Visualizer Overlay -->
					{#if track.id === $currentTrack?.id && $isPlaying}
						<div class="absolute inset-0 flex items-center justify-center gap-1 bg-black/60">
							<div class="flex h-[50%] flex-row items-center justify-center gap-1">
								<div
									class="h-3 w-1 animate-[music-bar_1s_ease-in-out_infinite] rounded-full bg-purple-500"
								></div>
								<div
									class="h-5 w-1 animate-[music-bar_1.2s_ease-in-out_infinite] rounded-full bg-purple-500"
								></div>
								<div
									class="h-4 w-1 animate-[music-bar_0.8s_ease-in-out_infinite] rounded-full bg-purple-500"
								></div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Content -->
				<div class="flex min-w-0 flex-1 items-center justify-between gap-4">
					<div class="min-w-0 flex-1">
						<h3
							class="cursor-pointer truncate text-base font-bold text-white transition-colors hover:text-purple-400"
							onclick={() => playTrack(track)}
						>
							{track.title}
						</h3>
						<div class="flex items-center gap-2 text-xs text-gray-400">
							<span class="rounded bg-white/10 px-1.5 py-0.5"
								>{track.model_name === 'chirp-crow' ? 'V5' : track.model_name || 'Unknown'}</span
							>
							<span>•</span>
							<span>{formatDate(track.create_time || track.created)}</span>
							{#if track.tags}
								<span>•</span>
								<span class="max-w-[200px] truncate">{track.tags}</span>
							{/if}
						</div>
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2">
						{#if !playlistMode}
							<button
								class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-all {$userReactions[
									track.id
								] === 'like'
									? 'text-green-400 opacity-100'
									: 'text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:text-green-400'}"
								title="Like"
								onclick={(e) => {
									e.stopPropagation();
									toggleReaction(track.id, 'like');
								}}
							>
								<i
									class={$userReactions[track.id] === 'like'
										? 'ri-thumb-up-fill'
										: 'ri-thumb-up-line'}
								></i>
							</button>
							<button
								class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-all {$userReactions[
									track.id
								] === 'dislike'
									? 'text-red-400 opacity-100'
									: 'text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:text-red-400'}"
								title="Dislike"
								onclick={(e) => {
									e.stopPropagation();
									toggleReaction(track.id, 'dislike');
								}}
							>
								<i
									class={$userReactions[track.id] === 'dislike'
										? 'ri-thumb-down-fill'
										: 'ri-thumb-down-line'}
								></i>
							</button>

							<button
								class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-all {isInPlaylist(
									track.id
								)
									? 'text-green-400 opacity-100'
									: 'text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:text-purple-400'}"
								title={isInPlaylist(track.id) ? 'In Playlist' : 'Add to Playlist'}
								onclick={(e) => {
									e.stopPropagation();
									if (onAddToPlaylist) onAddToPlaylist(track);
								}}
							>
								<i
									class={isInPlaylist(track.id) ? 'ri-play-list-add-fill' : 'ri-play-list-add-line'}
								></i>
							</button>
						{/if}

						<button
							class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/20 hover:text-white"
							title="Copy Link"
							onclick={(e) => {
								e.stopPropagation();
								copyTrackLink(track);
							}}
						>
							<i class="ri-share-line"></i>
						</button>

						<button
							class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/20 hover:text-white"
							title="View Track Page"
							onclick={(e) => {
								e.stopPropagation();
								goto(`/track/${track.id}`);
							}}
						>
							<i class="ri-external-link-line"></i>
						</button>

						<a
							href={track.audio_url}
							download
							class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/20 hover:text-white"
							title="Download"
							onclick={(e) => e.stopPropagation()}
						>
							<i class="ri-download-line"></i>
						</a>

						{#if playlistMode}
							<form action="?/removeFromPlaylist" method="POST" use:enhance>
								<input type="hidden" name="playlistTrackId" value={track.playlist_track_id} />
								<button
									type="submit"
									class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/20 hover:text-red-400"
									title="Remove from Playlist"
									onclick={(e) => e.stopPropagation()}
								>
									<i class="ri-delete-bin-line"></i>
								</button>
							</form>
						{:else}
							<form action="?/delete" method="POST" use:enhance class="mr-2 ml-auto inline-block">
								<input type="hidden" name="id" value={track.id} />
								<button
									type="submit"
									class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/20 hover:text-red-400"
									title="Delete"
									onclick={(e) => e.stopPropagation()}
								>
									<i class="ri-delete-bin-line"></i>
								</button>
							</form>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>
