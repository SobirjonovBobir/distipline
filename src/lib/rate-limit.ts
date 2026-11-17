type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-process rate limit for auth routes.
 * Returns true when the request is allowed.
 */
export function allowRequest(
  key: string,
  opts: { limit: number; windowMs: number } = { limit: 20, windowMs: 15 * 60 * 1000 },
): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  if (current.count >= opts.limit) {
    return false;
  }
  current.count += 1;
  return true;
}

export function clientKey(request: Request, suffix: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "unknown";
  return `${suffix}:${ip}`;
}
