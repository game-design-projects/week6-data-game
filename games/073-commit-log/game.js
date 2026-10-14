// #73 Commit Log — five real commit messages; guess the repository.
export function redact(text, name) {
  const toks = name.split(/[^A-Za-z0-9]+/).filter((t) => t.length >= 3);
  let out = text;
  for (const t of toks) out = out.replace(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi'), '▇▇▇');
  return out;
}

export default {
  meta: {
    num: 73,
    slug: 'commit-log',
    title: 'Commit Log',
    tagline: '五条真实的 commit message，猜它们来自哪个开源仓库。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '先给你两条真实的 commit message（仓库名已涂黑），从列表里猜是哪个仓库，最多 6 次。',
      '每猜错一次多解锁一条线索：更多 commit、主语言、创建年份、简介。',
      '每次猜测会告诉你：语言是否相同、创建年份差几年、星标数比答案多还是少。',
      '提示：「subsystem: 动词」像 Linux 内核；Conventional Commits 前缀（feat/fix）多见于前端工具；首字母大写的句子常见于 Go、Rust、Homebrew。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [{ name: 'GitHub REST API（commits 与 repo 元数据）', url: 'https://docs.github.com/en/rest/commits/commits', note: '每个仓库取最近 100 条提交，过滤合并、版本号、依赖更新等无信息量的提交' }],
    dataNote: '题目来自 59 个知名开源仓库的快照（原建议的 GH Archive 体积过大，改用 GitHub API 直接取同类事实）。',
  },

  puzzle({ data, pick, rng }) {
    const repo = pick(data.repos);
    return { id: repo.id, msgs: rng.sample(repo.msgs, 5) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const repos = ctx.data.repos;
    const by = new Map(repos.map((r) => [r.id, r]));
    const ans = by.get(p.id);
    const R = (t) => redact(t, ans.name);
    const msgBox = (xs) => ui.h('div', { class: 'ds-stack' }, xs.map((m) => line(ui, R(m))));
    ctx.log('puzzle', p.id);
    const clues = [
      msgBox(p.msgs.slice(0, 2)),
      msgBox([p.msgs[2]]),
      `主语言：${ans.lang}`,
      msgBox([p.msgs[3]]),
      `创建于 ${ans.year} 年。简介：${R(ans.desc) || '（无）'}`,
      msgBox([p.msgs[4]]),
    ];
    const options = repos.map((r) => ({ id: r.id, label: r.id, aliases: [r.name] }));
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: 6,
      title: '这是哪个仓库？', placeholder: '输入仓库名，如 torvalds/linux …',
      clues, cluesTitle: 'Commit 与线索',
      columns: ['语言', '创建年份', '星标'],
      near: (g, a) => by.get(g.id).lang === by.get(a.id).lang,
      feedback: (g) => {
        const gr = by.get(g.id);
        if (gr.id === ans.id) return [{ text: gr.lang, state: 'hit' }, { text: String(gr.year), state: 'hit', num: true }, { text: '=', state: 'hit' }];
        const dy = ans.year - gr.year;
        return [
          { text: gr.lang, state: gr.lang === ans.lang ? 'near' : undefined },
          { text: dy === 0 ? `${gr.year} ✓` : `${gr.year} ${dy > 0 ? '↑' : '↓'}`, num: true, state: Math.abs(dy) <= 2 ? 'near' : undefined },
          { text: gr.stars > ans.stars ? '↓ 更少' : '↑ 更多', num: false },
        ];
      },
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['答案', `${ans.id}（${ans.lang}，${ans.year} 年，★${ctx.core.fmtCompact(ans.stars)}）`], ['简介', ans.desc || '—']]),
      ui.h('div', { class: 'ink2' }, '原始 commit message（未涂黑）：'),
      msgBox0(ui, p.msgs),
      ui.callout('线索往往藏在格式里：子系统前缀、动词大小写、是否带 PR 编号。', 'good'));
    return res;
  },
};

function msgBox0(ui, xs) { return ui.h('div', { class: 'ds-stack' }, xs.map((m) => line(ui, m))); }
function line(ui, t) { return ui.h('div', { class: 'mono small', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: '8px' } }, t); }
