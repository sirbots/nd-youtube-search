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

export interface SearchResult {
	videoId: string;
	title: string;
	publishedAt: string;
	snippets: SearchResultSnippet[];
	totalSnippets: number;
}

export interface SearchResultSnippet {
	timestamp: string;
	snippet: string;
}
