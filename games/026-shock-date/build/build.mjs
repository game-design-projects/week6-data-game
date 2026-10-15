// raw market series -> ../data.json : one puzzle per historical shock (4 series x 50 trading days, shock day at a random position).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS } from './events.mjs';
const here = dirname(fileURLToPath(import.meta.url));
export const N = 50;
const SER = {
  SPX: { name: '标普 500', kind: 'pct', yahoo: '^GSPC' },
  IXIC: { name: '纳斯达克综合指数', kind: 'pct', yahoo: '^IXIC' },
  VIXCLS: { name: 'VIX 恐慌指数', kind: 'pct', fred: 'VIXCLS' },
  DGS10: { name: '10 年期美债收益率', kind: 'diff', fred: 'DGS10' },
  DGS2: { name: '2 年期美债收益率', kind: 'diff', fred: 'DGS2' },
  DGS3MO: { name: '3 个月美债收益率', kind: 'diff', fred: 'DGS3MO' },
  DCOILWTICO: { name: 'WTI 原油', kind: 'pct', fred: 'DCOILWTICO' },
  GOLD: { name: '黄金期货', kind: 'pct', yahoo: 'GC=F' },
  DEXUSEU: { name: '欧元/美元', kind: 'pct', fred: 'DEXUSEU' },
  DEXJPUS: { name: '美元/日元', kind: 'pct', fred: 'DEXJPUS' },
  DEXUSUK: { name: '英镑/美元', kind: 'pct', fred: 'DEXUSUK' },
  DEXSZUS: { name: '美元/瑞郎', kind: 'pct', fred: 'DEXSZUS' },
  DEXCHUS: { name: '美元/人民币', kind: 'pct', fred: 'DEXCHUS' },
};
const KEYS = Object.keys(SER);
const SD_FLOOR = { pct: 0.0015, diff: 0.02 }; // avoid divide-by-almost-zero in flat regimes (pegs, zero-rate yields)

const loadFred = (id) => {
  const m = new Map();
  for (const line of readFileSync(join(here, 'raw', `${id}.csv`), 'utf8').split('\n').slice(1)) {
    const [d, v] = line.trim().split(',');
    if (d && v && v !== '.' && !isNaN(+v)) m.set(d, +v);
  }
  return m;
};
const loadYahoo = (k) => {
  const r = JSON.parse(readFileSync(join(here, 'raw', `${k}.json`), 'utf8')).chart.result[0];
  const m = new Map();
  r.timestamp.forEach((t, i) => { const c = r.indicators.quote[0].close[i]; if (c != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), c); });
  return m;
};
const raw = Object.fromEntries(KEYS.map((k) => [k, SER[k].fred ? loadFred(k) : loadYahoo(k)]));
const cal = [...raw.VIXCLS.keys()].filter((d) => d <= '2026-09-30').sort(); // trading calendar = days VIX published
const aligned = {};
for (const k of KEYS) {
  let last = null;
  aligned[k] = cal.map((d) => { if (raw[k].has(d)) last = raw[k].get(d); return { v: last, real: raw[k].has(d) }; });
}
const change = (k, i) => {
  const a = aligned[k][i], b = aligned[k][i - 1];
  if (!a?.real || !b?.v || b.v <= 0 || a.v <= 0) return null;
  return SER[k].kind === 'pct' ? (a.v - b.v) / b.v : a.v - b.v;
};
const zScore = (k, i) => {
  const c = change(k, i); if (c == null || i < 61) return -1;
  const prev = []; for (let j = i - 60; j < i; j++) { const x = change(k, j); if (x != null) prev.push(x); }
  if (prev.length < 40) return -1;
  const sd = Math.max(Math.sqrt(prev.reduce((s, x) => s + x * x, 0) / prev.length), SD_FLOOR[SER[k].kind]);
  return Math.abs(c) / sd;
};
const fmtMove = (k, c) => SER[k].kind === 'pct'
  ? `${c >= 0 ? '+' : ''}${(c * 100).toFixed(1)}%`
  : `${c >= 0 ? '+' : ''}${(c * 100).toFixed(0)} bp`;
// deterministic hash -> [0,1)
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };

const puzzles = [], events = [];
for (const [date, label, why] of EVENTS) {
  const i = cal.findIndex((d) => d >= date);
  if (i < 0 || cal[i] !== date) { console.log('skip (not a trading day in calendar)', date, cal[i]); continue; }
  const avail = KEYS.filter((k) => aligned[k][i]?.real && aligned[k][i - 1]?.real && aligned[k][i - N]?.v);
  const z = avail.map((k) => ({ k, z: zScore(k, i), c: change(k, i) })).filter((x) => x.z > 0).sort((a, b) => b.z - a.z);
  // need at least two series that jump together, otherwise the "common shock" cue the player is taught is not there
  if (z.length < 4 || z[0].z < 3 || z[1].z < 2) { console.log('skip weak', date, z.slice(0, 3).map((x) => x.k + x.z.toFixed(1)).join(' ')); continue; }
  const top = z.slice(0, 4);
  const keys = top.map((t) => t.k);
  const comp = (d) => keys.reduce((s, k) => s + Math.min(Math.max(zScore(k, d), 0), 8), 0);
  const ownComp = comp(i);
  // pick a seeded window position where the shock day is clearly the biggest joint move in the window
  let off = -1;
  for (let t = 0; t < 60 && off < 0; t++) {
    const cand = 5 + Math.floor(hash(date + t) * (N - 10)); // 0-based index of the shock day in the window: 5..44
    const start = i - cand;
    if (start < 61 || start + N > cal.length) continue;
    // a percent-rebased line must stay positive (WTI went negative in April 2020)
    if (keys.some((k) => SER[k].kind === 'pct' && aligned[k].slice(start, start + N).some((x) => !(x.v > 0)))) continue;
    let other = 0;
    for (let d = start; d < start + N; d++) if (d !== i) other = Math.max(other, comp(d));
    if (ownComp >= other * 1.1) off = cand;
  }
  if (off < 0) { console.log('skip ambiguous (another bigger shock in every window)', date); continue; }
  const start = i - off;
  const order = KEYS.filter((k) => keys.includes(k)); // fixed panel order so the strongest series is not always first
  const series = order.map((k) => {
    const base = aligned[k][start].v;
    const t = top.find((x) => x.k === k);
    return { id: k, name: SER[k].name, kind: SER[k].kind, base: +base.toPrecision(7), v: aligned[k].slice(start, start + N).map((p) => +p.v.toPrecision(6)), move: fmtMove(k, t.c), z: +t.z.toFixed(1) };
  });
  events.push({ date, label, why });
  puzzles.push({ ev: events.length - 1, ans: off + 1, n: N, from: cal[start], to: cal[start + N - 1], series });
  console.log('ok  ', date, 'ans', off + 1, series.map((s) => `${s.id}:${s.z}`).join(' '));
}
const out = {
  asOf: cal[cal.length - 1],
  sources: Object.fromEntries(KEYS.map((k) => [k, SER[k].fred ? `https://fred.stlouisfed.org/series/${SER[k].fred}` : `https://finance.yahoo.com/quote/${encodeURIComponent(SER[k].yahoo)}`])),
  events, puzzles,
};
writeFileSync(join(here, '..', 'data.json'), JSON.stringify(out));
console.log('events', events.length, 'puzzles', puzzles.length, 'bytes', JSON.stringify(out).length);
