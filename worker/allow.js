// Shared by the Worker (worker/index.js) and the local server (scripts/serve.mjs).
// Hosts the live games fetch through /api/fetch. Anything else is refused.
export const ALLOWED_HOSTS = new Set([
  'api.open-meteo.com', 'archive-api.open-meteo.com', 'air-quality-api.open-meteo.com',
  'historical-forecast-api.open-meteo.com', 'wikimedia.org', 'data.cityofnewyork.us',
  'earthquake.usgs.gov', 'celestrak.org', 'hn.algolia.com', 'api.tidesandcurrents.noaa.gov', 'crt.sh',
]);

/** The https URL to fetch for `raw`, or null when it is not an allowed upstream. */
export function upstreamTarget(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname) ? u : null;
}

/** Seconds until the next 00:00 UTC, so a cached day expires with the puzzle day. */
export function secondsUntilNextUtcDay(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(60, Math.round((next - now) / 1000));
}
