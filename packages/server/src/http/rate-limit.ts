interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Fixed-window rate limiter. Returns true when the request is allowed. */
export function isAllowed(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	if (bucket.count >= limit) return false;
	bucket.count += 1;
	return true;
}

export const RATE_LIMITS = {
	auth: { limit: 5, windowMs: 60_000 }, // 5/min/IP — login & token endpoints
	read: { limit: 100, windowMs: 60_000 }, // 100/min/key — public reads
	sync: { limit: 60, windowMs: 60_000 }, // 60/min/device — offline ingest
} as const;

export function clearRateLimits(): void {
	buckets.clear();
}
