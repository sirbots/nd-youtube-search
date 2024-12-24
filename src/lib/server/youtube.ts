import { google } from 'googleapis';
import { YOUTUBE_API_KEY } from '$env/static/private';

export const youtube = google.youtube({
	version: 'v3',
	auth: YOUTUBE_API_KEY
});
