<script lang="ts">
	// Types
	// import type { SearchResult } from '$lib/types';

	async function testYoutubeAPI() {
		const response = await fetch('/api/youtube/test');
		const data = await response.json();
		console.log(data);
	}

	async function getChannelId() {
		const response = await fetch('/api/youtube/get-channel-id?username=NutritionDetective');
		const data = await response.json();
		console.log(data);
	}
</script>

<button onclick={testYoutubeAPI}> Test Youtube API </button>

<button onclick={getChannelId}> Get Channel ID </button>
