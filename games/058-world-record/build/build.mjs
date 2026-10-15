// raw/all.json -> data.json : per game, WR progression [[YYYY-MM-DD, seconds], ...]
import fs from 'node:fs';

const STOP = new Set(['the', 'of', 'and', 'for', 'game', 'games', 'edition', 'version', 'super']);
const PORTS = /virtual console|classic mini|mister|analogue|retrousb|switch 2|stadia|steam deck|xbox series|playstation 5|xbox one [xs]|iique|game boy (player|interface)|google|psn download|ms-dos|windows phone|wonderswan|msx2|android|ios$/i;

/** words (>=3 letters, lowercase, ascii-folded) of the game name that must not appear in the category label */
export const nameTokens = (name) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function leaks(name, text) {
  const t = fold(text);
  return nameTokens(name).some((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t));
}

/** Running minimum by date -> [[date, seconds]] */
export function progression(runs) {
  const rs = runs.map((r) => ({ date: r.date, t: +r.t.toFixed(2) })).filter((r) => r.date && r.t > 0).sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
  const pts = [];
  let best = Infinity;
  for (const r of rs) {
    if (r.t >= best) continue;
    best = r.t;
    if (pts.length && pts[pts.length - 1][0] === r.date) pts[pts.length - 1][1] = +r.t.toFixed(2);
    else pts.push([r.date, +r.t.toFixed(2)]);
  }
  return pts;
}

const clean = (name) => name.replace(/\s*\(.*?\)\s*$/, '');

if (process.argv[1] && process.argv[1].endsWith('build.mjs')) {
  const all = JSON.parse(fs.readFileSync(new URL('./raw/all.json', import.meta.url)));
  const games = [];
  const dropped = [];
  for (const g of all) {
    const name = clean(g.name);
    const pts = progression(g.runs);
    const years = pts.length ? (Date.parse(pts.at(-1)[0]) - Date.parse(pts[0][0])) / 31557600000 : 0;
    const why = !g.released ? 'no release year' : pts.length < 10 ? `only ${pts.length} records` : years < 1.5 ? 'span < 1.5y' : null;
    if (why) { dropped.push(`${name}: ${why}`); continue; }
    // bogus outlier guard: a record that undercuts the previous by > 90% is almost surely a data error
    if (pts.some((p, i) => i && p[1] < pts[i - 1][1] * 0.1)) { dropped.push(`${name}: implausible >90% drop`); continue; }
    const [catName, ...subs] = g.cat.split(' · ');
    if (leaks(name, catName)) { dropped.push(`${name}: category name leaks (${catName})`); continue; }
    const subLabel = subs.join(' · ').split(', ').filter((p) => !leaks(name, p)).join(', ');
    const cat = subLabel ? `${catName} · ${subLabel}` : catName;
    const platforms = g.platforms.filter((p) => !PORTS.test(p));
    if (!platforms.length) platforms.push(...g.platforms.slice(0, 1));
    games.push({ id: g.ab || g.id, name, year: +g.released, cat, platforms: platforms.slice(0, 3), wr: pts.at(-1)[1], pts });
  }
  games.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ games }));
  console.log(games.length, 'games kept;', dropped.length, 'dropped');
  console.log(dropped.join('\n'));
}
