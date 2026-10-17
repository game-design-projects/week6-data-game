// The live-data proxy: allowlist, body checks, the /api/fetch handler (shared by the Worker and
// scripts/serve.mjs), the browser's proxy-then-direct fetch, and that every live game only asks for
// URLs the allowlist covers.   node --test tests/proxy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upstreamTarget, secondsUntilNextUtcDay, classifyBody, ALLOWED } from '../engine/upstream.js';
import { handleProxy } from '../worker/proxy.js';
import { fetchLive } from '../engine/livefetch.js';
import * as core from '../engine/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const enc = (s) => new TextEncoder().encode(s);

// ───────── allowlist ─────────
test('upstreamTarget allows listed https hosts and paths only', () => {
  assert.equal(upstreamTarget('https://api.open-meteo.com/v1/forecast?x=1')?.hostname, 'api.open-meteo.com');
  assert.equal(upstreamTarget('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson')?.hostname, 'earthquake.usgs.gov');
  assert.equal(upstreamTarget('https://crt.sh/?q=x')?.hostname, 'crt.sh');
  assert.equal(upstreamTarget('http://crt.sh/?q=x'), null);
  assert.equal(upstreamTarget('https://evil.example.com/'), null);
  assert.equal(upstreamTarget('https://crt.sh.evil.example/'), null);
  assert.equal(upstreamTarget('https://api.open-meteo.com/other'), null, 'host is listed but the path is not');
  assert.equal(upstreamTarget('https://api.open-meteo.com/v1/forecast/../../admin'), null, 'dot segments resolve before the path check');
  assert.equal(upstreamTarget('/relative/path'), null);
  assert.equal(upstreamTarget(null), null);
});

test('upstreamTarget refuses ports and credentials', () => {
  assert.equal(upstreamTarget('https://crt.sh:8443/x'), null);
  assert.equal(upstreamTarget('https://user:pw@crt.sh/x'), null);
  assert.equal(upstreamTarget('https://user@crt.sh/x'), null);
  assert.equal(upstreamTarget('https://crt.sh:443/x')?.hostname, 'crt.sh', 'the default port normalizes away');
});

test('secondsUntilNextUtcDay counts down to 00:00 UTC, at least a minute', () => {
  assert.equal(secondsUntilNextUtcDay(Date.UTC(2026, 9, 17, 12, 0, 0)), 12 * 3600);
  assert.equal(secondsUntilNextUtcDay(Date.UTC(2026, 9, 17, 23, 59, 50)), 60);
});

test('classifyBody serves PNG, complete non-empty JSON and plain text only', () => {
  assert.equal(classifyBody(enc('{"a":1}')).type, 'application/json; charset=utf-8');
  assert.equal(classifyBody(enc(' \n[1,2]\n')).type, 'application/json; charset=utf-8');
  assert.equal(classifyBody(new Uint8Array([0xef, 0xbb, 0xbf, ...enc('{"a":1}')])).type, 'application/json; charset=utf-8');
  assert.equal(classifyBody(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])).type, 'image/png');
  assert.equal(classifyBody(enc('a,b\n1,2\n'), 'text/csv; charset=utf-8').type, 'text/plain; charset=utf-8');
  for (const bad of ['', '[]', '{}', '[ \n]', '{"a":[1,2', '<html>{}</html>', '<!doctype html>', 'null']) assert.equal(classifyBody(enc(bad), 'text/html'), null, JSON.stringify(bad));
  assert.equal(classifyBody(enc('hello'), 'text/html'), null, 'HTML-typed text is refused');
  assert.equal(classifyBody(enc('<b>x</b>'), 'application/octet-stream'), null);
});

// ───────── the /api/fetch handler ─────────
const NOON = Date.UTC(2026, 9, 17, 12, 0, 0);
const req = (target, method = 'GET') => new Request(`https://site.test/api/fetch?url=${encodeURIComponent(target)}`, { method });
const upstream = (body, init = {}) => () => Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' }, ...init }));
const spy = (impl) => { const f = (...a) => { f.calls.push(a); return impl(...a); }; f.calls = []; return f; };
const GOOD = 'https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2';

