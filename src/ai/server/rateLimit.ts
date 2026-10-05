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

export const TURNS_PER_MINUTE = 20;
export const REQUESTS_PER_MINUTE = 120;

// The chat's limit: 20 turns a minute for each address. A turn makes one request per tool round
// (up to about 43), so those are only held to a looser cap, and a long turn is never cut off.
export function createChatLimiter(now: () => number = Date.now) {
  const turns = createRateLimiter(TURNS_PER_MINUTE, 60_000, now);
  const requests = createRateLimiter(REQUESTS_PER_MINUTE, 60_000, now);
  return (key: string, newTurn: boolean): boolean => requests(key) && (!newTurn || turns(key));
}
