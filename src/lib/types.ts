export interface TranscriptSegment {
	text: string;
	offset: number;
	duration: number;
}

export interface VideoData {
	id: string;
	title: string;
	publishedAt: string;
	transcript: TranscriptSegment[];
	updatedAt: string;
	transcriptDisabled?: boolean;
}

export interface TranscriptDB {
	videos: Record<string, VideoData>;
}

// Add types for the youtube-transcript response
export interface TranscriptResponse {
	text: string;
	offset: number; // this is what youtube-transcript calls 'start'
	duration: number;
}

interface SearchResult {
	videoId: string;
	title: string;
	matchedSnippets: { start: number; text: string }[];
}
