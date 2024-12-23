// src/routes/+page.server.ts
import { transcriptsData } from '$lib/transcripts';
import type { Actions, PageServerLoad } from './$types';

/**
 * The load function can supply initial data if needed.
 * Here, we just provide an empty set of results by default.
 */
export const load: PageServerLoad = async () => {
	return {
		results: [],
		query: ''
	};
};

/**
 * Server actions for form submissions.
 * The name "search" must match the "action" attribute (or <button name="action" ...>).
 */
export const actions: Actions = {
	search: async ({ request }) => {
		const formData = await request.formData();
		const query = formData.get('query')?.toString().trim() ?? '';

		if (!query) {
			// Return no results if the query is empty.
			return { results: [], query };
		}

		const lowerQuery = query.toLowerCase();

		console.log('transcriptsData', transcriptsData);
		console.log('lowerQuery', lowerQuery);

		const results: Array<{
			videoId: string;
			title: string;
			matchedSnippets: Array<{
				start: number;
				text: string;
			}>;
		}> = [];

		console.log('results', results);

		// Naive search across all transcripts
		for (const video of transcriptsData) {
			console.log('video', video);
			const matchedSnippets: Array<{ start: number; text: string }> = [];

			for (const line of video.transcript) {
				console.log('lowerQuery', lowerQuery);
				console.log('line', line);
				if (line.text.toLowerCase().includes(lowerQuery)) {
					matchedSnippets.push({
						start: line.start,
						text: line.text
					});
				}
			}

			console.log('matchedSnippets', matchedSnippets);

			if (matchedSnippets.length > 0) {
				results.push({
					videoId: video.videoId,
					title: video.title,
					matchedSnippets
				});
			}
		}

		console.log('results', results);

		return { results, query };
	}
};
