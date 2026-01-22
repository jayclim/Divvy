/**
 * Simple in-memory rate limiter for public endpoints
 * Uses a sliding window approach with automatic cleanup
 * 
 * For production at scale, consider using Redis or Upstash
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory store for rate limiting
// In serverless environments, this resets on cold starts, which is acceptable
// for basic protection against abuse
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;

    lastCleanup = now;
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}

export interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    limit: number;
    /** Time window in seconds */
    windowSeconds: number;
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
}

/**
 * Check if a request should be rate limited
 * 
 * @param identifier - Unique identifier for the requester (IP, userId, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and headers info
 * 
 * @example
 * ```ts
 * const result = await checkRateLimit(ip, { limit: 10, windowSeconds: 60 });
 * if (!result.success) {
 *   return new Response('Too many requests', { status: 429 });
 * }
 * ```
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    cleanup();

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const key = identifier;

    const existing = rateLimitStore.get(key);

    if (!existing || existing.resetTime < now) {
        // New window
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs,
        });

        return {
            success: true,
            limit: config.limit,
            remaining: config.limit - 1,
            resetTime: now + windowMs,
        };
    }

    // Existing window
    const newCount = existing.count + 1;

    if (newCount > config.limit) {
        return {
            success: false,
            limit: config.limit,
            remaining: 0,
            resetTime: existing.resetTime,
        };
    }

    rateLimitStore.set(key, {
        count: newCount,
        resetTime: existing.resetTime,
    });

    return {
        success: true,
        limit: config.limit,
        remaining: config.limit - newCount,
        resetTime: existing.resetTime,
    };
}

/**
 * Get the client IP address from a request
 * Handles common proxy headers
 */
export function getClientIp(request: Request): string {
    // Check common proxy headers
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Vercel-specific header
    const vercelIp = request.headers.get('x-vercel-forwarded-for');
    if (vercelIp) {
        return vercelIp.split(',')[0].trim();
    }

    // Fallback - this will be the server IP in most cases
    return 'unknown';
}

/**
 * Helper to generate rate limit headers for responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    };
}

// Preset configurations for common use cases
export const RATE_LIMIT_PRESETS = {
    /** Strict: 5 requests per minute - for sensitive endpoints */
    strict: { limit: 5, windowSeconds: 60 },
    /** Standard: 20 requests per minute - for general public endpoints */
    standard: { limit: 20, windowSeconds: 60 },
    /** Relaxed: 60 requests per minute - for less sensitive endpoints */
    relaxed: { limit: 60, windowSeconds: 60 },
    /** Auth: 10 requests per 5 minutes - for auth-related endpoints */
    auth: { limit: 10, windowSeconds: 300 },
} as const;
