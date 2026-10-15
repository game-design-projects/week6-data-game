// #82 Changelog — a release note with the software's name blacked out; guess the software, then the year.
const GENERIC = new Set(['core', 'cli', 'framework', 'releases', 'main']);
const BAR = '▇▇▇';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every name to hide for a repo: display name, repo name, owner, plus data.json's `alias` list. "X$" = whole word only. */
export function aliases(repo) {
  const [owner, name] = repo.id.split('/');
  const set = new Set([repo.name, name, owner, repo.name.replace(/\.js$/i, ''), name.replace(/-/g, ' '), ...(repo.alias || [])]);
  const exact = new Set([...set].filter((w) => w.endsWith('$')).map((w) => w.slice(0, -1).toLowerCase()));
  return [...set].filter((w) => w && w.replace(/\$$/, '').length >= 2 && !GENERIC.has(w.toLowerCase()) && (w.endsWith('$') || !exact.has(w.toLowerCase())));
}

/** Regex for one alias: separators (space - _ .) match each other or nothing, so "Home Assistant" hits home-assistant too. */
function aliasRegex(raw) {
  if (raw.startsWith('re:')) return new RegExp(raw.slice(3), 'g'); // raw regex, case-sensitive
  const exact = raw.endsWith('$');
  const w = exact ? raw.slice(0, -1) : raw;
  const body = w.split(/[\s\-_.]+/).filter(Boolean).map(esc).join('[\\s\\-_.]?');
  if (w.length < 3) return new RegExp(`(?<![\\w])${body}(?![\\w])`, 'g'); // short: case-sensitive whole word
  return new RegExp(`(?<![A-Za-z0-9])${body}${exact ? '(?![A-Za-z0-9])' : '[A-Za-z0-9]*'}`, 'gi');
}

export function redact(text, repo) {
  let out = text;
  for (const w of aliases(repo).sort((a, b) => b.length - a.length)) out = out.replace(aliasRegex(w), BAR);
  return out;
}

/** True if any alias of the repo still occurs in the (already redacted) text. */
export function leaks(text, repo) {
  return aliases(repo).some((w) => { const re = aliasRegex(w); return re.test(text); });
}

export function redactTag(tag, repo) {
  return redact(tag, repo).replace(/^[a-z][a-z-_]*?[-_]?(?=\d)/i, (m) => (/^v$/i.test(m) ? m : '')).replace(/\b(19|20)\d\d\b/g, '▇▇▇▇');
}

/** Dated/versioned tech mentioned in the note ("Python 3.12", "Node 18") — the hints that reveal the era. */
export function eraHints(lines) {
  const re = /\b(Python|Node(?:\.js)?|Java|JDK|PHP|Ruby|Rust|Go|Windows(?: Server)?|macOS|Ubuntu|Debian|Android|iOS|Xcode|Chrome|Electron|Angular|React|TypeScript|Kotlin|Swift|CUDA|OpenSSL|Qt|GCC|LLVM|Vue|Webpack|Vite|Kubernetes|Docker|ECMAScript|ES|C\+\+|Linux)\s*v?\d+(?:\.\d+){0,2}\b/g;
  const found = [];
  for (const l of lines) for (const m of l.matchAll(re)) if (!found.includes(m[0])) found.push(m[0]);
  return found.slice(0, 4);
}

/** Years that were blacked out of the note ("CVE-2026-1234", "Dec 2025") with a few characters of context. */
export function yearMentions(raw) {
  const out = [];
  for (const l of raw) for (const m of l.matchAll(/(\S{0,12}?)\b((?:19|20)\d\d)\b(\S{0,6})/g)) { const t = `${m[1]}${m[2]}${m[3]}`.trim(); if (!out.includes(t)) out.push(t); }
  return out.slice(0, 3);
}

/** The one-line clue: the most informative (longest) of the first four lines. */
export function firstLine(lines) {
  return lines.slice(0, 4).reduce((a, b) => (b.length > a.length ? b : a), lines[0]);
}

