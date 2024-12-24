// Types
import type { TranscriptDB, VideoData } from '../src/lib/types/types';
import type { GaxiosResponse } from 'googleapis-common';

// Helpers
import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import { youtube_v3 } from 'googleapis';
import { Redis } from '@upstash/redis';

// Data
import { YOUTUBE_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN } from '$env/static/private';

import transcripts2024Json from '$lib/data/transcripts/2024.json';
const transcripts2024 = transcripts2024Json as TranscriptDB;

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

// Add this function
async function clearRedisDB() {
	const keys = await redis.keys('*');
	for (const key of keys) {
		await redis.del(key);
	}
	console.log('Redis database cleared');
}

export async function writeTranscriptsToRedis(): Promise<TranscriptDB> {
	// Clear Redis DB -- use this after updating a JSON file at the end of the year. That way, the new year's JSON file will be used and we'll save on Redis storage and processing time.
	// await clearRedisDB();

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
		const publishedAt = item.snippet?.publishedAt;
		if (!videoId || !item.snippet || !publishedAt) continue;

		// Skip videos published before 2024
		if (new Date(publishedAt).getFullYear() < 2024) {
			console.log(`Skipping video ${videoId}: Published before 2024`);
			continue;
		}

		// Check if video exists in 2024.json
		if (transcripts2024.videos[videoId]) {
			console.log(`Skipping video ${videoId}: Already exists in 2024.json`);
			continue;
		}

		// Check if we already have this video's transcript
		const existingVideo = await redis.get<VideoData>(`video:${videoId}`);

		// Add check for empty transcripts
		if (
			existingVideo &&
			existingVideo.transcript.length === 0 &&
			!existingVideo.transcriptDisabled
		) {
			console.log(`Found video ${videoId} with empty transcript, retrying...`);
		} else if (
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
