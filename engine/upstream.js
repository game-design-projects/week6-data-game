// Shared by the browser (engine/livefetch.js), the Worker and the local server (worker/proxy.js).
// Which live upstreams the games may fetch, and how a response body is checked before it is served.
// Adding a live game on a new host? Add the host and the path prefixes it calls here.

/** host → allowed path prefixes. Everything else is refused (and fetched directly by the browser). */
export const ALLOWED = {
  'api.open-meteo.com': ['/v1/forecast'],
  'archive-api.open-meteo.com': ['/v1/archive'],
  'air-quality-api.open-meteo.com': ['/v1/air-quality'],
  'historical-forecast-api.open-meteo.com': ['/v1/forecast'],
  'wikimedia.org': ['/api/rest_v1/metrics/pageviews/'],
  'data.cityofnewyork.us': ['/resource/'],
  'earthquake.usgs.gov': ['/fdsnws/event/1/query'],
  'celestrak.org': ['/NORAD/elements/gp.php'],
  'hn.algolia.com': ['/api/v1/search'],
  'api.tidesandcurrents.noaa.gov': ['/api/prod/datagetter'],
  'crt.sh': ['/'],
  'mesonet.agron.iastate.edu': ['/archive/data/'],
};

/** The https URL to fetch for `raw`, or null when it is not an allowed upstream. */
export function upstreamTarget(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
  const prefixes = ALLOWED[u.hostname];
  return prefixes?.some((p) => u.pathname.startsWith(p)) ? u : null;
}

/** Seconds until the next 00:00 UTC, so a cached day expires with the puzzle day. */
export function secondsUntilNextUtcDay(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(60, Math.round((next - now) / 1000));
}

export const MAX_BODY_BYTES = 20 * 1024 * 1024;

const isSpace = (b) => b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d;

/**
 * What a fetched body is, from its bytes (the upstream content-type is not trusted):
 * `{ type }` with the content-type to serve it as, or null when it must not be served or cached.
 * Accepts PNG images, complete non-empty JSON objects/arrays, and plain text/CSV.
 */
export function classifyBody(bytes, contentType = '') {
  if (!bytes.length || bytes.length > MAX_BODY_BYTES) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: 'image/png' };
  let first = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0; // UTF-8 BOM
  while (first < bytes.length && isSpace(bytes[first])) first++;
  let last = bytes.length - 1;
  while (last > first && isSpace(bytes[last])) last--;
  const open = bytes[first], close = bytes[last];
  if ((open === 0x7b && close === 0x7d) || (open === 0x5b && close === 0x5d)) { // {…} or […]
    let i = first + 1;
    while (i < last && isSpace(bytes[i])) i++;
    return i < last ? { type: 'application/json; charset=utf-8' } : null; // {} and [] are treated as a failed load
  }
  return /^text\/(plain|csv)\b/i.test(contentType) && last >= first ? { type: 'text/plain; charset=utf-8' } : null;
}