export default {
  meta: {
    num: 82,
    slug: 'changelog',
    title: 'Changelog',
    tagline: '一行被涂黑名字的开源软件更新日志：先猜它是哪个软件，再猜是哪一年发布的。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '屏幕上是某个开源软件一次正式发布（Release）里的一行更新说明，软件名字、发布日期和年份都已被涂黑。',
      '第一步：从列表里选出是哪个软件，最多 6 次。每猜错一次，解锁一条新线索：前几行说明、完整说明、编程语言、版本号、项目创建年份、首字母。',
      '第二步：猜这个版本是哪一年发布的，每差 1 年就大幅扣分。',
      '提示：依赖的运行时版本（如 Python 3.12）、支持的平台、被修的 bug 类型，都会暴露时代。',
    ],
    scoring: '软件 100 分（第 1 次猜中满分，之后每多猜一次约少 17 分）+ 年份 100 分（差 0 年满分，差 1 年约 61 分，差 2 年约 37 分，差 5 年不到 10 分），两项相加，满分 200。',
    sources: [
      { name: 'GitHub Releases API', url: 'https://docs.github.com/en/rest/releases/releases', note: '53 个热门开源项目的正式发布说明（GET /repos/{owner}/{repo}/releases）' },
      { name: 'GitHub Repos API', url: 'https://docs.github.com/en/rest/repos/repos#get-a-repository', note: '项目语言、星标数与创建年份' },
    ],
    dataNote: '更新说明取自各项目 GitHub Release 页面，已去除链接、提交号与日期，只留前几行；名字涂黑由规则匹配加人工别名表完成，构建时对整个题库做过泄漏扫描。数据为快照：GitHub API 未登录每小时仅 60 次请求，且题目需要固定的历史发布，所以没有在浏览器里实时拉取。',
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

    const list = (lines) => ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, lines.map((l) => ui.h('li', redact(l, R))));
    const clues = [
      ui.quote(redact(firstLine(P.lines), R)),
      list(P.lines),
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

    ctx.stage.append(ui.callout(`答案是 ${R.name}。它的项目创建于 ${R.since} 年，现在来猜这个版本发布于哪一年（再看一眼上面的说明与版本号）。`, g.win ? 'good' : 'warn'));
    const y = await ctx.estimate({
      title: '这个版本是哪年发布的？',
      answer: P.year, min: R.since, max: 2026, step: 1, initial: Math.round((R.since + 2026) / 2),
      format: (v) => `${Math.round(v)} 年`, scoring: 'abs', scale: 2,
    });
    ctx.log('year stage', y.score, y.guess);

    const res = ctx.combine([g, y]);
    const raw = P.raw || P.lines;
    const hints = eraHints(raw);
    const age = P.year - R.since;
    const ys = yearMentions(raw);
    const why = (ys.length ? `说明里被涂掉的年份：${ys.join('、')}，直接给出了答案。` : '')
      + (hints.length
        ? `这条说明里的时代线索：${hints.join('、')}——这些依赖或平台版本只在 ${P.year} 年前后流行。`
        : ys.length ? '' : `这条说明没有写明依赖版本，主要靠版本号 ${P.tag} 推断：项目创建于 ${R.since} 年，这个版本发布时它已 ${age} 岁。`);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['软件', `${R.name}（${P.repo}）`], ['版本', `${P.tag} · ${P.date}`], ['项目年龄', `发布时已 ${age} 岁`], ['你猜的年份', y.guess != null ? `${Math.round(y.guess)} 年` : '—']]),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, raw.map((l) => ui.h('li', l))),
      ui.h('div', { class: 'small muted' }, `线索规律：${why}`),
      ui.h('a', { href: P.url, target: '_blank', rel: 'noopener' }, '查看原始 Release'));
    return res;
  },
};
