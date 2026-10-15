// raw state pages -> data.json: per-state answer shares for curated lexical questions + a pool of puzzles.
import fs from 'node:fs';
import { parse } from './parse.mjs';

const S = parse('raw');
const codes = Object.keys(S).sort();
const STATES = {
  AL: ['阿拉巴马', 32.8, -86.8, 'S'], AR: ['阿肯色', 34.9, -92.4, 'S'], AZ: ['亚利桑那', 34.3, -111.7, 'W'], CA: ['加利福尼亚', 37.2, -119.5, 'W'],
  CO: ['科罗拉多', 39.0, -105.5, 'W'], CT: ['康涅狄格', 41.6, -72.7, 'NE'], DE: ['特拉华', 39.0, -75.5, 'S'], FL: ['佛罗里达', 28.6, -82.4, 'S'],
  GA: ['佐治亚', 32.7, -83.4, 'S'], IA: ['爱荷华', 42.1, -93.5, 'MW'], ID: ['爱达荷', 44.4, -114.6, 'W'], IL: ['伊利诺伊', 40.0, -89.2, 'MW'],
  IN: ['印第安纳', 39.9, -86.3, 'MW'], KS: ['堪萨斯', 38.5, -98.4, 'MW'], KY: ['肯塔基', 37.5, -85.3, 'S'], LA: ['路易斯安那', 31.1, -92.0, 'S'],
  MA: ['马萨诸塞', 42.3, -71.8, 'NE'], MD: ['马里兰', 39.0, -76.8, 'S'], ME: ['缅因', 45.4, -69.2, 'NE'], MI: ['密歇根', 44.3, -85.4, 'MW'],
  MN: ['明尼苏达', 46.3, -94.3, 'MW'], MO: ['密苏里', 38.4, -92.5, 'MW'], MS: ['密西西比', 32.7, -89.7, 'S'], MT: ['蒙大拿', 47.0, -109.6, 'W'],
  NC: ['北卡罗来纳', 35.5, -79.4, 'S'], ND: ['北达科他', 47.5, -100.5, 'MW'], NE: ['内布拉斯加', 41.5, -99.8, 'MW'], NH: ['新罕布什尔', 43.7, -71.6, 'NE'],
  NJ: ['新泽西', 40.2, -74.7, 'NE'], NM: ['新墨西哥', 34.4, -106.1, 'W'], NV: ['内华达', 39.3, -116.6, 'W'], NY: ['纽约', 42.9, -75.5, 'NE'],
  OH: ['俄亥俄', 40.3, -82.8, 'MW'], OK: ['俄克拉何马', 35.6, -97.5, 'S'], OR: ['俄勒冈', 43.9, -120.6, 'W'], PA: ['宾夕法尼亚', 40.9, -77.8, 'NE'],
  RI: ['罗得岛', 41.7, -71.5, 'NE'], SC: ['南卡罗来纳', 33.9, -80.9, 'S'], SD: ['南达科他', 44.4, -100.2, 'MW'], TN: ['田纳西', 35.9, -86.3, 'S'],
  TX: ['得克萨斯', 31.5, -99.3, 'S'], UT: ['犹他', 39.3, -111.7, 'W'], VA: ['弗吉尼亚', 37.5, -78.8, 'S'], VT: ['佛蒙特', 44.1, -72.7, 'NE'],
  WA: ['华盛顿州', 47.4, -120.5, 'W'], WI: ['威斯康星', 44.6, -89.9, 'MW'], WV: ['西弗吉尼亚', 38.6, -80.6, 'S'], WY: ['怀俄明', 43.0, -107.6, 'W'],
};
const EN = Object.fromEntries('AL Alabama,AR Arkansas,AZ Arizona,CA California,CO Colorado,CT Connecticut,DE Delaware,FL Florida,GA Georgia,IA Iowa,ID Idaho,IL Illinois,IN Indiana,KS Kansas,KY Kentucky,LA Louisiana,MA Massachusetts,MD Maryland,ME Maine,MI Michigan,MN Minnesota,MO Missouri,MS Mississippi,MT Montana,NC North Carolina,ND North Dakota,NE Nebraska,NH New Hampshire,NJ New Jersey,NM New Mexico,NV Nevada,NY New York,OH Ohio,OK Oklahoma,OR Oregon,PA Pennsylvania,RI Rhode Island,SC South Carolina,SD South Dakota,TN Tennessee,TX Texas,UT Utah,VA Virginia,VT Vermont,WA Washington,WI Wisconsin,WV West Virginia,WY Wyoming'.split(',').map((x) => [x.slice(0, 2), x.slice(3)]));
// curated lexical questions with a short Chinese prompt (id = Harvard question number)
const Q = {
  50: '称呼两个以上的人（"你们"）', 58: '在自家门廊/院子里卖旧物', 64: '那种夹冷切肉的长三明治', 65: '夏夜发光的小虫', 66: '溪里的小龙虾',
  67: '腿极长的蜘蛛状虫子', 73: '体育课穿的橡胶底运动鞋', 74: '一碰就卷成球的灰色小虫', 75: '超市里推的购物车', 76: '十字路口的斜对面',
  81: '冷到起的鸡皮疙瘩', 84: '几条路汇合的环形路口', 97: '垃圾桶', 98: '"不小心"', 99: '与高速平行的小路', 100: '修剪草坪的动词', 103: '学校里能喝水的饮水设施',
  104: '地下公共铁路系统', 105: '含糖碳酸饮料的通称', 106: '用卫生纸缠满别人家的房子', 109: '装杂货的纸袋', 110: '万圣节前一夜', 111: '面包的两头', 117: '建筑半地下/地下的那一层',
  119: '餐厅买了带回家吃', 120: '抢车的前排座位时喊', 62: '高速公路中间的隔离带', 61: '街道中间的绿化带', 49: '"我把重箱子 ___ 上楼"（drag 的过去式）', 85: '女生扎头发的东西',
  72: '家具下的灰尘团', 80: '出太阳时下的雨', 93: '排队（in line / on line）', 101: '上交作业', 41: '水龙头（spigot / spicket）', 26: 'route 的读音', 89: '凉拌卷心菜 coleslaw 能说 slaw 吗',
  86: '你用 cruller 这个词吗', 28: 'cot 和 caught 读音相同吗', 51: '"Are you coming with?" 能单独成句吗', 60: '人行道和马路之间的草带', 29: 'almond 的读音',
};
const BAD = /other|no word|have no|never heard|don't|neither|both|interchangeabl|equally|different|distinction|have no idea|either|not sure|sure|know what|spell/i;
const clean = (t) => t.replace(/\s*\(.*?\)\s*$/, '').replace(/\s+/g, ' ').trim();

