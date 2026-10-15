// raw state pages -> data.json: per-state answer shares for curated lexical questions + a pool of puzzles.
import fs from 'node:fs';
import { parse } from './parse.mjs';

const S = parse('raw');
const codes = Object.keys(S).sort();
const STATES = {
  AL: [32.8, -86.8, 'S'], AR: [34.9, -92.4, 'S'], AZ: [34.3, -111.7, 'W'], CA: [37.2, -119.5, 'W'],
  CO: [39.0, -105.5, 'W'], CT: [41.6, -72.7, 'NE'], DE: [39.0, -75.5, 'S'], FL: [28.6, -82.4, 'S'],
  GA: [32.7, -83.4, 'S'], IA: [42.1, -93.5, 'MW'], ID: [44.4, -114.6, 'W'], IL: [40.0, -89.2, 'MW'],
  IN: [39.9, -86.3, 'MW'], KS: [38.5, -98.4, 'MW'], KY: [37.5, -85.3, 'S'], LA: [31.1, -92.0, 'S'],
  MA: [42.3, -71.8, 'NE'], MD: [39.0, -76.8, 'S'], ME: [45.4, -69.2, 'NE'], MI: [44.3, -85.4, 'MW'],
  MN: [46.3, -94.3, 'MW'], MO: [38.4, -92.5, 'MW'], MS: [32.7, -89.7, 'S'], MT: [47.0, -109.6, 'W'],
  NC: [35.5, -79.4, 'S'], ND: [47.5, -100.5, 'MW'], NE: [41.5, -99.8, 'MW'], NH: [43.7, -71.6, 'NE'],
  NJ: [40.2, -74.7, 'NE'], NM: [34.4, -106.1, 'W'], NV: [39.3, -116.6, 'W'], NY: [42.9, -75.5, 'NE'],
  OH: [40.3, -82.8, 'MW'], OK: [35.6, -97.5, 'S'], OR: [43.9, -120.6, 'W'], PA: [40.9, -77.8, 'NE'],
  RI: [41.7, -71.5, 'NE'], SC: [33.9, -80.9, 'S'], SD: [44.4, -100.2, 'MW'], TN: [35.9, -86.3, 'S'],
  TX: [31.5, -99.3, 'S'], UT: [39.3, -111.7, 'W'], VA: [37.5, -78.8, 'S'], VT: [44.1, -72.7, 'NE'],
  WA: [47.4, -120.5, 'W'], WI: [44.6, -89.9, 'MW'], WV: [38.6, -80.6, 'S'], WY: [43.0, -107.6, 'W'],
};
const EN = Object.fromEntries('AL Alabama,AR Arkansas,AZ Arizona,CA California,CO Colorado,CT Connecticut,DE Delaware,FL Florida,GA Georgia,IA Iowa,ID Idaho,IL Illinois,IN Indiana,KS Kansas,KY Kentucky,LA Louisiana,MA Massachusetts,MD Maryland,ME Maine,MI Michigan,MN Minnesota,MO Missouri,MS Mississippi,MT Montana,NC North Carolina,ND North Dakota,NE Nebraska,NH New Hampshire,NJ New Jersey,NM New Mexico,NV Nevada,NY New York,OH Ohio,OK Oklahoma,OR Oregon,PA Pennsylvania,RI Rhode Island,SC South Carolina,SD South Dakota,TN Tennessee,TX Texas,UT Utah,VA Virginia,VT Vermont,WA Washington,WI Wisconsin,WV West Virginia,WY Wyoming'.split(',').map((x) => [x.slice(0, 2), x.slice(3)]));
// curated lexical questions with a short English prompt (id = Harvard question number)
const Q = {
  50: 'Addressing a group ("you all")', 58: 'Selling old stuff from your porch or yard', 64: 'Long sandwich with cold cuts', 65: 'Glowing summer-night insect', 66: 'Mini lobster in the creek',
  67: 'Long-legged spider-like bug', 73: 'Rubber-soled gym shoes', 74: 'Gray bug that rolls into a ball', 75: 'Supermarket cart', 76: 'Across both streets at an intersection',
  81: 'Cold-induced skin bumps', 84: 'Circular junction where roads meet', 97: 'Trash container', 98: '"By accident"', 99: 'Small road beside the highway', 100: 'Verb for trimming the lawn', 103: 'School drinking-water fixture',
  104: 'Underground public railway', 105: 'Sweet fizzy drink (generic term)', 106: 'Wrapping a house in toilet paper', 109: 'Paper bag for groceries', 110: 'Night before Halloween', 111: 'End of a loaf of bread', 117: 'Underground level of a building',
  119: 'Restaurant food you eat at home', 120: 'Calling dibs on the front seat', 62: 'Middle strip of a divided highway', 61: 'Grass strip in the middle of a street', 49: 'Past tense of "drag" ("I ___ the heavy box upstairs")', 85: 'What women tie their hair with',
  72: 'Dust balls under furniture', 80: 'Rain while the sun shines', 93: 'Waiting in a queue (in line / on line)', 101: 'Submitting homework', 41: 'Faucet (spigot / spicket)', 26: 'How you say "route"', 89: 'Calling coleslaw "slaw"',
  86: 'Do you use the word "cruller"?', 28: 'Are "cot" and "caught" the same?', 51: '"Are you coming with?" as a full sentence', 60: 'Grass strip between sidewalk and road', 29: 'How you say "almond"',
};
const BAD = /other|no word|have no|never heard|don't|neither|both|interchangeabl|equally|different|distinction|have no idea|either|not sure|sure|know what|spell/i;
const clean = (t) => t.replace(/\s*\(.*?\)\s*$/, '').replace(/\s+/g, ' ').trim();

