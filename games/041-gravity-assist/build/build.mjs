// raw Horizons vectors -> data.json (pool of routing puzzles with precomputed best delta-v per route)
import fs from 'node:fs';
import { lambert, departDv, flybyDv, sub, norm } from './astro.mjs';

const STEP = 20; // days per grid index
const T0 = Date.UTC(2027, 0, 1);
const NAMES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus'];

export function parseRaw(name) {
  const txt = JSON.parse(fs.readFileSync(new URL(`./raw/${name}.json`, import.meta.url))).result;
  const body = txt.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
  return body.map((l) => { const c = l.split(',').map(Number); return { r: [c[2], c[3], c[4]], v: [c[5], c[6], c[7]] }; });
}
const E = Object.fromEntries(NAMES.map((n) => [n, parseRaw(n)]));
const AU = 1.495978707e8;
const rad = (n) => norm(E[n][0].r) / AU;
const dateOf = (i) => new Date(T0 + i * STEP * 86400000).toISOString().slice(0, 10);

const memo = new Map();
function leg(a, b, ia, ib) {
  const k = `${a}${b}${ia}_${ib}`;
  if (!memo.has(k)) memo.set(k, lambert(E[a][ia].r, E[b][ib].r, (ib - ia) * STEP * 86400));
  return memo.get(k);
}
/** tof index candidates for a leg, based on Hohmann time */
function tofs(a, b) {
  const at = (rad(a) + rad(b)) / 2;
  const hoh = (Math.PI * Math.sqrt(Math.pow(at * AU, 3) / 1.32712440018e11)) / 86400 / STEP;
  const lo = Math.max(2, Math.floor(hoh * 0.45)), hi = Math.ceil(hoh * 1.9);
  const stride = Math.max(1, Math.round((hi - lo) / 28));
  const out = []; for (let k = lo; k <= hi; k += stride) out.push(k);
  return out;
}

/** best total dv for path [earth, ..., target] with departure index in [w0, w0+W) */
export function bestRoute(path, w0, W) {
  let best = null;
  const n = path.length;
  const rec = (leg_i, idx, acc, prevVin) => {};
  const ks = path.slice(0, -1).map((p, i) => tofs(p, path[i + 1]));
  for (let i0 = w0; i0 < w0 + W; i0++) {
    // enumerate depth-first over legs
    const go = (li, idxs, legs) => {
      if (li === n - 1) {
        let dv = 0;
        const L = legs;
        const dep = norm(sub(L[0].v1, E[path[0]][idxs[0]].v));
        dv += departDv(dep);
        const parts = { dep: dv, flybys: [] };
        for (let j = 1; j < n - 1; j++) {
          const vp = E[path[j]][idxs[j]].v;
          const c = flybyDv(sub(L[j - 1].v2, vp), sub(L[j].v1, vp), path[j]);
          parts.flybys.push(c); dv += c;
        }
        const arr = norm(sub(L[n - 2].v2, E[path[n - 1]][idxs[n - 1]].v));
        parts.arr = arr; dv += arr;
        if (!best || dv < best.dv) best = { dv, idxs: [...idxs], dep, ...parts };
        return;
      }
      for (const k of ks[li]) {
        const ni = idxs[li] + k;
        if (ni >= E.earth.length) break;
        const l = leg(path[li], path[li + 1], idxs[li], ni);
        if (!l) continue;
        go(li + 1, [...idxs, ni], [...legs, l]);
      }
    };
    go(0, [i0], []);
  }
  return best;
}

const TARGETS = ['mars', 'mercury', 'jupiter', 'saturn', 'venus'];
const FLY = { mars: ['venus', 'jupiter', 'earth'], venus: ['mars', 'jupiter'], mercury: ['venus', 'mars', 'jupiter'], jupiter: ['venus', 'mars', 'saturn'], saturn: ['venus', 'mars', 'jupiter'] };
const W = 24;
const ZH = { mercury: '水星', venus: '金星', earth: '地球', mars: '火星', jupiter: '木星', saturn: '土星' };

if (process.argv[1].endsWith('build.mjs')) {
  const puzzles = [];
  for (let k = 0; puzzles.length < 80 && k < 400; k++) {
    const target = TARGETS[k % TARGETS.length];
    if (target === 'venus') continue; // keep it to gravity-assist-friendly goals
    const w0 = 4 + Math.floor(k * 2.3) % 150;
    // routes: direct + 3 single-flyby candidates (earth flyby needs a resonant orbit: excluded)
    const cands = FLY[target].filter((f) => f !== 'earth').slice(0, 3);
    const routes = [{ via: null, ...bestRoute(['earth', target], w0, W) }];
    for (const f of cands) { const r = bestRoute(['earth', f, target], w0, W); if (r) routes.push({ via: f, ...r }); }
    if (routes.some((r) => !r.dv) || routes.length < 3) continue;
    routes.sort((a, b) => a.dv - b.dv);
    if (routes.some((r, i) => i && r.dv / routes[i - 1].dv < 1.04)) { console.log('skip close', k, target); continue; }
    const pos = (i) => Object.fromEntries(NAMES.slice(0, 6).map((n) => [n, E[n][i].r.slice(0, 2).map((x) => +(x / AU).toFixed(3))]));
    const trail = []; for (let i = w0; i < w0 + W + 6; i += 4) trail.push(pos(i));
    puzzles.push({
      id: puzzles.length, target, start: dateOf(w0), end: dateOf(w0 + W - 1), trail,
      routes: routes.map((r) => ({
        via: r.via, dv: +r.dv.toFixed(2), vinf: +r.dep.toFixed(2),
        flyby: r.flybys.map((x) => +x.toFixed(2)), arr: +r.arr.toFixed(2),
        launch: dateOf(r.idxs[0]), flybyDate: r.via ? dateOf(r.idxs[1]) : null, arrive: dateOf(r.idxs[r.idxs.length - 1]),
        years: +(((r.idxs[r.idxs.length - 1] - r.idxs[0]) * STEP) / 365.25).toFixed(1),
      })),
    });
    console.log(puzzles.length, target, w0, routes.map((r) => `${r.via ?? 'direct'}:${r.dv.toFixed(2)}`).join(' '));
  }
  const radii = Object.fromEntries(NAMES.slice(0, 6).map((n) => [n, +rad(n).toFixed(3)]));
  fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ zh: ZH, radii, puzzles }));
  console.log('puzzles', puzzles.length);
}
