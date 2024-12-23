declare module 'youtube-transcript-api' {
	export interface TranscriptResponse {
		text: string;
		start: number;
		duration: number;
	}

	export class YoutubeTranscript {
		static fetchTranscript(videoId: string): Promise<TranscriptResponse[]>;
	}
}
