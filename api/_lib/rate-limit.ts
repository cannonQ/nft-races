/**
 * Simple in-memory rate limiter for serverless functions.
 *
 * Process-local (not distributed) — catches rapid-fire abuse from warm
 * function instances but does NOT protect against distributed attacks
 * or requests hitting cold-start instances.
 *
 * For production-grade rate limiting, consider:
 * - Vercel WAF (paid)
 * - Upstash Redis + @upstash/ratelimit (free tier: 10k/day)
 * - Cloudflare proxy
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Periodic cleanup to prevent memory leaks in long-lived processes. */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

/**
 * Check if a request should be rate-limited.
 *
 * @param key       Unique identifier (typically `${ip}:${action}`)
 * @param limit     Max requests per window (default: 30)
 * @param windowMs  Time window in milliseconds (default: 60 seconds)
 */
export function checkRateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60_000,
): { limited: boolean; retryAfter?: number } {
  const now = Date.now();

  // Cleanup when store gets large
  if (store.size > 5000) cleanup();

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;

  if (entry.count > limit) {
    return {
      limited: true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return { limited: false };
}

/**
 * Extract the client IP from Vercel request headers.
 * Uses x-forwarded-for (set by Vercel's proxy) or x-real-ip as fallback.
 */
export function getClientIp(req: { headers: Record<string, any> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;
  return 'unknown';
}
