// Helpers
import { Redis } from '@upstash/redis';

// Data
import { KV_REST_API_URL, KV_REST_API_TOKEN } from '$env/static/private';

// Initialize Redis client
export const redis = new Redis({
	url: KV_REST_API_URL,
	token: KV_REST_API_TOKEN
});
