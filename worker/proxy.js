// The /api/fetch handler, shared by the Worker (worker/index.js) and the local server (scripts/serve.mjs).
//
// Caching: the upstream request carries cf.cacheEverything + cacheTtlByStatus, so Cloudflare's own
// cache keeps a 2xx answer until the next 00:00 UTC (fetched once per edge location per puzzle day) and
// never keeps an error. That is the subrequest cache, not caches.default: the Cache API does nothing on
// *.workers.dev. The browser gets `max-age` for the time left in the UTC day, recomputed on every request.
// Concurrent misses are not merged here: sharing a promise between requests is not allowed in Workers.
import { upstreamTarget, secondsUntilNextUtcDay, classifyBody, MAX_BODY_BYTES } from '../engine/upstream.js';

const UA = 'daily-data-games/1.0 (+https://github.com/game-design-projects/week6-data-game)';
const ACCEPT = 'application/json, text/plain;q=0.9, image/png;q=0.8, */*;q=0.5';
const MAX_HOPS = 3;

const drop = (res) => { try { res.body?.cancel(); } catch { /* already consumed */ } };
const fail = (error) => ({ error });

/** Fetch `target` (following redirects only to allowed upstreams) and check the body. Never throws. */
async function load(target, ttl, fetchUpstream) {
  let url = target;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let res;
    try {
      res = await fetchUpstream(url.href, {
        redirect: 'manual',
        headers: { accept: ACCEPT, 'user-agent': UA },
        cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '300-599': 0 } },
      });
    } catch { return fail('upstream unreachable'); }

    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (location) {
      drop(res);
      try { url = upstreamTarget(new URL(location, url).href); } catch { url = null; }
      if (!url) return fail('upstream redirect not allowed');
      continue;
    }
    if (!res.ok) { drop(res); return fail(`upstream ${res.status}`); }
    if (Number(res.headers.get('content-length')) > MAX_BODY_BYTES) { drop(res); return fail('upstream body too large'); }

    let bytes;
    try { bytes = new Uint8Array(await res.arrayBuffer()); } catch { return fail('upstream unreachable'); }
    const kind = classifyBody(bytes, res.headers.get('content-type') ?? '');
    if (!kind) return fail('upstream returned an unusable body');
    return { bytes, type: kind.type, edge: res.headers.get('cf-cache-status') };
  }
  return fail('too many redirects');
}

const reply = (body, status, headers = {}) => new Response(body, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
});

/**
 * Answer `GET|HEAD /api/fetch?url=<upstream>`.
 * @param {Request} request
 * @param {object} [o]
 * @param {typeof fetch} [o.fetchUpstream]   injectable for tests
 * @param {() => number} [o.clock]           injectable for tests
 * @param {(p: Promise<unknown>) => void} [o.waitUntil]  keeps the upstream fetch (and its cache fill) alive after the client leaves
 * @param {boolean} [o.browserCache]         false for the dev server: always `no-store`
 */
export async function handleProxy(request, { fetchUpstream = fetch, clock = Date.now, waitUntil = () => {}, browserCache = true } = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return reply('method not allowed', 405, { allow: 'GET, HEAD' });
  const target = upstreamTarget(new URL(request.url).searchParams.get('url'));
  if (!target) return reply('upstream not allowed', 403);

  // Started before we wait, and handed to waitUntil: a client that gives up (crt.sh can outlast the
  // game's timeout) no longer cancels the upstream fetch, so the cache still fills for the next visitor.
  const work = load(target, secondsUntilNextUtcDay(clock()), fetchUpstream).catch(() => fail('proxy error'));
  waitUntil(work);
  const r = await work;
  if (r.error) return reply(r.error, 502);

  const headers = {
    'content-type': r.type,
    'cache-control': browserCache ? `public, max-age=${secondsUntilNextUtcDay(clock())}` : 'no-store',
    'content-security-policy': 'sandbox',
  };
  if (r.edge) headers['x-edge-cache'] = r.edge;
  return reply(request.method === 'HEAD' ? null : r.bytes, 200, headers);
}
