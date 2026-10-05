// At most `limit` requests per `windowMs` for each key, remembered in memory.
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return function allow(key: string): boolean {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(t);
    hits.set(key, recent);
    if (hits.size > 10_000) {
      for (const [k, times] of hits) if (times.every((at) => t - at >= windowMs)) hits.delete(k);
    }
    return allowed;
  };
}
