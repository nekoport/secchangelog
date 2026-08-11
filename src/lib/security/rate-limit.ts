// In-memory rate limiter (single instance only)
// For multi-instance production, replace with Redis-based implementation

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  // Clean expired entries periodically
  if (store.size > 10000) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  if (!record || record.resetAt < now) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, newRecord);
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt: newRecord.resetAt,
      total: config.requests,
    };
  }

  if (record.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      total: config.requests,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: config.requests - record.count,
    resetAt: record.resetAt,
    total: config.requests,
  };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

// Helper for per-IP+endpoint rate limiting
export function getRateLimitKey(
  ip: string,
  endpoint: string,
  identifier?: string
): string {
  return identifier
    ? `${endpoint}:${identifier}:${ip}`
    : `${endpoint}:${ip}`;
}

// Get client IP from request headers (handle proxy)
// NOTE: Caddy appends the real client IP to X-Forwarded-For, so a client-supplied
// value would appear BEFORE the trusted one (e.g. "spoofed, real.ip"). Using the
// LAST entry prevents attackers from bypassing rate limits / spoofing audit IPs.
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp;
  return "unknown";
}
