// fetch for live data. Allowed upstreams (engine/upstream.js) go through the Worker's /api/fetch, which
// serves one cached copy per UTC day. Any other URL is fetched directly, and so is an allowed one when
// the proxy is missing or failing (static host, file://, Worker error), so a game never needs the Worker.
import { upstreamTarget } from './upstream.js';

/** fetch with a timeout; a non-2xx answer throws an Error that carries `.status`. */
export async function fetchWithTimeout(url, { timeout = 10000, ...init } = {}, fetchImpl = fetch) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetchImpl(url, { ...init, signal: ac.signal });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { status: res.status });
    return res;
  } finally { clearTimeout(t); }
}

// No Worker route (404/405), a Worker or upstream failure (5xx) or no network at all (TypeError) → try
// the upstream directly. A timeout is not retried: the time budget is spent.
const proxyUnavailable = (e) => e.name !== 'AbortError' && (e.status === undefined || e.status === 404 || e.status === 405 || e.status >= 500);

/**
 * @param {string} url
 * @param {{ timeout?: number, reload?: boolean, init?: RequestInit }} [o]  `init` only applies to direct requests: the proxy takes the URL alone
 * @param {{ fetchImpl?: typeof fetch, proxy?: URL | string, here?: string }} [env]  injectable for tests
 */
export async function fetchLive(url, { timeout = 10000, reload = false, init = {} } = {}, env = {}) {
  const { fetchImpl = fetch, proxy = new URL('../api/fetch', import.meta.url), here = globalThis.location?.href } = env;
  const abs = new URL(url, here);
  const cache = reload ? { cache: 'reload' } : {};
  const direct = (ms) => fetchWithTimeout(abs.href, { ...init, ...cache, timeout: ms }, fetchImpl);
  if ((here && abs.origin === new URL(here).origin) || !upstreamTarget(abs.href)) return direct(timeout);

  const started = Date.now();
  try {
    return await fetchWithTimeout(`${proxy}?url=${encodeURIComponent(abs.href)}`, { ...cache, timeout }, fetchImpl);
  } catch (e) {
    if (!proxyUnavailable(e)) throw e;
    return direct(Math.max(2000, timeout - (Date.now() - started)));
  }
}
