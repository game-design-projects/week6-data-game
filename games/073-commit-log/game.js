// #73 Commit Log — five real commit messages; guess the repository.
const BAR = '▇▇▇';
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words that identify a repo: name tokens, the joined name ("nextjs"), owner tokens, and whole short names ("go"). */
export function nameTokens(id) {
  const [owner, name] = id.includes('/') ? id.split('/') : ['', id];
  const toks = new Set();
  const nameParts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (const t of nameParts) if (t.length >= 3 || nameParts.length === 1) toks.add(t.toLowerCase());
  if (nameParts.length > 1) toks.add(nameParts.join('').toLowerCase());
  for (const t of owner.split(/[^A-Za-z0-9]+/)) if (t.length >= 3) toks.add(t.toLowerCase());
  return [...toks];
}

/** Black out everything that names the repo (name, owner, joined forms, "Next.js"-style suffixes). */
export function redact(text, id) {
  let out = String(text ?? '');
  for (const t of nameTokens(id)) {
    out = out.replace(new RegExp(`\\b${esc(t)}${t.length >= 4 ? '\\w*' : ''}\\b`, 'gi'), BAR);
  }
  return out.replace(new RegExp(`${BAR}\\.(js|rs|py|io|go|ts)\\b`, 'gi'), BAR);
}

// ---- style fingerprint: which formatting habits give a repo away ----
const FEATURES = [
  { key: 'prefix', test: (m) => /^[\w./+-]+(\([^)]*\))?!?: /.test(m), say: (p, a) => `${p}% 的提交以「子系统: 」式前缀开头（样本池平均 ${a}%）` },
  { key: 'conv', test: (m) => /^(feat|fix|chore|docs|refactor|test|tests|perf|build|ci|style)(\([^)]*\))?!?: /i.test(m), say: (p, a) => `${p}% 的提交用 Conventional Commits 前缀 feat/fix/chore（样本池平均 ${a}%）` },
  { key: 'pr', test: (m) => /\(#\d+\)\s*$/.test(m), say: (p, a) => `${p}% 的提交末尾带 PR 编号「(#1234)」（样本池平均 ${a}%）` },
  { key: 'cap', test: (m) => /^[A-Z]/.test(m), say: (p, a) => `${p}% 的提交首字母大写（样本池平均 ${a}%）` },
  { key: 'dot', test: (m) => /\.$/.test(m), say: (p, a) => `${p}% 的提交以句号结尾（样本池平均 ${a}%）` },
  { key: 'long', test: (m) => m.length > 60, say: (p, a) => `${p}% 的提交标题超过 60 个字符（样本池平均 ${a}%）` },
];
export const shareOf = (msgs, f) => msgs.filter(f.test).length / Math.max(1, msgs.length);

/** Two most distinctive style habits of `repo` relative to the pool, as Chinese sentences. */
export function styleNotes(repo, repos) {
  const rows = FEATURES.map((f) => {
    const mine = shareOf(repo.msgs, f);
    const avg = repos.reduce((s, r) => s + shareOf(r.msgs, f), 0) / repos.length;
    return { f, mine, avg, d: Math.abs(mine - avg) };
  }).filter((x) => x.d >= 0.2).sort((a, b) => b.d - a.d).slice(0, 2);
  return rows.map((x) => x.f.say(Math.round(x.mine * 100), Math.round(x.avg * 100)));
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
      '先给你两条真实的 commit message（仓库名、作者名已涂黑），从列表里选出是哪个仓库，最多猜 6 次。',
      '每猜错一次多解锁一条线索：更多 commit、主语言、创建年份与简介。',
      '每次猜测的反馈：语言相同标黄；年份与星标旁的箭头指向答案所在方向（↑ 答案更新 / 更多，↓ 答案更早 / 更少）。',
      '看格式：「subsystem: 动词」是内核风格；feat/fix 前缀是前端工具链；末尾 (#1234) 是 GitHub PR 合并。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分（第 6 次约 17 分），6 次都没猜中 0 分。',
    sources: [
      { name: 'GitHub REST API：commits', url: 'https://docs.github.com/en/rest/commits/commits', note: '每个仓库取默认分支最近 100 条提交，过滤合并、版本号、依赖更新、含链接或非 ASCII 的提交' },
      { name: 'GitHub REST API：repos', url: 'https://docs.github.com/en/rest/repos/repos', note: '主语言、创建年份、星标数、简介' },
    ],
    dataNote: '题库是 100 个知名开源仓库的快照（commit 取自抓取时的最近 100 条，星标数为抓取时数值）。原建议的 GH Archive 按小时的全站事件包过大，改用 GitHub API 直接取同类事实；GitHub 匿名接口限速 60 次/小时，因此不在浏览器里实时抓取。',
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
    const R = (t) => redact(t, ans.id);
    const msgBox = (xs, f = (x) => x) => ui.h('div', { class: 'ds-stack' }, xs.map((m) => line(ui, f(m))));
    ctx.log('puzzle', p.id);
    const clues = [
      msgBox(p.msgs.slice(0, 2), R),
      msgBox([p.msgs[2]], R),
      `主语言：${ans.lang}`,
      msgBox([p.msgs[3]], R),
      `创建于 ${ans.year} 年。简介：${R(ans.desc) || '（无）'}`,
      msgBox([p.msgs[4]], R),
    ];
    const options = repos.map((r) => ({ id: r.id, label: r.id, aliases: [r.name] }));
    const dir = (d) => (d > 0 ? '↑' : '↓');
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: 6,
      title: '这是哪个仓库？', placeholder: '输入仓库名…',
      clues, cluesTitle: 'Commit 与线索',
      columns: ['语言', '创建年份', '星标'],
      near: (g, a) => by.get(g.id).lang === by.get(a.id).lang,
      feedback: (g) => {
        const gr = by.get(g.id);
        const stars = ctx.core.fmtCompact(gr.stars);
        if (gr.id === ans.id) return [{ text: gr.lang, state: 'hit' }, { text: String(gr.year), state: 'hit', num: true }, { text: `★${stars}`, state: 'hit', num: true }];
        const dy = ans.year - gr.year;
        const ratio = ans.stars / Math.max(1, gr.stars);
        return [
          { text: gr.lang, state: gr.lang === ans.lang ? 'near' : undefined },
          { text: dy === 0 ? `${gr.year} ✓` : `${gr.year} ${dir(dy)}`, num: true, state: Math.abs(dy) <= 2 ? 'near' : undefined },
          { text: `${stars} ${dir(ans.stars - gr.stars)}`, num: true, state: ratio > 0.5 && ratio < 2 ? 'near' : undefined },
        ];
      },
    });
    const notes = styleNotes(ans, repos);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['答案', `${ans.id}（${ans.lang}，${ans.year} 年，★${ctx.core.fmtCompact(ans.stars)}）`], ['简介', ans.desc || '—']]),
      ui.h('div', { class: 'ink2' }, '原始 commit message（未涂黑）：'),
      msgBox(p.msgs),
      ui.callout(notes.length
        ? `这个仓库的格式指纹：${notes.join('；')}。`
        : `${ans.name} 的提交格式很「大众」，没有突出的格式习惯，要靠内容里的专有名词（模块、函数、工具名）才能认出来。`, 'good'));
    return res;
  },
};

function line(ui, t) { return ui.h('div', { class: 'mono small', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: '8px' } }, t); }
