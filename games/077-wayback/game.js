// #77 Wayback — an archived homepage with its brand scrubbed out. Name the site, then the year.

/** Human-readable notes on what the page's markup says about its era. Pure; unit-tested. */
export function eraNotes(fp) {
  const n = [];
  if (fp.frames) n.push('用了 <frameset> 框架：典型的 2000 年代初及更早');
  if (fp.marquee) n.push('有 <marquee>/<blink> 动画标签：90 年代味道');
  if (fp.fonts >= 5) n.push(`${fp.fonts} 个 <font> 标签：样式还写在 HTML 里，CSS 尚未普及`);
  if (fp.tables >= 8) n.push(`${fp.tables} 个 <table>：用表格排版，2000–2008 年常见`);
  if (fp.flash) n.push('嵌入了 Flash/embed：约 1999–2012');
  if (fp.fw.includes('jquery')) n.push('引用了 jQuery：约 2007 年之后');
  if (fp.fw.includes('bootstrap')) n.push('引用了 Bootstrap：约 2012 年之后');
  if (fp.fw.some((f) => ['react', 'angular', 'webpack', '__next'].includes(f))) n.push('出现现代前端框架/打包器：约 2015 年之后');
  if (fp.viewport) n.push('有 viewport meta：为手机适配，2010 年之后');
  else if (!fp.html5 && fp.css === 0) n.push('没有 viewport、没有外部样式表');
  if (fp.og) n.push('有 Open Graph 元标签：2010 年之后');
  if (fp.https > 5) n.push('页面里大量 https:// 链接：2014 年之后更常见');
  if (!n.length) n.push('没有特别鲜明的技术标记');
  return n;
}

export const tld = (dom) => dom.slice(dom.indexOf('.'));

export default {
  meta: {
    num: 77,
    slug: 'wayback',
    title: 'Wayback',
    tagline: '互联网档案馆里的网站首页，品牌名被涂黑了。猜这是哪个网站，再猜是哪一年。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '你看到的是 Wayback Machine 存档的某个知名网站首页的文字（标题、导航、栏目），网站名已被涂黑。',
      '先从列表里猜网站，最多 5 次；每猜错一次解锁一条线索（描述、技术指纹、域名后缀、首字母）。',
      '猜完网站后，根据页面的技术指纹（表格排版、Flash、jQuery、viewport……）估计存档年份。',
      '计分：网站最多 100 分（越早猜中越高）；年份每差 1 年约扣 10 分。',
    ],
    scoring: '网站 100·(6−次数)/5；年份 100·exp(−误差/4)。两项相加。',
    sources: [
      { name: 'Internet Archive Wayback Machine (CDX + 原始快照)', url: 'https://web.archive.org/', note: '每个 (网站, 年份) 取该年 6 月之后的第一份 200 状态 HTML 存档' },
    ],
    dataNote: '无法在浏览器里实时渲染并打码截图，因此构建时抓取原始存档 HTML，提取标题、导航链接、标题文字和技术指纹，并把站名/域名文字替换为 ▇▇▇。快照时间戳和链接都保留，可点开原始存档。',
  },

  puzzle({ data, pick }) {
    const s = pick(data.snaps);
    return { id: s.id, y: s.y, ts: s.ts };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const snap = ctx.data.snaps.find((s) => s.id === p.id && s.y === p.y);
    const site = ctx.data.sites.find((s) => s.id === p.id);
    ctx.log('puzzle', p.id, p.y);

    const page = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'mono small muted' }, '<title>'),
      ui.h('div', { style: { fontWeight: '600' } }, snap.title || '（无标题）'),
      ui.h('div', { class: 'mono small muted', style: { marginTop: '6px' } }, `导航与链接文字（${snap.links.length}）`),
      ui.chips(snap.links.slice(0, 24)));

    const fpNode = (fp) => ui.kv([
      ['HTML 体积', `${fp.kb} KB`], ['<table> / <font> / <img>', `${fp.tables} / ${fp.fonts} / ${fp.imgs}`],
      ['<script> / 样式表', `${fp.scripts} / ${fp.css}`], ['Flash / 框架集', `${fp.flash} / ${fp.frames}`],
      ['viewport / HTML5', `${fp.viewport ? '有' : '无'} / ${fp.html5 ? '是' : '否'}`], ['前端库', fp.fw.join(', ') || '无'],
    ]);

    const clues = [
      page,
      snap.heads.length || snap.desc
        ? ui.h('div', { class: 'ds-stack' }, snap.desc && ui.quote(snap.desc), snap.heads.length ? ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, snap.heads.map((t) => ui.h('li', t))) : null)
        : '这个页面几乎没有标题文字和描述，只能靠导航链接。',
      ui.h('div', '页面的技术指纹：', fpNode(snap.fp)),
      `域名后缀是 “${tld(site.dom)}”。`,
      `网站英文名第一个字母是 “${site.dom[0].toUpperCase()}”。`,
    ];

    const options = ctx.data.sites.map((s) => ({ id: s.id, label: s.name, hint: s.dom, aliases: [s.dom, s.dom.split('.')[0]] }));
    const byId = new Map(ctx.data.sites.map((s) => [s.id, s]));
    const r1 = await ctx.guess({
      options, answer: p.id, maxGuesses: 5, title: '这是哪个网站？', placeholder: '输入网站名或域名…',
      clues, cluesTitle: '存档内容', columns: ['域名后缀'],
      near: (g) => tld(byId.get(g.id).dom) === tld(site.dom),
      feedback: (g) => [{ text: tld(byId.get(g.id).dom), state: tld(byId.get(g.id).dom) === tld(site.dom) ? 'near' : undefined }],
      onGuess: (o, { correct, n }) => ctx.log('guess', o.id, correct, n),
    });

    ctx.stage.append(ui.panel({ kicker: '第二步', title: '这份存档是哪一年的？' },
      ui.h('div', { class: 'ds-stack' }, ui.h('div', { class: 'ink2' }, '看技术指纹：'), fpNode(snap.fp))));
    const r2 = await ctx.estimate({
      answer: p.y + 0.5, min: 1996, max: 2025, step: 1, initial: 2010, title: '存档年份',
      format: (v) => `${Math.round(v)} 年`,
      scoring: (g, a) => Math.exp(-Math.abs(Math.round(g) - Math.floor(a)) / 4),
    });
    ctx.log('year', p.y, r2.guess);

    const res = ctx.combine([r1, r2]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['网站', `${site.name}（${site.dom}）`], ['存档时间', `${snap.ts.slice(0, 4)}-${snap.ts.slice(4, 6)}-${snap.ts.slice(6, 8)}`]]),
      ui.h('div', { class: 'ink2' }, '年代线索：'),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, eraNotes(snap.fp).map((t) => ui.h('li', t))),
      ui.h('a', { href: snap.url, target: '_blank', rel: 'noopener' }, '在 Wayback Machine 打开原始存档 →'));
    return res;
  },
};
