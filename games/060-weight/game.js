// #60 Weight — read a board game's box blurb + mechanics, guess its BGG "complexity weight" (1–5).

const STOP = new Set(['the', 'and', 'of', 'for', 'game', 'games', 'board', 'card', 'with', 'from', 'second', 'third', 'edition', 'new', 'old', 'one', 'two', 'sea', 'war', 'art', 'hex', 'big', 'age', 'all', 'you', 'who', 'its', 'her', 'his', 'out', 'red', 'day', 'man']);
const fold = (s) => [...s.normalize('NFC')].map((c) => c.normalize('NFD')[0]).join('');
const isL = '[\\p{L}\\p{N}]';

/** Hide the game's own title (and its distinctive words) inside the blurb. Accent-insensitive. */
export function redactName(text, name) {
  let out = text.normalize('NFC');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = fold(name).split(/[^A-Za-z0-9'’]+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  // title with any punctuation/spacing between words
  const phrase = (t) => fold(t).split(/[^A-Za-z0-9]+/).filter(Boolean).map(esc).join('[^\\p{L}\\p{N}]{1,3}');
  const full = phrase(name);
  const main = phrase(name.split(/[:(–—]| - /)[0]); // title without subtitle
  const apply = (re) => {
    const folded = fold(out);
    if (folded.length !== out.length) return; // cannot align positions, skip
    let res = '', last = 0;
    for (const m of folded.matchAll(re)) { res += out.slice(last, m.index) + '▇▇▇'; last = m.index + m[0].length; }
    out = res + out.slice(last);
  };
  if (main && main !== full) apply(new RegExp(`(?<!${isL})${main}[\\p{L}\\p{N}]*`, 'giu'));
  if (full) apply(new RegExp(`(?<!${isL})${full}[\\p{L}\\p{N}]*`, "giu"));
  for (const w of words) {
    const ww = esc(w).replace(/['’]/g, "['’]?");
    apply(new RegExp(`(?<!${isL})${ww}[\\p{L}\\p{N}'’]*`, 'giu'));
  }
  return out.replace(/(▇▇▇[\s:,'’-]*){2,}/g, '▇▇▇ ').replace(/▇▇▇\s+(?=[,.;:!?)])/g, '▇▇▇');
}

export const ROUNDS = 3;
export const SCALE = 0.5;
export const roundScore = (guess, answer) => 100 * Math.exp(-Math.abs(guess - answer) / SCALE);

export const band = (w) => (w < 1.8 ? '轻度（家庭/聚会）' : w < 2.6 ? '中轻度' : w < 3.4 ? '中度' : w < 4.1 ? '中重度' : '重度（硬核策略）');

export default {
  meta: {
    num: 60,
    slug: 'weight',
    title: 'Weight',
    tagline: '看桌游的简介、机制和时长，猜它在 BoardGameGeek 上的复杂度评分（1–5）。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '每天三款桌游，游戏名已被涂黑（简介为 BGG 英文原文）。读一读简介、机制、游玩时长和建议年龄。',
      '拖动滑块或输入数字，猜玩家们给它的「复杂度」平均分：1 = 轻松上手，5 = 极其烧脑。',
      '线索：游戏时间越长、机制越多（如工人放置、经济、地区控制）通常越重；纸牌、猜词、反应类通常很轻。',
      '按误差计分：每差 0.5 分，该款得分降到约三分之一；三款相加，满分 300。',
    ],
    scoring: '每款 100 × e^(−误差/0.5)，三款相加，满分 300；差 0.35 约 50 分，差 0.5 约 37 分。',
    sources: [
      { name: 'BoardGameGeek（complexity weight）', url: 'https://boardgamegeek.com/', note: '通过 api.geekdo.com/api/dynamicinfo 取得众多玩家投票的平均权重' },
      { name: 'TidyTuesday 2022-01-25 · BGG 简介/机制/玩家数', url: 'https://github.com/rfordatascience/tidytuesday/tree/master/data/2022/2022-01-25' },
    ],
    dataNote: '收录 BGG 评分人数最多的约 260 款游戏中、复杂度投票 ≥150 人的 259 款（快照，权重取自 2026 年 10 月，简介/机制来自 2022-01 的 BGG 镜像）。简介为 BGG 英文原文，游戏名及其关键词已涂黑。没有放盒面图片：盒面印有游戏名，会直接泄露答案。BGG 官方 XML API 需要令牌，网页使用的 JSON 接口（api.geekdo.com）未开放跨域（CORS），浏览器无法实时读取，所以不是实时数据。',
  },

  puzzle({ data, pick, rng }) {
    const a = pick(data.games);
    const ok = (g, used) => used.every((u) => Math.abs(g.weight - u.weight) >= 0.6);
    const pool = rng.shuffle(data.games.filter((g) => g.id !== a.id));
    const chosen = [a];
    for (const g of pool) { if (chosen.length < ROUNDS && ok(g, chosen)) chosen.push(g); }
    return { ids: rng.shuffle(chosen.map((g) => g.id)) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const games = ctx.data.games;
    const results = [];
    const picked = p.ids.map((id) => games.find((g) => g.id === id));
    const mean = (a) => a.reduce((s, x) => s + x.weight, 0) / (a.length || 1);
    const globalAvg = mean(games);
    const mechAvg = (m) => { const l = games.filter((x) => x.mechs.includes(m)); return { m, n: l.length, avg: mean(l) }; };

    for (let i = 0; i < picked.length; i++) {
      const g = picked[i];
      const players = g.minp === g.maxp ? `${g.minp}` : `${g.minp}–${g.maxp}`;
      const box = ui.panel({ kicker: `第 ${i + 1} / ${picked.length} 款`, title: '这款桌游有多复杂？' },
        ui.h('div', { class: 'ds-stack' },
          ui.quote(redactName(g.desc, g.name)),
          ui.h('div', { class: 'ds-grid', style: { '--min': '90px' } },
            ui.stat({ label: '发行', value: String(g.year) }),
            ui.stat({ label: '玩家', value: players }),
            ui.stat({ label: '时长', value: `${g.time}′` }),
            ui.stat({ label: '年龄', value: `${g.age}+` })),
          ui.h('div', { class: 'small muted' }, '类型'), ui.chips(g.cats),
          ui.h('div', { class: 'small muted' }, '机制'), ui.chips(g.mechs)));
      ctx.stage.append(box);
      ctx.log('round', i + 1, g.name, g.weight);

      const r = await ctx.estimate({
        answer: g.weight, min: 1, max: 5, step: 0.05, initial: 2.5,
        format: (v) => v.toFixed(2), scoring: 'abs', scale: SCALE,
        title: '你猜它的复杂度是？',
      });
      const peers = games.filter((x) => x.id !== g.id && Math.abs(x.time - g.time) <= Math.max(15, g.time * 0.25));
      const sig = g.mechs.map(mechAvg).filter((x) => x.n >= 5).sort((x, y) => Math.abs(y.avg - globalAvg) - Math.abs(x.avg - globalAvg)).slice(0, 3);
      const sigText = sig.length ? sig.map((x) => `${x.m}（${x.n} 款平均 ${x.avg.toFixed(2)}）`).join('；') : '没有特别偏重或偏轻的机制';
      const verdict = r.guess == null ? '' : Math.abs(r.guess - g.weight) <= 0.25 ? '猜得很准。' : r.guess > g.weight ? '你高估了。' : '你低估了。';
      r.detail = ui.panel({ plain: true }, ui.kv([
        ['游戏', `${g.name}（${g.year}）`],
        ['复杂度', `${g.weight.toFixed(2)} / 5 · ${band(g.weight)}（${ctx.core.fmtNum(g.votes)} 人投票）`],
        ['你猜的', r.guess == null ? '—' : `${Number(r.guess).toFixed(2)} ${verdict}`],
        ['时长线索', `时长约 ${g.time} 分钟的同类热门游戏（${peers.length} 款）平均 ${mean(peers).toFixed(2)}；它自己是 ${g.weight.toFixed(2)}。全部 ${games.length} 款平均 ${globalAvg.toFixed(2)}。`],
        ['机制线索', sigText],
        ['全部机制', g.mechs.join('、') || '—'],
        ['BGG 评分', `${g.rating}（第 ${g.rank} 名）`],
      ]));
      results.push(r);
      box.style.opacity = '.6';
    }
    return ctx.combine(results);
  },
};
