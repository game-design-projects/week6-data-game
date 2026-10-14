// #82 Changelog — a release note with the software's name blacked out; guess the software, then the year.
const GENERIC = new Set(['core', 'cli', 'framework', 'releases', 'main']);

/** Names to hide for a repo: display name, repo name, owner, and the alnum-stripped forms. */
export function aliases(repo) {
  const [owner, name] = repo.id.split('/');
  const set = new Set([repo.name, name, owner, repo.name.replace(/\.js$/i, ''), name.replace(/-/g, ' ')]);
  return [...set].filter((w) => w && w.length >= 3 && !GENERIC.has(w.toLowerCase()));
}

export function redact(text, repo) {
  let out = text;
  for (const w of aliases(repo).sort((a, b) => b.length - a.length)) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${esc}${w.length >= 5 ? '\\w*' : '\\b'}`, 'gi'), '▇▇▇');
  }
  return out;
}

export function redactTag(tag, repo) {
  return redact(tag, repo).replace(/^[a-z]+[-_]?(?=\d)/i, (m) => (/^v$/i.test(m) ? m : '▇'));
}

export default {
  meta: {
    num: 82,
    slug: 'changelog',
    title: 'Changelog',
    tagline: '一段被涂黑名字的开源软件更新日志：猜它是哪个软件，再猜是哪一年发布的。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '屏幕上是某个软件一次正式发布（Release）的更新说明，软件的名字已被涂黑。',
      '第一步：从列表里选出是哪个软件，最多 6 次。每猜错一次，解锁一条新线索（完整说明、编程语言、版本号、项目年龄……）。',
      '第二步：猜这个版本是哪一年发布的，每差 1 年扣分。',
      '提示：依赖的运行时版本、支持的平台、被修的 bug 类型，都会暴露时代。',
    ],
    scoring: '软件 100 分（第 1 次猜中满分，每多一次少约 17 分）+ 年份 100 分（差 0 年满分，差 2 年约 37 分），取平均。',
    sources: [{ name: 'GitHub Releases API', url: 'https://docs.github.com/en/rest/releases/releases', note: '53 个热门开源项目的正式发布说明' }],
    dataNote: '更新说明取自各项目 GitHub Release 页面，已去除链接与提交号、截取前几行；名字涂黑由规则匹配完成，偶尔会有漏网的别称。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { repo: p.repo, tag: p.tag };
  },

  async play(ctx, pz) {
    const { ui } = ctx;
    const repos = ctx.data.repos;
    const byId = new Map(repos.map((r) => [r.id, r]));
    const P = ctx.data.puzzles.find((x) => x.repo === pz.repo && x.tag === pz.tag);
    const R = byId.get(P.repo);
    ctx.log('puzzle', P.repo, P.tag, P.year);

    const note = (n) => ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } },
      P.lines.slice(0, n).map((l) => ui.h('li', redact(l, R))));
    const clues = [
      note(3),
      note(P.lines.length),
      `这个项目主要用 ${R.lang || '多种语言'} 编写。`,
      ui.h('div', '这次发布的版本标签：', ui.code(redactTag(P.tag, R))),
      `项目创建于 ${R.since} 年。`,
      `名称以 “${R.name[0].toUpperCase()}” 开头，在 GitHub 上约 ${Math.round(R.stars / 1000)}k 星。`,
    ];

    const options = repos.map((r) => ({ id: r.id, label: r.name, hint: r.lang || '', aliases: [r.id, r.id.split('/')[1]] }));
    const g = await ctx.guess({
      options, answer: R.id, maxGuesses: 6,
      title: '这是哪个软件的更新日志？',
      placeholder: '输入软件名…',
      clues, cluesTitle: '更新说明与线索',
      columns: ['语言', '创建年'],
      near: (a, b) => byId.get(a.id).lang === byId.get(b.id).lang,
      feedback: (a, b) => {
        const x = byId.get(a.id), y = byId.get(b.id);
        return [
          { text: x.lang || '—', state: x.lang === y.lang ? 'hit' : undefined },
          { text: `${x.since}${x.since === y.since ? '' : x.since < y.since ? ' ↑' : ' ↓'}`, num: true, state: Math.abs(x.since - y.since) <= 2 ? 'near' : undefined },
        ];
      },
    });
    ctx.log('software stage', g.score);

    ctx.stage.append(ui.callout(`答案是 ${R.name}。它的项目创建于 ${R.since} 年，现在来猜这个版本发布于哪一年。`, g.win ? 'good' : 'warn'));
    const y = await ctx.estimate({
      title: '这个版本是哪年发布的？',
      answer: P.year, min: Math.min(2008, R.since), max: 2026, step: 1, initial: Math.round((R.since + 2026) / 2),
      format: (v) => `${Math.round(v)} 年`, scoring: 'abs', scale: 2,
    });
    ctx.log('year stage', y.score, y.guess);

    const res = ctx.combine([g, y]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['软件', `${R.name}（${P.repo}）`], ['版本', `${P.tag} · ${P.date}`], ['你猜的年份', y.guess != null ? `${Math.round(y.guess)} 年` : '—']]),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, P.lines.map((l) => ui.h('li', l))),
      ui.h('div', { class: 'small muted' }, `线索规律：更新说明里提到的运行时版本、平台与 bug 类型会暴露时代；项目创建于 ${R.since} 年，所以发布年份不会更早。`),
      ui.h('a', { href: P.url, target: '_blank', rel: 'noopener' }, '查看原始 Release'));
    return res;
  },
};
