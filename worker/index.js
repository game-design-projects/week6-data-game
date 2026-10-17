// Cloudflare Worker in front of the static assets. Only /api/fetch is handled here (worker/proxy.js):
// allowed live upstreams are fetched through Cloudflare's cache once per UTC day. Everything else
// goes to the assets.
import { handleProxy } from './proxy.js';

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/api/fetch') return env.ASSETS.fetch(request);
    return handleProxy(request, { waitUntil: (p) => ctx.waitUntil(p) });
  },
};
