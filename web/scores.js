// Talks to the score server (worker/). Every call fails soft and resolves to null: offline,
// blocked or not deployed yet, the game still plays, it just doesn't show other players.
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API = LOCAL ? 'http://127.0.0.1:8787' : 'https://restoration.lishuyustevenli.workers.dev';

async function call(path, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(API + path, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
      : { signal: ctl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Send a finished round; the server scores it from the colors. Resolves to the day's results. */
export const submit = (device, name, day, tests) => call('/api/results', { device, name, day, tests });
export const dayResults = (device, day) => call(`/api/day/${day}?device=${encodeURIComponent(device)}`);
export const leaderboard = device => call(`/api/leaderboard?device=${encodeURIComponent(device)}`);
export const rename = (device, name) => call('/api/name', { device, name });