test('handler: only GET and HEAD are served', async () => {
  const f = spy(upstream('{"ok":1}'));
  const post = await handleProxy(req(GOOD, 'POST'), { fetchUpstream: f });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  assert.equal(f.calls.length, 0);
  assert.equal((await handleProxy(req(GOOD, 'HEAD'), { fetchUpstream: f, clock: () => NOON })).status, 200);
});

test('handler: refuses hosts, ports, credentials and a missing url', async () => {
  const f = spy(upstream('{"ok":1}'));
  for (const bad of ['https://evil.example.com/', 'https://crt.sh:8443/', 'https://u:p@crt.sh/', 'http://crt.sh/', '']) {
    assert.equal((await handleProxy(req(bad), { fetchUpstream: f })).status, 403, bad);
  }
  assert.equal((await handleProxy(new Request('https://site.test/api/fetch'), { fetchUpstream: f })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('handler: serves JSON with a safe type and the time left in the UTC day', async () => {
  const f = spy(upstream('{"hourly":{"t":[1]}}', { headers: { 'content-type': 'text/html' } }));
  const res = await handleProxy(req(GOOD), { fetchUpstream: f, clock: () => NOON });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"hourly":{"t":[1]}}');
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8', 'type comes from the bytes, not the upstream');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('content-security-policy'), 'sandbox');
  assert.equal(res.headers.get('cache-control'), `public, max-age=${12 * 3600}`);

  const [href, init] = f.calls[0];
  assert.equal(href, new URL(GOOD).href);
  assert.equal(init.redirect, 'manual');
  assert.ok(init.headers['user-agent'].startsWith('daily-data-games/'));
  assert.equal(init.cf.cacheEverything, true);
  assert.equal(init.cf.cacheTtlByStatus['200-299'], 12 * 3600, 'edge entry lives until UTC midnight');
  assert.equal(init.cf.cacheTtlByStatus['300-599'], 0, 'errors are not kept');

  const late = await handleProxy(req(GOOD), { fetchUpstream: upstream('{"a":1}'), clock: () => Date.UTC(2026, 9, 17, 23, 0, 0) });
  assert.equal(late.headers.get('cache-control'), 'public, max-age=3600', 'max-age shrinks as the day passes');
});

test('handler: HEAD returns the headers without a body; the dev server asks for no-store', async () => {
  const head = await handleProxy(req(GOOD, 'HEAD'), { fetchUpstream: upstream('{"a":1}'), clock: () => NOON });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.match(head.headers.get('cache-control'), /^public, max-age=\d+$/);
  const dev = await handleProxy(req(GOOD), { fetchUpstream: upstream('{"a":1}'), browserCache: false });
  assert.equal(dev.headers.get('cache-control'), 'no-store');
});

test('handler: a failing upstream is a clean 502, not a thrown error', async () => {
  const res = await handleProxy(req(GOOD), { fetchUpstream: () => Promise.reject(new TypeError('dns')) });
  assert.equal(res.status, 502);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('handler: a non-2xx upstream is a 502 and its body is released', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(c) { c.enqueue(enc('<html>busy</html>')); }, cancel() { cancelled = true; } });
  const res = await handleProxy(req(GOOD), { fetchUpstream: () => Promise.resolve(new Response(body, { status: 503 })) });
  assert.equal(res.status, 502);
  assert.equal(await res.text(), 'upstream 503');
  assert.equal(cancelled, true);
});

test('handler: HTML, empty, truncated or oversized 200s are refused, not served', async () => {
  for (const body of ['<html>maintenance</html>', '[]', '{}', '{"a":[1,2', '']) {
    const res = await handleProxy(req(GOOD), { fetchUpstream: upstream(body, { headers: { 'content-type': 'application/json' } }) });
    assert.equal(res.status, 502, JSON.stringify(body));
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
  const big = await handleProxy(req(GOOD), { fetchUpstream: upstream('{"a":1}', { headers: { 'content-length': String(50 * 1024 * 1024) } }) });
  assert.equal(big.status, 502);
});

test('handler: serves radar PNGs as image/png', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const res = await handleProxy(req('https://mesonet.agron.iastate.edu/archive/data/2026/10/16/GIS/uscomp/n0r_202610161800.png'), { fetchUpstream: upstream(png, { headers: { 'content-type': 'image/png' } }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), png);
});

test('handler: follows redirects only to allowed upstreams', async () => {
  const hop = (location) => new Response(null, { status: 302, headers: { location } });
  const ok = spy((href) => Promise.resolve(href.includes('archive-api') ? new Response('{"ok":1}') : hop('https://archive-api.open-meteo.com/v1/archive?x=1')));
  assert.equal((await handleProxy(req(GOOD), { fetchUpstream: ok })).status, 200);
  assert.equal(ok.calls.length, 2);

  const evil = spy(() => Promise.resolve(hop('https://evil.example.com/steal')));
  assert.equal((await handleProxy(req(GOOD), { fetchUpstream: evil })).status, 502);
  assert.equal(evil.calls.length, 1, 'the redirect target is never fetched');

  const loop = spy(() => Promise.resolve(hop(GOOD)));
  assert.equal((await handleProxy(req(GOOD), { fetchUpstream: loop })).status, 502);
  assert.ok(loop.calls.length <= 4);
});

test('handler: the upstream fetch is handed to waitUntil so it outlives the client', async () => {
  const kept = [];
  const res = await handleProxy(req(GOOD), { fetchUpstream: upstream('{"a":1}'), waitUntil: (p) => kept.push(p) });
  assert.equal(res.status, 200);
  assert.equal(kept.length, 1);
  assert.equal((await kept[0]).type, 'application/json; charset=utf-8');
});

// ───────── the browser side ─────────
const HERE = 'https://site.test/play.html?g=x';
const PROXY = 'https://site.test/api/fetch';
const json = (o = { ok: 1 }) => () => Promise.resolve(new Response(JSON.stringify(o)));
const status = (s) => () => Promise.resolve(new Response('x', { status: s }));
const env = (fetchImpl) => ({ fetchImpl, proxy: PROXY, here: HERE });

test('fetchLive: allowed hosts go through /api/fetch with the target encoded once', async () => {
  const f = spy(json());
  await fetchLive(GOOD, {}, env(f));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], `${PROXY}?url=${encodeURIComponent(new URL(GOOD).href)}`);
});

test('fetchLive: same-origin files and hosts the Worker does not serve are fetched directly', async () => {
  const f = spy(json());
  await fetchLive('games/001-daylight/data.json', {}, env(f));
  await fetchLive('https://raw.githubusercontent.com/x/y/main/z.json', {}, env(f));
  assert.deepEqual(f.calls.map((c) => c[0]), ['https://site.test/games/001-daylight/data.json', 'https://raw.githubusercontent.com/x/y/main/z.json']);
});

test('fetchLive: falls back to the upstream when the proxy is missing or failing', async () => {
  for (const proxyStatus of [404, 405, 500, 502]) {
    const f = spy((href) => (href.startsWith(PROXY) ? status(proxyStatus)() : json({ direct: 1 })()));
    const res = await fetchLive(GOOD, {}, env(f));
    assert.deepEqual(await res.json(), { direct: 1 }, `proxy ${proxyStatus}`);
    assert.equal(f.calls[1][0], new URL(GOOD).href);
  }
  const offline = spy((href) => (href.startsWith(PROXY) ? Promise.reject(new TypeError('Failed to fetch')) : json({ direct: 1 })()));
  assert.deepEqual(await (await fetchLive(GOOD, {}, env(offline))).json(), { direct: 1 });
});

test('fetchLive: a 403, a timeout or a failing upstream is not retried blindly', async () => {
  const denied = spy(status(403));
  await assert.rejects(fetchLive(GOOD, {}, env(denied)), /HTTP 403/);
  assert.equal(denied.calls.length, 1);

  const slow = spy((href, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
  await assert.rejects(fetchLive(GOOD, { timeout: 20 }, env(slow)), /aborted/);
  assert.equal(slow.calls.length, 1, 'no second request once the time budget is spent');

  const dead = spy(status(500));
  await assert.rejects(fetchLive(GOOD, {}, env(dead)), /HTTP 500/);
  assert.equal(dead.calls.length, 2);
});

test('fetchLive: init reaches direct requests only, and reload bypasses the HTTP cache', async () => {
  const f = spy(json());
  await fetchLive(GOOD, { init: { headers: { accept: 'text/csv' } }, reload: true }, env(f));
  assert.equal(f.calls[0][1].headers, undefined, 'the proxy takes the URL alone');
  assert.equal(f.calls[0][1].cache, 'reload');
  const direct = spy(json());
  await fetchLive('https://raw.githubusercontent.com/x', { init: { headers: { accept: 'text/csv' } } }, env(direct));
  assert.deepEqual(direct.calls[0][1].headers, { accept: 'text/csv' });
});

test('browser → handler round trip: the upstream URL survives encoding, query strings included', async () => {
  const url = 'https://crt.sh/?q=%25.stripe.com&output=json&exclude=expired';
  const upstreamFetch = spy(upstream('[{"name_value":"a.stripe.com"}]'));
  const wire = (href, init) => (href.startsWith(PROXY)
    ? handleProxy(new Request(href, { method: 'GET' }), { fetchUpstream: upstreamFetch, clock: () => NOON })
    : Promise.reject(new Error(`unexpected direct request ${href}`)));
  const res = await fetchLive(url, {}, env(wire));
  assert.deepEqual(await res.json(), [{ name_value: 'a.stripe.com' }]);
  assert.equal(upstreamFetch.calls[0][0], url, 'exactly the URL the game asked for reaches the upstream');
});

// ───────── every live game stays inside the allowlist ─────────
test('every live game only fetches URLs the Worker allows', async () => {
  const seen = [];
  for (const e of readdirSync(path.join(ROOT, 'games'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const game = (await import(path.join(ROOT, 'games', e.name, 'game.js'))).default;
    if (typeof game?.load !== 'function') continue;
    let snapshot = null;
    try { snapshot = JSON.parse(readFileSync(path.join(ROOT, 'games', e.name, 'data.json'), 'utf8')); } catch { /* computed */ }
    for (let offset = 0; offset < 3; offset++) { // #96 only fetches on every third day
      const day = core.dayNumber('2026-10-17') + offset;
      const rec = (kind) => async (url) => { seen.push({ game: e.name, kind, url }); throw new Error('stubbed'); };
      const log = Object.assign(() => {}, { warn() {}, error() {}, scope: () => log });
      const ctx = {
        dir: e.name, slug: e.name.replace(/^\d+-/, ''), date: core.isoFromDay(day), day, today: core.isoFromDay(day), data: snapshot, core, log,
        rng: core.makeRng(e.name), pick: (arr) => arr[0], sleep: async () => {},
        fetchJSON: rec('json'), fetchText: rec('text'), fetchBuffer: rec('buffer'),
      };
      await Promise.resolve(game.load(ctx)).catch(() => {});
    }
  }
  assert.ok(new Set(seen.map((s) => s.game)).size >= 12, `expected the 13 live games to fetch, saw ${[...new Set(seen.map((s) => s.game))]}`);
  assert.deepEqual(seen.filter((s) => !upstreamTarget(s.url)).map((s) => `${s.game}: ${s.url}`), [], 'add the host and path to ALLOWED in engine/upstream.js');
  for (const host of Object.keys(ALLOWED)) assert.ok(seen.some((s) => new URL(s.url).hostname === host), `${host} is allowed but no live game uses it`);
});
