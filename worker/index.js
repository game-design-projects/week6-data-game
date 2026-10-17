// Cloudflare Worker in front of the static assets. Only /api/fetch is handled here:
// it fetches an allowed upstream once per UTC day (Cache API), and the browser caches
// the same response for the same window. Everything else goes to the assets.
import { upstreamTarget, secondsUntilNextUtcDay } from './allow.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/fetch') return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 });

    const target = upstreamTarget(url.searchParams.get('url'));
    if (!target) return new Response('upstream not allowed', { status: 403 });

    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;

    const upstream = await fetch(target, { headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.8' } });
    if (!upstream.ok) return new Response(`upstream ${upstream.status}`, { status: 502, headers: { 'cache-control': 'no-store' } });

    const res = new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'cache-control': `public, max-age=${secondsUntilNextUtcDay()}`,
      },
    });
    ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  },
};
