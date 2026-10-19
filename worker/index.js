// Restoration's score server, a Cloudflare Worker with one D1 table (worker/schema.sql).
//
//   POST /api/results      { day, device, name, tests: ['#RRGGBB', ...] }  -> the day's results, with yours
//   POST /api/name         { device, name }                                 -> renames you on every day
//   GET  /api/day/:n       ?device=…                                        -> everyone's results for a day
//   GET  /api/leaderboard  ?device=…                                        -> all-time totals
//
// Scores are recomputed here from the tested colors (worker/scores.js). Device ids never leave
// the server; rows come back with `me: true` for the asking device instead.
import { scoreRound, cleanName, cleanDevice } from './scores.js';

const CORS = {
  'Access-Control-Allow-Origin': '*', // the game runs in itch.io's iframe on its own domain
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
});

const TOP = 10;
const PICKS = 300;

async function day(db, n, device) {
  const [count, top, picks, buckets, mine] = await db.batch([
    db.prepare('SELECT COUNT(*) AS total FROM results WHERE day = ?1').bind(n),
    db.prepare('SELECT name, pts, acc, tests, hex, device = ?2 AS me FROM results WHERE day = ?1 ORDER BY pts DESC, at ASC LIMIT ?3').bind(n, device ?? '', TOP),
    db.prepare('SELECT hex, acc FROM results WHERE day = ?1 ORDER BY acc DESC LIMIT ?2').bind(n, PICKS),
    db.prepare('SELECT MIN(9, pts / 10) AS bucket, COUNT(*) AS n FROM results WHERE day = ?1 GROUP BY bucket').bind(n),
    db.prepare(`SELECT pts, (SELECT COUNT(*) FROM results r WHERE r.day = ?1 AND r.pts > results.pts) + 1 AS rank,
                       (SELECT COUNT(*) FROM results r WHERE r.day = ?1 AND r.pts < results.pts) AS beat
                FROM results WHERE day = ?1 AND device = ?2`).bind(n, device ?? ''),
  ]);
  const histogram = Array(10).fill(0);
  for (const b of buckets.results) histogram[b.bucket] = b.n;
  return {
    day: n,
    total: count.results[0].total,
    top: top.results.map(r => ({ ...r, me: !!r.me })),
    picks: picks.results,
    histogram,
    mine: mine.results[0] ?? null,
  };
}

async function leaderboard(db, device) {
  const [top, mine] = await db.batch([
    db.prepare(`SELECT MAX(name) AS name, SUM(pts) AS total, COUNT(*) AS days, ROUND(AVG(pts)) AS avg, device = ?1 AS me
                FROM results GROUP BY device ORDER BY total DESC, days ASC LIMIT ?2`).bind(device ?? '', TOP * 2),
    db.prepare(`WITH t AS (SELECT device, SUM(pts) AS total, COUNT(*) AS days FROM results GROUP BY device)
                SELECT total, days, (SELECT COUNT(*) FROM t AS o WHERE o.total > t.total) + 1 AS rank,
                       (SELECT COUNT(*) FROM t) AS players
                FROM t WHERE device = ?1`).bind(device ?? ''),
  ]);
  return { top: top.results.map(r => ({ ...r, me: !!r.me })), mine: mine.results[0] ?? null };
}

async function readJson(request) {
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return null;
  try { return await request.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const device = cleanDevice(url.searchParams.get('device'));
    try {
      if (request.method === 'POST' && url.pathname === '/api/results') {
        const { row, error } = scoreRound(await readJson(request));
        if (error) return json({ error }, 400);
        // First finished round counts; sending it again only refreshes the name.
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO results (day, device, name, pts, acc, tests, hex) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                          ON CONFLICT (day, device) DO NOTHING`).bind(row.day, row.device, row.name, row.pts, row.acc, row.tests, row.hex),
          env.DB.prepare('UPDATE results SET name = ?2 WHERE device = ?1').bind(row.device, row.name),
        ]);
        return json(await day(env.DB, row.day, row.device));
      }
      if (request.method === 'POST' && url.pathname === '/api/name') {
        const body = await readJson(request);
        const who = cleanDevice(body?.device);
        if (!who) return json({ error: 'bad device id' }, 400);
        const name = cleanName(body.name);
        await env.DB.prepare('UPDATE results SET name = ?2 WHERE device = ?1').bind(who, name).run();
        return json({ name });
      }
      const m = url.pathname.match(/^\/api\/day\/(\d{1,5})$/);
      if (request.method === 'GET' && m) return json(await day(env.DB, Number(m[1]), device));
      if (request.method === 'GET' && url.pathname === '/api/leaderboard') return json(await leaderboard(env.DB, device));
      if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'server error' }, 500);
    }
  },
};
