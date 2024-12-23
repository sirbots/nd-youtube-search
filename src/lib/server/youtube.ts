// Types
import type { TranscriptDB, VideoData } from '$lib/types';
import type { GaxiosResponse } from 'googleapis-common';

// Helpers
import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import { writeFile, readFile, mkdir, readdir } from 'fs/promises';
import { youtube_v3 } from 'googleapis';

// Data
import { YOUTUBE_API_KEY } from '$env/static/private';

export const youtube = google.youtube({
	version: 'v3',
	auth: YOUTUBE_API_KEY
});

// New correct ID
const TRANSCRIPTS_DIR = 'src/lib/server/data/transcripts';

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

export async function updateTranscripts(): Promise<TranscriptDB> {
	const channelId = await getChannelId('NutritionDetective');
	if (!channelId) {
		throw new Error('Could not find channel ID');
	}
	console.log('channelId', channelId);

	// Create directory if it doesn't exist
	await mkdir(TRANSCRIPTS_DIR, { recursive: true });

	// Get current year
	const currentYear = new Date().getFullYear().toString();

	// Initialize transcript DB for current year only
	let transcriptDB: TranscriptDB = { videos: {} };

	// Load existing transcript for current year only
	try {
		const content = await readFile(`${TRANSCRIPTS_DIR}/${currentYear}.json`, 'utf-8');
		transcriptDB = JSON.parse(content);
	} catch {}

	// Pass the channelId to getUploadsPlaylistId
	const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
	if (!uploadsPlaylistId) {
		throw new Error('Could not find uploads playlist');
	}

	// Get all videos from the channel
	let pageToken: string | undefined = undefined;
	const items: any[] = [];

	do {
		const response: GaxiosResponse<youtube_v3.Schema$PlaylistItemListResponse> =
			await youtube.playlistItems.list({
				playlistId: uploadsPlaylistId,
				part: ['snippet'],
				maxResults: 50,
				pageToken
			});

		if (response.data.items) {
			// Filter items for current year only
			const currentYearItems = response.data.items.filter((item) => {
				const publishedAt = item.snippet?.publishedAt;
				return publishedAt && new Date(publishedAt).getFullYear().toString() === currentYear;
			});
			items.push(...currentYearItems);
		}

		pageToken = response.data.nextPageToken || undefined;
	} while (pageToken);

	// Process videos for current year only
	const yearDB: TranscriptDB = transcriptDB;

	for (const item of items) {
		const videoId = item.snippet?.resourceId?.videoId;
		if (!videoId || !item.snippet) continue;

		// Skip if we already have this video's transcript
		if (yearDB.videos[videoId]) continue;

		const publishedAt = item.snippet.publishedAt || new Date().toISOString();
		const year = new Date(publishedAt).getFullYear().toString();

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

			yearDB.videos[videoId] = videoData;
		} catch (err: any) {
			// Add specific handling for disabled transcripts
			if (err.toString().includes('Transcript is disabled')) {
				console.log(`Skipping video ${videoId}: Transcript is disabled`);
				yearDB.videos[videoId] = {
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

	// Save current year's transcripts
	await writeFile(`${TRANSCRIPTS_DIR}/${currentYear}.json`, JSON.stringify(yearDB, null, 2));

	// Return current year's transcript DB
	return yearDB;
}
