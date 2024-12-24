// Types
import type { Actions } from './$types';
import type { SearchResult, SearchResultSnippet, TranscriptSegment, VideoData } from '$lib/types';

// Helpers
import { Redis } from '@upstash/redis';
import { KV_REST_API_URL, KV_REST_API_TOKEN } from '$env/static/private';

// Initialize Redis client
const redis = new Redis({
	url: KV_REST_API_URL,
	token: KV_REST_API_TOKEN
});

// Functions
function formatTimestamp(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Actions
export const actions: Actions = {
	search: async ({ request }) => {
		const formData = await request.formData();
		const query = formData.get('query')?.toString().toLowerCase() ?? '';

		if (!query) {
			return { results: [], query };
		}

		const searchResults: SearchResult[] = [];
		const videoResults = new Map<string, SearchResult>();

		// Get all video keys from Redis
		const videoKeys = await redis.keys('video:*');

		// Process each video
		for (const key of videoKeys) {
			const video = await redis.get<VideoData>(key);
			if (!video) continue;

			const videoId = key.replace('video:', '');

			// Skip videos with disabled transcripts
			if (video.transcriptDisabled) continue;

			// Search through transcript segments
			for (const segment of video.transcript) {
				if (segment.text.toLowerCase().includes(query)) {
					// Get or create video result entry
					if (!videoResults.has(videoId)) {
						videoResults.set(videoId, {
							videoId: videoId,
							title: video.title,
							publishedAt: video.publishedAt,
							snippets: [],
							totalSnippets: 0
						});
					}

					// Add snippet to video's results
					const currentResult = videoResults.get(videoId);
					if (currentResult) {
						currentResult.snippets.push({
							timestamp: formatTimestamp(segment.offset),
							snippet: segment.text
						});
					}
				}
			}

			// Update total snippets count
			const currentResult = videoResults.get(videoId);
			if (currentResult) {
				currentResult.totalSnippets = currentResult.snippets.length;
			}
		}

		// Convert Map to array of SearchResults
		searchResults.push(...videoResults.values());

		return {
			results: searchResults,
			query
		};
	}
};
