// Types
import type { TranscriptDB, VideoData } from '$lib/types/types';
import type { GaxiosResponse } from 'googleapis-common';

// Helpers
import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import { youtube_v3 } from 'googleapis';
import { Redis } from '@upstash/redis';

// Data
import { YOUTUBE_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN } from '$env/static/private';

// Initialize Redis client
const redis = new Redis({
	url: KV_REST_API_URL,
	token: KV_REST_API_TOKEN
});

export const youtube = google.youtube({
	version: 'v3',
	auth: YOUTUBE_API_KEY
});

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

	// Initialize transcript DB
	let transcriptDB: TranscriptDB = { videos: {} };

	// Get uploads playlist ID
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
			items.push(...response.data.items);
		}

		pageToken = response.data.nextPageToken || undefined;
	} while (pageToken);

	for (const item of items) {
		const videoId = item.snippet?.resourceId?.videoId;
		if (!videoId || !item.snippet) continue;

		// Check if we already have this video's transcript
		const existingVideo = await redis.get<VideoData>(`video:${videoId}`);

		// Add check for content changes
		if (
			existingVideo &&
			existingVideo.title === item.snippet.title &&
			existingVideo.publishedAt === item.snippet.publishedAt
		) {
			transcriptDB.videos[videoId] = existingVideo;
			console.log(`Skipping video ${videoId}: No changes detected`);
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

			// Only write if content is different
			if (
				!existingVideo ||
				JSON.stringify(existingVideo.transcript) !== JSON.stringify(videoData.transcript)
			) {
				await redis.set(`video:${videoId}`, videoData);
				console.log(`Updated video ${videoId}: Content changed`);
			} else {
				console.log(`Skipping video ${videoId}: Transcript unchanged`);
			}

			transcriptDB.videos[videoId] = videoData;
		} catch (err: any) {
			if (err.toString().includes('Transcript is disabled')) {
				console.log(`Skipping video ${videoId}: Transcript is disabled`);
				const videoData = {
					id: videoId,
					title: item.snippet.title || '',
					publishedAt: item.snippet.publishedAt || new Date().toISOString(),
					transcript: [],
					updatedAt: new Date().toISOString(),
					transcriptDisabled: true
				};
				// Store disabled transcript info
				await redis.set(`video:${videoId}`, videoData);
				transcriptDB.videos[videoId] = videoData;
			} else {
				console.error(`Failed to get transcript for video ${videoId}:`, err);
			}
		}
	}

	return transcriptDB;
}
