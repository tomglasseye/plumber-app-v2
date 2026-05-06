/**
 * Server-side login rate limiter.
 *
 * Two-phase API:
 *   POST { phase: "check", email? }            → 429 if blocked, else 200
 *   POST { phase: "record-failure", email? }   → 200 (increments counters)
 *
 * Successful logins must NOT call record-failure, so they don't count toward
 * the lockout. Both phases gate on IP and (when provided) email so a single
 * NAT'd office isn't slowed by one bad actor and one user across many IPs is.
 *
 * IP comes only from `context.ip` — the `x-forwarded-for` header is
 * client-controllable on Netlify Functions and would let attackers spoof
 * their way out of the limit. If the IP is missing, fail closed.
 *
 * State is in-memory: resets on cold start, separate per function instance.
 * Adequate for a small SaaS as a first line; Supabase Auth has its own
 * server-side limits behind this. Replace with a table or KV store for
 * persistent enforcement.
 */
import type { Context } from "@netlify/functions";

interface RateRecord {
	count: number;
	resetAt: number;
}

const ipAttempts = new Map<string, RateRecord>();
const emailAttempts = new Map<string, RateRecord>();

const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function evictExpired(map: Map<string, RateRecord>, now: number) {
	for (const [key, rec] of map) {
		if (now >= rec.resetAt) map.delete(key);
	}
}

function isBlocked(map: Map<string, RateRecord>, key: string, limit: number, now: number): number {
	const rec = map.get(key);
	if (!rec || now >= rec.resetAt) return 0;
	if (rec.count >= limit) return Math.ceil((rec.resetAt - now) / 1000);
	return 0;
}

function record(map: Map<string, RateRecord>, key: string, now: number) {
	const rec = map.get(key);
	if (rec && now < rec.resetAt) {
		rec.count++;
	} else {
		map.set(key, { count: 1, resetAt: now + WINDOW_MS });
	}
}

function blockedResponse(retryAfter: number) {
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

export default async (request: Request, context: Context) => {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	const ip = context.ip;
	if (!ip) {
		return new Response(JSON.stringify({ error: "IP unavailable" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: { phase?: string; email?: string } = {};
	try {
		body = await request.json();
	} catch {
		// empty body is fine
	}
	const phase = body.phase === "record-failure" ? "record-failure" : "check";
	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;

	const now = Date.now();
	evictExpired(ipAttempts, now);
	evictExpired(emailAttempts, now);

	const ipBlocked = isBlocked(ipAttempts, ip, IP_LIMIT, now);
	const emailBlocked = email ? isBlocked(emailAttempts, email, EMAIL_LIMIT, now) : 0;
	const retryAfter = Math.max(ipBlocked, emailBlocked);

	if (retryAfter > 0) return blockedResponse(retryAfter);

	if (phase === "record-failure") {
		record(ipAttempts, ip, now);
		if (email) record(emailAttempts, email, now);
	}

	return new Response(JSON.stringify({ blocked: false }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
