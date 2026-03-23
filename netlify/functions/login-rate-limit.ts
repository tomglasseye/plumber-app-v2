/**
 * Server-side IP-based login rate limiter.
 * Tracks failed login attempts by IP address using an in-memory Map.
 *
 * NOTE: The Map is reset on cold starts (Netlify function restarts).
 * This is acceptable — it means the window resets on restart, not
 * that protection is bypassed. For persistent rate limiting, replace
 * with a Redis/KV store.
 *
 * Limits: 10 attempts per 15-minute window per IP.
 */
import type { Context } from "@netlify/functions";

interface RateRecord {
	count: number;
	resetAt: number;
}

const attempts = new Map<string, RateRecord>();

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Clean up stale entries periodically to prevent memory growth
setInterval(() => {
	const now = Date.now();
	for (const [key, record] of attempts) {
		if (now >= record.resetAt) attempts.delete(key);
	}
}, 5 * 60 * 1000);

export default async (request: Request, context: Context) => {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	const ip =
		context.ip ??
		request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
		"unknown";

	const now = Date.now();
	const record = attempts.get(ip);

	if (record && now < record.resetAt) {
		if (record.count >= MAX_ATTEMPTS) {
			const retryAfter = Math.ceil((record.resetAt - now) / 1000);
			return new Response(
				JSON.stringify({
					blocked: true,
					retryAfter,
					message: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"Retry-After": String(retryAfter),
					},
				},
			);
		}
		record.count++;
	} else {
		attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
	}

	return new Response(JSON.stringify({ blocked: false }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