// nat[q][k] = unweighted mean across states
const qs = {};
for (const id of Object.keys(Q)) {
  const base = S.CA[id];
  const opts = base.opts.map((o) => ({ k: o.k, t: clean(o.t), raw: o.t, p: Object.fromEntries(codes.map((c) => [c, S[c][id]?.opts.find((x) => x.k === o.k)?.p ?? 0])) }));
  for (const o of opts) o.nat = codes.reduce((a, c) => a + o.p[c], 0) / codes.length;
  qs[id] = { id: +id, zh: Q[id], en: base.q, opts };
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
  questions[id] = { zh: q.zh, en: q.en.slice(0, 120), opts: Object.fromEntries(q.opts.filter((o) => puzzles.some((p) => p.clues.some(([a, k]) => a === +id && k === o.k)) || true).map((o) => [o.k, { t: o.t, nat: +o.nat.toFixed(3), p: Object.fromEntries(codes.map((c) => [c, Math.round(o.p[c] * 1000) / 10])) }])) };
}
const states = Object.fromEntries(codes.map((c) => [c, { zh: STATES[c][0], en: EN[c], lat: STATES[c][1], lng: STATES[c][2], reg: STATES[c][3] }]));
const out = { n: 123456 && 0, states, questions, puzzles };
delete out.n;
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log('puzzles', puzzles.length, 'questions', Object.keys(questions).length, 'size', fs.statSync('../data.json').size);
console.log('rank dist', [1, 2, 3, 4, 5, 6].map((r) => puzzles.filter((p) => p.rank === r).length).join(','));