// nat[q][k] = unweighted mean across states
const qs = {};
for (const id of Object.keys(Q)) {
  const base = S.CA[id];
  const opts = base.opts.map((o) => ({ k: o.k, t: clean(o.t), raw: o.t, p: Object.fromEntries(codes.map((c) => [c, S[c][id]?.opts.find((x) => x.k === o.k)?.p ?? 0])) }));
  for (const o of opts) o.nat = codes.reduce((a, c) => a + o.p[c], 0) / codes.length;
  qs[id] = { id: +id, label: Q[id], en: base.q, opts };
}
const eligible = (o) => !BAD.test(o.raw) && o.t.length <= 28;

function score(q, o, c) { const p = o.p[c]; if (p < 0.12) return 0; const lift = p / Math.max(o.nat, 0.01); if (lift < 1.7) return 0; return Math.log(lift) * Math.min(1, p / 0.35); }

const used = new Set();
const post = (c, picks) => { // naive Bayes posterior of state c among all states
  const L = (st) => picks.reduce((a, [qid, k]) => a + Math.log((qs[qid].opts.find((o) => o.k === k).p[st] || 0) + 0.01), 0);
  const all = codes.map(L); const mx = Math.max(...all); const z = all.reduce((a, v) => a + Math.exp(v - mx), 0);
  return { p: Math.exp(L(c) - mx) / z, rank: 1 + all.filter((v) => v > L(c)).length };
};
const puzzles = [];
const combos = (arr, k, start = 0, cur = [], out = []) => { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); } return out; };
const MAX_SETS = 4;
for (const c of codes) {
  const cand = [];
  for (const id of Object.keys(qs)) {
    let best = null;
    for (const o of qs[id].opts) { if (!eligible(o)) continue; const s = score(qs[id], o, c); if (s > 0 && (!best || s > best.s)) best = { qid: +id, k: o.k, s, p: o.p[c] }; }
    if (best) cand.push(best);
  }
  cand.sort((a, b) => b.s - a.s);
  const top = cand.slice(0, 10);
  if (top.length < 5) continue;
  // every 5-subset of the 10 best clues whose true state ranks in the top 4 of 48; greedy pick with low overlap
  const opts = combos(top, 5).map((pick) => ({ pick, pr: post(c, pick.map((x) => [x.qid, x.k])), sum: pick.reduce((a, x) => a + x.s, 0) }))
    .filter((x) => x.pr.rank <= 4 && x.pr.p >= 0.08)
    .sort((a, b) => b.sum - a.sum);
  const chosen = [];
  for (const o of opts) {
    if (chosen.length >= MAX_SETS) break;
    if (chosen.every((q) => q.pick.filter((x) => o.pick.includes(x)).length <= 3)) chosen.push(o);
  }
  chosen.forEach((o, set) => {
    o.pick.forEach((x) => used.add(x.qid));
    puzzles.push({ st: c, set, clues: o.pick.map((x) => [x.qid, x.k]), rank: o.pr.rank, post: +o.pr.p.toFixed(3) });
  });
}
const questions = {};
for (const id of used) {
  const q = qs[id];
  questions[id] = { label: q.label, en: q.en.slice(0, 120), opts: Object.fromEntries(q.opts.filter((o) => puzzles.some((p) => p.clues.some(([a, k]) => a === +id && k === o.k)) || true).map((o) => [o.k, { t: o.t, nat: +o.nat.toFixed(3), p: Object.fromEntries(codes.map((c) => [c, Math.round(o.p[c] * 1000) / 10])) }])) };
}
const states = Object.fromEntries(codes.map((c) => [c, { en: EN[c], lat: STATES[c][0], lng: STATES[c][1], reg: STATES[c][2] }]));
const out = { n: 123456 && 0, states, questions, puzzles };
delete out.n;
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log('puzzles', puzzles.length, 'questions', Object.keys(questions).length, 'size', fs.statSync('../data.json').size);
console.log('rank dist', [1, 2, 3, 4, 5, 6].map((r) => puzzles.filter((p) => p.rank === r).length).join(','));
