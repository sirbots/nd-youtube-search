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

<svelte:head>
	<title>Nutrition Detective Transcript Search</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta
		name="description"
		content="Search Nutrition Detective's YouTube channel for specific topics."
	/>
</svelte:head>

{#if ENV_MODE === 'development'}
	<button onclick={fetchTranscriptsAndSaveToRedis}>Save Transcripts to Redis</button>
	<button onclick={fetchTranscriptsAndSaveToJson}>Save Transcripts to JSON</button>
{/if}

<div class="w-full flex flex-row items-center justify-center md:justify-end px-12 py-6">
	<a href="https://www.youtube.com/@nutritiondetective" target="_blank" rel="noopener noreferrer">
		<button>Go to Channel</button>
	</a>
</div>

<div class="h-screen flex flex-col items-center justify-between">
	<div class="container w-full flex flex-col items-center py-12 gap-y-12">
		<div class="flex flex-col items-center gap-y-4">
			<h1 class="text-2xl md:text-3xl font-bold mb-4 text-center">
				Nutrition Detective Transcript Search
			</h1>
			<form
				method="POST"
				action="?/search"
				class="mb-4 flex flex-col items-center md:flex-row md:gap-x-4"
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
				<button class="w-full mt-2 md:mt-0 md:w-1/2" type="submit" disabled={isSearching}>
					{isSearching ? 'Searching...' : 'Search'}
				</button>
			</form>

			{#if isSearching}
				<p class="text-gray-600 animate-pulse italic">Searching transcripts...</p>
			{/if}
			<p class="text-gray-600 italic">
				Tip: use short search phrases like "vitamin A" or "bile acid" for better results.
			</p>
		</div>

		<div
			class="flex mt-0 md:mt-16 flex-col md:items-start items-center gap-y-4 w-full md:flex-row-reverse md:gap-x-8"
		>
			{#if form && form.results?.length > 0}
				<div class="md:w-1/2 sticky top-0 md:top-8 h-fit bg-white w-full">
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

					<div class="flex flex-col md:items-start items-center gap-y-2 mt-2 pb-4">
						<label
							class="flex items-center gap-x-2 text-gray-600 hover:text-indigo-500 cursor-pointer"
						>
							<input type="checkbox" class="form-checkbox" bind:checked={autoPlay} />
							Auto-play
						</label>
					</div>
				</div>

				<div class="flex flex-col items-center md:w-1/2">
					<h2 class="text-xl md:text-2xl font-bold mb-4">Results</h2>
					<div class="w-full flex justify-center mb-4">
						<select bind:value={currentSort} class="px-2 py-1 border rounded">
							<option value="snippets">Sort by Matches</option>
							<option value="newest">Sort by Most Recent</option>
							<option value="oldest">Sort by Oldest</option>
						</select>
					</div>

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
												class="bg-white border border-blue-500 text-blue-500 px-2 py-1 rounded"
												onclick={() => handleVideoSelect(result.videoId, snippet.timestamp)}
											>
												<Play size={12} />
											</button>

											<!-- Link to YouTube -->
											<a
												href={generateYoutubeTimestampUrl(result.videoId, snippet.timestamp)}
												class="bg-white border border-blue-500 text-blue-500 px-2 py-1 rounded"
												target="_blank"
												rel="noopener noreferrer"
											>
												<Link size={12} />
											</a>
										</div>
									</div>
								{/each}

								{#if result.snippets.length > 3}
									<button
										class="bg-white border border-blue-500 text-blue-500 px-2 py-1 rounded"
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
				<p></p>
			{/if}
		</div>
	</div>
	<div class=" mt-4 container py-12">
		Built and maintained by <a href="https://x.com/fun_and_profit" target="_blank">@sirbots</a>. Not
		affiliated with Nutrition Detective. Released under the
		<a
			href="https://github.com/sirbots/nutrition-detective-search/blob/main/LICENSE"
			target="_blank">GNU GPLv3 License</a
		>. All YouTube content belongs to their respective owners.
	</div>
</div>
