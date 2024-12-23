/**
 * Example data structure for transcripts.
 * In a real scenario, you'd dynamically fetch or store these in a DB.
 */
export const transcriptsData = [
	{
		videoId: 'VIDEO_ID_1',
		title: 'Nutrition Video 1',
		transcript: [
			{ start: 10, duration: 5, text: 'Hello and welcome to this nutrition video...' },
			{ start: 20, duration: 5, text: 'We will discuss the importance of vitamin C...' }
			// ...
		]
	},
	{
		videoId: 'VIDEO_ID_2',
		title: 'Nutrition Video 2',
		transcript: [
			{ start: 15, duration: 4, text: 'In this episode, we talk about intermittent fasting...' }
			// ...
		]
	}
	// ... add more video transcripts
];
