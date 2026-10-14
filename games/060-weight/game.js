// #60 Weight — read a board game's box blurb + mechanics, guess its BGG "complexity weight" (1–5).

const STOP = new Set(['the', 'and', 'of', 'for', 'game', 'games', 'board', 'card', 'with', 'from', 'second', 'edition']);

/** Hide the game's own title (and its distinctive words) inside the blurb. */
export function redactName(text, name) {
  const words = name.split(/[^A-Za-z0-9'’]+/).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = text.replace(new RegExp(esc(name), 'gi'), '▇▇▇');
  for (const w of words) out = out.replace(new RegExp(`\\b${esc(w)}\\w*`, 'gi'), '▇▇▇');
  return out.replace(/(▇▇▇[\s:,-]*){2,}/g, '▇▇▇ ');
}

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
      '每天两款桌游，游戏名已被涂黑。读一读简介、机制、游玩时长和建议年龄。',
      '拖动滑块或输入数字，猜玩家们给它的「复杂度」平均分：1 = 轻松上手，5 = 极其烧脑。',
      '线索：游戏时间越长、机制越多（如工人放置、经济、地区控制）通常越重；纸牌、猜词、反应类通常很轻。',
      '按误差计分：每差 0.5 分，得分约降到三分之一。',
    ],
    scoring: '每局 100 × e^(−误差/0.5)，两局相加，满分 200。',
    sources: [
      { name: 'BoardGameGeek（complexity weight）', url: 'https://boardgamegeek.com/', note: '通过 api.geekdo.com/api/dynamicinfo 取得众多玩家投票的平均权重' },
      { name: 'TidyTuesday 2022-01-25 · BGG 简介/机制/玩家数', url: 'https://github.com/rfordatascience/tidytuesday/tree/master/data/2022/2022-01-25' },
    ],
    dataNote: '只收录评分人数最多的约 250 款游戏中，权重投票 ≥150 人的作品。简介为 BGG 英文原文，游戏名及其关键词已涂黑。BGG 官方 XML API 现已需要令牌，故权重取自其网页使用的 JSON 接口。',
  },

  puzzle({ data, pick, rng }) {
    const a = pick(data.games);
    const others = data.games.filter((g) => g.id !== a.id && Math.abs(g.weight - a.weight) >= 0.7);
    const b = rng.pick(others);
    return { ids: [a.id, b.id] };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const games = ctx.data.games;
    const results = [];
    const picked = p.ids.map((id) => games.find((g) => g.id === id));

    for (let i = 0; i < picked.length; i++) {
      const g = picked[i];
      const players = g.minp === g.maxp ? `${g.minp}` : `${g.minp}–${g.maxp}`;
      const box = ui.panel({ kicker: `第 ${i + 1} / ${picked.length} 款`, title: '这款桌游有多复杂？' },
        ui.h('div', { class: 'ds-stack' },
          ui.quote(redactName(g.desc, g.name)),
          ui.h('div', { class: 'ds-grid', style: { '--min': '90px' } },
            ui.stat({ label: '发行', value: String(g.year) }),
            ui.stat({ label: '玩家', value: players }),
            ui.stat({ label: '时长', value: g.time ? `${g.time}′` : '—' }),
            ui.stat({ label: '年龄', value: `${g.age}+` })),
          ui.h('div', { class: 'small muted' }, '类型'), ui.chips(g.cats),
          ui.h('div', { class: 'small muted' }, '机制'), ui.chips(g.mechs)));
      ctx.stage.append(box);
      ctx.log('round', i + 1, g.name, g.weight);

      const r = await ctx.estimate({
        answer: g.weight, min: 1, max: 5, step: 0.05, initial: 2.5,
        format: (v) => v.toFixed(2), scoring: 'abs', scale: 0.5,
        title: '你猜它的复杂度是？',
      });
      const peers = games.filter((x) => Math.abs(x.time - g.time) <= Math.max(15, g.time * 0.25));
      const avg = peers.reduce((s, x) => s + x.weight, 0) / (peers.length || 1);
      r.detail = ui.panel({ plain: true }, ui.kv([
        ['游戏', `${g.name}（${g.year}）`],
        ['复杂度', `${g.weight.toFixed(2)} / 5 · ${band(g.weight)}（${ctx.core.fmtNum(g.votes)} 人投票）`],
        ['你猜的', r.guess == null ? '—' : Number(r.guess).toFixed(2)],
        ['BGG 评分', `${g.rating}（第 ${g.rank} 名）`],
        ['同时长参照', `时长相近（约 ${g.time} 分钟）的 ${peers.length} 款热门游戏平均复杂度 ${avg.toFixed(2)}`],
        ['机制', g.mechs.join('、') || '—'],
      ]));
      results.push(r);
      box.style.opacity = '.6';
    }
    return ctx.combine(results);
  },
};
