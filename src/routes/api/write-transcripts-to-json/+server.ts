/***
 * This endpoint is only used locally to get historical transcripts.
 ***/

// Types
import type { RequestHandler } from './$types';

// Helpers
import { json } from '@sveltejs/kit';
import { writeTranscriptsToJson } from '$lib/server/writeTranscriptsToJson';

export const GET: RequestHandler = async () => {
	try {
		const transcripts = await writeTranscriptsToJson();
		return json({ success: true, data: transcripts });
	} catch (error) {
		console.error('Error updating transcripts:', error);
		return json({ success: false, error: String(error) }, { status: 500 });
	}
};
