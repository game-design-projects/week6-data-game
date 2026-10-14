// #81 Stack Trace — real error stacks from GitHub issues; name the language and the library/framework.
export function buildRounds(data, ts, rng) {
  const out = [];
  for (const t of ts) {
    const langs = Object.keys(data.langNames);
    const lopts = rng.shuffle([t.lang, ...rng.sample(langs.filter((l) => l !== t.lang), 3)]);
    const pool = (data.libsByLang[t.lang] || []).filter((l) => !t.libs.includes(l));
    const lib = t.libs[0];
    const bopts = rng.shuffle([lib, ...rng.sample(pool, Math.min(3, pool.length))]);
    out.push({ t, lopts, bopts, lib });
  }
  return out;
}

export default {
  meta: {
    num: 81,
    slug: 'stack-trace',
    title: 'Stack Trace',
    tagline: 'GitHub issue 里贴出的真实报错堆栈：猜它是什么语言，又踩在哪个框架或库上。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '每天 3 段从真实 GitHub issue 里摘出来的报错堆栈。',
      '每段回答两题：这是哪种语言？堆栈里出现的是哪个框架 / 库？',
      '线索全在帧的写法里：路径分隔符、文件后缀、包名前缀、方法命名风格。',
      '每答对一题得 1 分，共 6 分。',
    ],
    scoring: '答对 1 题 1 分，满分 6。',
    sources: [{ name: 'GitHub Search API（issues）', url: 'https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests' }],
    dataNote: '堆栈取自 2026-10 的公开 issue 代码块。语言与库由堆栈本身的特征（文件后缀、包名、site-packages / node_modules 路径等）规则判定，不是 issue 作者的标注。',
  },

  puzzle({ data, rng, pick }) {
    const first = pick(data.traces);
    const rest = data.traces.filter((t) => t.lang !== first.lang);
    const second = rng.pick(rest);
    const third = rng.pick(rest.filter((t) => t.lang !== second.lang));
    return { ids: [first.id, second.id, third.id] };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const ts = p.ids.map((id) => data.traces.find((t) => t.id === id));
    const rs = buildRounds(data, ts, ctx.rng);
    ctx.log('stack-trace: rounds', rs.map((r) => `${r.t.lang}/${r.lib}`));
    const rounds = [];
    rs.forEach((r, i) => {
      const body = ui.code(r.t.trace);
      rounds.push({
        prompt: `第 ${i + 1} 段：这是哪种语言的堆栈？`,
        body,
        options: r.lopts.map((l) => ({ label: data.langNames[l] })),
        correct: r.lopts.indexOf(r.t.lang),
        explain: `${data.langNames[r.t.lang]}。`,
      });
      rounds.push({
        prompt: `第 ${i + 1} 段：堆栈里出现的是哪个框架 / 库？`,
        body,
        options: r.bopts.map((l) => ({ label: l })),
        correct: r.bopts.indexOf(r.lib),
        explain: `${r.lib}（本段共检出：${r.t.libs.join('、')}）。`,
      });
    });
    const res = await ctx.rounds({ rounds, title: '读堆栈，认出它的出处', minWidth: 150 });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ...rs.map((r) => ui.h('div', { class: 'small' },
        ui.h('div', ui.h('b', `${data.langNames[r.t.lang]} · ${r.t.libs.join('、')}`), ' — ',
          ui.h('a', { href: `https://github.com/${r.t.repo}/issues/${r.t.n}`, target: '_blank', rel: 'noopener' }, `${r.t.repo}#${r.t.n}`)),
        ui.h('div', { class: 'muted' }, r.t.title))),
      ui.callout('线索：Python 的 File "…", line N；Java 的 at 包名.类(File.java:N)；JS 的 node_modules 路径；Go 的 goroutine；PHP 的 #0 开头；Ruby 的 in `方法`。', 'good'));
    return res;
  },
};
