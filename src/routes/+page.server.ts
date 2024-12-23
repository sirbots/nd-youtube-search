// Types
import type { Actions } from './$types';
import type { SearchResult, SearchResultSnippet, TranscriptSegment } from '$lib/types';

// Helpers
import { readdir, readFile } from 'fs/promises';
import path from 'path';

// Constants
const TRANSCRIPTS_DIR = 'src/lib/server/data/transcripts';

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

		// Read all transcript files
		const files = await readdir(TRANSCRIPTS_DIR);

		for (const file of files) {
			if (!file.endsWith('.json')) continue;

			const content = await readFile(path.join(TRANSCRIPTS_DIR, file), 'utf-8');
			const yearData = JSON.parse(content);

			// Search through each video in the year's data
			for (const videoId in yearData.videos) {
				const video = yearData.videos[videoId];

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

						// Add all snippets to video's results (removed 3-snippet limit)
						const currentResult = videoResults.get(videoId);
						if (currentResult) {
							currentResult.snippets.push({
								timestamp: formatTimestamp(segment.offset),
								snippet: segment.text
							});
						}
					}
				}

				// Total snippets count is now the same as snippets.length
				const currentResult = videoResults.get(videoId);
				if (currentResult) {
					currentResult.totalSnippets = currentResult.snippets.length;
				}
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
