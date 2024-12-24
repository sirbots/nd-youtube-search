// Types
import type { Actions } from './$types';
import type { SearchResult, VideoData, TranscriptDB } from '$lib/types/types';

// Helpers
import { redis } from '$lib/server/redis';

// Functions
function formatTimestamp(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Add this import at the top
const transcriptFiles = import.meta.glob('/src/lib/data/transcripts/*.json', { eager: true });

// Actions
export const actions: Actions = {
	search: async ({ request }) => {
		const formData = await request.formData();
		const query = formData.get('query')?.toString().toLowerCase() ?? '';

		console.log('Performing search for:', query);

		if (!query) {
			console.log('No query provided');
			return { results: [], query };
		}

		const videoResults = new Map<string, SearchResult>();

		// 1. Search Redis database
		console.log('Searching Redis database...');
		const videoKeys = await redis.keys('video:*');
		for (const key of videoKeys) {
			const video = await redis.get<VideoData>(key);
			if (!video || video.transcriptDisabled) continue;
			await processVideoSearch(video, key.replace('video:', ''), query, videoResults);
		}

		// 2. Search JSON files
		console.log('Searching JSON files...');
		for (const [path, module] of Object.entries(transcriptFiles)) {
			const transcriptDB = module as { default: TranscriptDB };

			for (const [videoId, video] of Object.entries(transcriptDB.default.videos)) {
				// Skip if already found in Redis
				if (videoResults.has(videoId)) continue;

				await processVideoSearch(video, videoId, query, videoResults);
			}
		}

		return {
			results: Array.from(videoResults.values()),
			query
		};
	}
};

// Helper function to process search for a single video
async function processVideoSearch(
	video: VideoData,
	videoId: string,
	query: string,
	videoResults: Map<string, SearchResult>
) {
	const transcript = video.transcript;

	for (let i = 0; i < transcript.length; i++) {
		const segment = transcript[i];
		if (segment.text.toLowerCase().includes(query)) {
			if (!videoResults.has(videoId)) {
				videoResults.set(videoId, {
					videoId,
					title: video.title,
					publishedAt: video.publishedAt,
					snippets: [],
					totalSnippets: 0
				});
			}

			// Get surrounding segments
			const start = Math.max(0, i - 2);
			const end = Math.min(transcript.length - 1, i + 2);
			const contextSegments = transcript.slice(start, end + 1);

			// Combine the segments into one snippet
			const combinedText = contextSegments.map((seg) => seg.text).join(' ');

			const currentResult = videoResults.get(videoId);
			if (currentResult) {
				currentResult.snippets.push({
					timestamp: formatTimestamp(segment.offset),
					snippet: combinedText
				});
				currentResult.totalSnippets = currentResult.snippets.length;
			}
		}
	}
}
