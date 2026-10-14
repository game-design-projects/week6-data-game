// engine/store.js — per-browser persistence (results, stats, prefs).
// Every access is wrapped: storage can be unavailable (private mode, sandbox).
import { addDays, todayISO } from './core.js';

const NS = 'ddg:v1';
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const get = (k) => safe(() => JSON.parse(localStorage.getItem(k) ?? 'null'), null);
const set = (k, v) => safe(() => localStorage.setItem(k, JSON.stringify(v)), undefined);

const rkey = (slug, date) => `${NS}:r:${slug}:${date}`;

export function getResult(slug, date) {
  return get(rkey(slug, date));
}

export function saveResult(slug, date, r) {
  const { score, max, win, emoji, summary } = r;
  set(rkey(slug, date), { score, max, win, emoji, summary, at: new Date().toISOString() });
}

/** All saved results for a game: [{date, score, max, …}] newest first. */
export function history(slug) {
  const prefix = `${NS}:r:${slug}:`;
  const out = [];
  safe(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push({ date: k.slice(prefix.length), ...get(k) });
    }
  });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function stats(slug, today = todayISO()) {
  const hist = history(slug);
  const byDate = new Map(hist.map((r) => [r.date, r]));
  let streak = 0;
  for (let d = byDate.has(today) ? today : addDays(today, -1); byDate.has(d); d = addDays(d, -1)) streak++;
  const pct = hist.map((r) => (r.max ? r.score / r.max : 0));
  return {
    played: hist.length,
    avg: pct.length ? pct.reduce((a, b) => a + b, 0) / pct.length : 0,
    best: pct.length ? Math.max(...pct) : 0,
    streak,
    today: byDate.get(today) ?? null,
    hist,
  };
}

export const seenHelp = (slug) => !!get(`${NS}:help:${slug}`);
export const markHelp = (slug) => set(`${NS}:help:${slug}`, 1);

export const getTheme = () => get(`${NS}:theme`) ?? 'auto';
export function setTheme(t) {
  set(`${NS}:theme`, t);
  applyTheme(t);
}
export function applyTheme(t = getTheme()) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
