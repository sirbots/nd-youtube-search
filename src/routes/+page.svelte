<script lang="ts">
	// Types
	import type { ActionData } from './$types';

	// Helpers
	import { enhance } from '$app/forms';

	// Components
	import { Play, Link } from 'lucide-svelte';

	// Data
	const ENV_MODE = import.meta.env.MODE;

	let { form }: { form: ActionData } = $props();

	let currentVideoId = $state<string | null>(null);
	let autoPlay = $state(false);
	let expandedResults = $state<Record<string, boolean>>({});
	let isSearching = $state(false);
	let currentSort = $state('snippets'); // 'snippets', 'newest', or 'oldest'

	// Helper function to decode HTML entities
	function decodeHtmlEntities(text: string): string {
		return text.replace(/&amp;#39;/g, "'");
	}

	// Helper function to generate YouTube timestamp URL
	function generateYoutubeTimestampUrl(videoId: string, timestamp: string): string {
		// Convert timestamp (MM:SS) to seconds
		const [minutes, seconds] = timestamp.split(':').map(Number);
		const totalSeconds = minutes * 60 + seconds;
		return `https://www.youtube.com/watch?v=${videoId}&t=${totalSeconds}s`;
	}

	// Update the function to handle video selection with timestamp
	function handleVideoSelect(videoId: string, timestamp: string) {
		// Convert timestamp (MM:SS) to seconds
		const [minutes, seconds] = timestamp.split(':').map(Number);
		const totalSeconds = minutes * 60 + seconds;
		currentVideoId = `${videoId}?start=${totalSeconds}`;
	}

	// Helper function to toggle expansion
	function toggleExpansion(videoId: string) {
		expandedResults[videoId] = !expandedResults[videoId];
	}

	async function fetchTranscriptsAndSaveToJson() {
		const transcripts = await fetch(`/api/write-transcripts-to-json`).then((res) => res.json());
		console.log(transcripts);
	}

	async function fetchTranscriptsAndSaveToRedis() {
		const transcripts = await fetch(`/api/write-transcripts-to-redis`).then((res) => res.json());
		console.log(transcripts);
	}

	// Add this helper function near your other helper functions
	function highlightSearchText(text: string, query: string): string {
		if (!query) return text;
		const regex = new RegExp(`(${query})`, 'gi');
		return text.replace(regex, '<span class="bg-yellow-200">$1</span>');
	}

	// Add these functions after your existing helper functions
	function sortResults(results: any[]) {
		if (currentSort === 'snippets') {
			return [...results].sort((a, b) => b.snippets.length - a.snippets.length);
		} else if (currentSort === 'newest') {
			return [...results].sort(
				(a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
			);
		} else if (currentSort === 'oldest') {
			return [...results].sort(
				(a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
			);
		}
		return results;
	}
</script>

{#if ENV_MODE === 'development'}
	<button
		class="bg-indigo-500 text-white px-4 py-1 rounded"
		onclick={fetchTranscriptsAndSaveToRedis}
	>
		Save Transcripts to Redis
	</button>
	<button
		class="bg-indigo-500 text-white px-4 py-1 rounded"
		onclick={fetchTranscriptsAndSaveToJson}
	>
		Save Transcripts to JSON
	</button>
{/if}

<div class="w-full flex flex-row items-center justify-end px-12 py-6">
	<a href="https://www.youtube.com/@nutritiondetective" target="_blank" rel="noopener noreferrer">
		<button class="bg-indigo-500 text-white px-4 py-1 rounded">Go to Channel</button>
	</a>
</div>

<div class="container w-full flex flex-col items-center py-12 gap-y-12">
	<div class="flex flex-col items-center gap-y-4">
		<h1 class="text-3xl font-bold mb-4">Nutrition Detective Transcript Search</h1>
		<form
			method="POST"
			action="?/search"
			class="mb-4"
			use:enhance={() => {
				isSearching = true;

				return async ({ update }) => {
					await update();
					isSearching = false;
				};
			}}
		>
			<input
				type="text"
				name="query"
				placeholder="Search transcripts..."
				class="px-2 py-1 border rounded"
				disabled={isSearching}
			/>
			<button
				type="submit"
				class="ml-3 px-2 py-1 bg-indigo-500 border-2 border-indigo-500 text-white text-semibold hover:bg-white hover:text-indigo-500 hover:border-indigo-500 hover:border-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={isSearching}
			>
				{isSearching ? 'Searching...' : 'Search'}
			</button>
		</form>

		{#if isSearching}
			<p class="text-gray-600 animate-pulse italic">Searching transcripts...</p>
		{/if}
	</div>

	<div class="flex flex-row gap-x-8 w-full min-h-screen">
		<div class="flex flex-col items-center gap-y-4 w-1/2">
			{#if form && form.results?.length > 0}
				<h2 class="text-2xl font-bold mb-4">Results</h2>

				<div class="w-full flex justify-center mb-4">
					<select bind:value={currentSort} class="px-2 py-1 border rounded">
						<option value="snippets">Sort by Matches</option>
						<option value="newest">Sort by Most Recent</option>
						<option value="oldest">Sort by Oldest</option>
					</select>
				</div>

				<div class="search-results">
					{#each sortResults(form.results) as result}
						<div class="result-item mb-4 p-4 border rounded">
							<div class="flex justify-between items-start mb-2">
								<h3 class="font-bold">{decodeHtmlEntities(result.title)}</h3>
								<span class="text-sm text-gray-500">
									{new Date(result.publishedAt).toLocaleDateString()}
								</span>
							</div>
							<div class="mt-4 flex flex-col items-start gap-y-6">
								{#each result.snippets.slice(0, expandedResults[result.videoId] ? undefined : 3) as snippet}
									<div class="flex flex-col items-start gap-y-2">
										<span class="italic">
											{@html highlightSearchText(decodeHtmlEntities(snippet.snippet), form.query)}
										</span>
										<div class="flex flex-row items-center gap-x-2">
											<!-- Timestamp -->
											<span> Timestamp: {snippet.timestamp}</span>

											<!-- Play button -->
											<button
												class="text-gray-600 hover:text-indigo-500"
												onclick={() => handleVideoSelect(result.videoId, snippet.timestamp)}
											>
												<Play size={20} />
											</button>

											<!-- Link to YouTube -->
											<a
												href={generateYoutubeTimestampUrl(result.videoId, snippet.timestamp)}
												target="_blank"
												rel="noopener noreferrer"
											>
												<Link size={20} />
											</a>
										</div>
									</div>
								{/each}

								{#if result.snippets.length > 3}
									<button
										class="text-indigo-500 hover:text-indigo-700 font-medium"
										onclick={() => toggleExpansion(result.videoId)}
									>
										{expandedResults[result.videoId]
											? 'Show less'
											: `Show ${result.snippets.length - 3} more snippets`}
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else if !isSearching && form && form.results?.length === 0}
				<p>No results found</p>
			{:else}
				<p>Your search results will appear here.</p>
			{/if}
		</div>
		<div class="w-1/2 sticky top-4 h-fit">
			{#if currentVideoId}
				<div class="aspect-video">
					<iframe
						width="100%"
						height="100%"
						src={`https://www.youtube.com/embed/${currentVideoId}${autoPlay ? '&autoplay=1' : ''}`}
						title="YouTube video player"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				</div>
			{:else}
				<div class="aspect-video bg-gray-100 flex items-center justify-center">
					<p class="text-gray-500">Select a video to play</p>
				</div>
			{/if}

			<h4 class="text-lg font-bold mt-8">Options</h4>
			<div class="flex flex-col items-start gap-y-2">
				<label class="flex items-center gap-x-2 text-gray-600 hover:text-indigo-500 cursor-pointer">
					<input type="checkbox" class="form-checkbox" bind:checked={autoPlay} />
					Auto-play when loaded
				</label>
			</div>
		</div>
	</div>
</div>
