// Simple in-memory IP-based rate limiter.
// For multi-instance deployments, swap the store for a Redis-backed solution
// (e.g. @upstash/ratelimit with a Redis adapter).

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Purge expired entries every 5 minutes to prevent unbounded memory growth.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  },
  5 * 60 * 1000,
);

export function rateLimit(
  ip: string,
  limit = 20,
  windowMs = 60_000,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(ip);

  // Treat all "unknown" IPs as one bucket only if there's genuinely no IP data.
  // In production behind nginx, x-real-ip is always set, so this is a fallback.
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
