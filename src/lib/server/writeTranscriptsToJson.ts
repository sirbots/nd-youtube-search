// Types
import type { TranscriptDB, VideoData } from '$lib/types/types';
import type { GaxiosResponse } from 'googleapis-common';

// Helpers
import { youtube } from '$lib/server/youtube';
import { YoutubeTranscript } from 'youtube-transcript';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { youtube_v3 } from 'googleapis';

// New correct ID
const TRANSCRIPTS_DIR = 'src/lib/data/transcripts';

// Add this function to get the uploads playlist ID
async function getUploadsPlaylistId(channelId: string) {
	const response = await youtube.channels.list({
		id: [channelId],
		part: ['contentDetails']
	});
	return response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
}

// Add this function to get channel ID from handle
async function getChannelId(handle: string) {
	const response = await youtube.search.list({
		q: handle,
		type: ['channel'],
		part: ['id', 'snippet']
	});

	return response.data.items?.[0]?.id?.channelId;
}

export async function writeTranscriptsToJson(): Promise<TranscriptDB> {
	const channelId = await getChannelId('NutritionDetective');
	if (!channelId) {
		throw new Error('Could not find channel ID');
	}
	console.log('channelId', channelId);

	// Create directory if it doesn't exist
	await mkdir(TRANSCRIPTS_DIR, { recursive: true });

	// Initialize map to store transcripts by year
	const transcriptsByYear: Record<string, TranscriptDB> = {};

	// Get all videos from the channel
	let pageToken: string | undefined = undefined;
	const items: any[] = [];

	// Pass the channelId to getUploadsPlaylistId
	const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
	if (!uploadsPlaylistId) {
		throw new Error('Could not find uploads playlist');
	}

	// Remove year filtering when getting videos
	do {
		const response: GaxiosResponse<youtube_v3.Schema$PlaylistItemListResponse> =
			await youtube.playlistItems.list({
				playlistId: uploadsPlaylistId,
				part: ['snippet'],
				maxResults: 50,
				pageToken
			});

		if (response.data.items) {
			items.push(...response.data.items);
		}

		pageToken = response.data.nextPageToken || undefined;
	} while (pageToken);

	// Process videos and organize by year
	for (const item of items) {
		const videoId = item.snippet?.resourceId?.videoId;
		if (!videoId || !item.snippet) continue;

		const publishedYear = new Date(item.snippet.publishedAt).getFullYear().toString();

		// Load year's JSON file if not already loaded
		if (!transcriptsByYear[publishedYear]) {
			try {
				const content = await readFile(`${TRANSCRIPTS_DIR}/${publishedYear}.json`, 'utf-8');
				transcriptsByYear[publishedYear] = JSON.parse(content);
			} catch {
				transcriptsByYear[publishedYear] = { videos: {} };
			}
		}

		// Skip if video already exists in any year's JSON
		if (transcriptsByYear[publishedYear].videos[videoId]) {
			console.log(`Skipping existing video: ${item.snippet.title}`);
			continue;
		}

		console.log('Getting transcript for', item.snippet.title);

		try {
			const transcript = await YoutubeTranscript.fetchTranscript(videoId);

			const videoData: VideoData = {
				id: videoId,
				title: item.snippet.title || '',
				publishedAt: item.snippet.publishedAt || new Date().toISOString(),
				transcript: transcript.map((segment) => ({
					text: segment.text,
					offset: segment.offset,
					duration: segment.duration
				})),
				updatedAt: new Date().toISOString()
			};

			// Save to the appropriate year's DB
			transcriptsByYear[publishedYear].videos[videoId] = videoData;
		} catch (err: any) {
			// Add specific handling for disabled transcripts
			if (err.toString().includes('Transcript is disabled')) {
				console.log(`Skipping video ${videoId}: Transcript is disabled`);
				transcriptsByYear[publishedYear].videos[videoId] = {
					id: videoId,
					title: item.snippet.title || '',
					publishedAt: item.snippet.publishedAt || new Date().toISOString(),
					transcript: [],
					updatedAt: new Date().toISOString(),
					transcriptDisabled: true
				};
			} else {
				console.error(`Failed to get transcript for video ${videoId}:`, err);
			}
		}
	}

	// Save all modified year files
	for (const [year, yearDB] of Object.entries(transcriptsByYear)) {
		await writeFile(`${TRANSCRIPTS_DIR}/${year}.json`, JSON.stringify(yearDB, null, 2));
	}

	// Return current year's transcript DB for compatibility
	const currentYear = new Date().getFullYear().toString();
	return transcriptsByYear[currentYear] || { videos: {} };
}
