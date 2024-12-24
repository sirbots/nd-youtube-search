// Types
import type { RequestHandler } from './$types';

// Helpers
import { json } from '@sveltejs/kit';
import { writeTranscriptsToRedis } from '../../../../api/writeTranscriptsToRedis';

export const GET: RequestHandler = async () => {
	try {
		const transcripts = await writeTranscriptsToRedis();
		return json({ success: true, data: transcripts });
	} catch (error) {
		console.error('Error updating transcripts:', error);
		return json({ success: false, error: String(error) }, { status: 500 });
	}
};
