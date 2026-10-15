// #77 Wayback — an archived homepage with its brand scrubbed out. Name the site, then the year.

/** Human-readable notes on what the page's markup says about its era. Pure; unit-tested. */
export function eraNotes(fp) {
  const n = [];
  if (fp.frames) n.push('用了 <frameset> 框架：2005 年前常见');
  if (fp.marquee) n.push('有 <marquee>/<blink> 动画标签：2004 年前常见');
  if (fp.fonts >= 5) n.push(`${fp.fonts} 个 <font> 标签：样式还写在 HTML 里，CSS 尚未普及（2010 年前居多）`);
  if (fp.tables >= 8) n.push(`${fp.tables} 个 <table>：用表格排版（2012 年前居多）`);
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

const SHOT_STYLE = { width: '100%', maxHeight: '340px', objectFit: 'cover', objectPosition: 'top', display: 'block', border: '1px solid var(--rule)', borderRadius: '6px', background: '#fff', cursor: 'zoom-in' };

export const tld = (dom) => dom.slice(dom.indexOf('.'));

/** Year window (inclusive) that the markup alone allows, from the same rules as eraNotes. Pure; unit-tested. */
export function eraRange(fp) {
  let lo = 1995, hi = 2025;
  const up = (y) => { lo = Math.max(lo, y); }, down = (y) => { hi = Math.min(hi, y); };
  if (fp.frames) down(2005);
  if (fp.marquee) down(2004);
  if (fp.fonts >= 5) down(2010);
  if (fp.tables >= 8) down(2012);
  if (fp.fw.includes('jquery')) up(2007);
  if (fp.fw.includes('bootstrap')) up(2012);
  if (fp.fw.some((f) => ['react', 'angular', 'webpack', '__next'].includes(f))) up(2015);
  if (fp.viewport) up(2010);
  if (fp.og) up(2010);
  if (lo > hi) hi = lo;
  return [lo, hi];
}

/** Score for the year round (0..100): perfect = 100, 2 years off ≈ 61, 10 years off ≈ 8. */
export const yearScore = (guess, answer) => Math.exp(-Math.abs(Math.round(guess) - answer) / 4);

export default {
  meta: {
    num: 77,
    slug: 'wayback',
    title: 'Wayback',
    tagline: '互联网档案馆里的网站首页，品牌名和图片都被涂掉了。猜这是哪个网站，再猜是哪一年。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '你看到的是 Wayback Machine 存档的某个知名网站首页：图片被换成灰块，网站名、域名和年份数字被涂成 ▇▇▇。',
      '先从列表里猜网站，最多 5 次；每猜错一次解锁一条线索（标题文字与描述、技术指纹、域名后缀、域名首字母）。',
      '猜完网站后，根据版面和技术指纹（表格排版、Flash、jQuery、viewport……）估计存档是哪一年拍的。',
      '计分：网站最多 100 分（越早猜中越高）；年份误差 2 年约 61 分、5 年约 29 分、10 年约 8 分。满分 200。',
    ],
    scoring: '网站 100·(6−次数)/5；年份 100·exp(−误差年数/4)。两项相加，满分 200。',
    sources: [
      { name: 'Internet Archive Wayback Machine CDX API', url: 'https://web.archive.org/cdx/search/cdx?url=mit.edu&limit=1', note: '每个 (网站, 年份) 取该年 6 月之后第一份 200 状态的 HTML 存档' },
      { name: 'Wayback 原始快照（id_ 模式）', url: 'https://web.archive.org/web/20070601033900id_/http://www.mit.edu/', note: '构建时下载原始 HTML，再离线打码并渲染成线框截图' },
    ],
    dataNote: '浏览器不能实时渲染第三方存档，所以构建时（build/shoot.mjs）用无头 Chrome 渲染每份存档：脚本删除、图片换灰块、所有文字里的站名/域名/年份数字涂黑，得到线框截图；同时提取标题、导航、栏目文字和技术指纹。这是快照数据：Internet Archive 的 CDX/快照接口没有 CORS 头，浏览器无法实时读取。年份只取奇数年（1997–2023），部分网站在早年没有存档。站点简介为手写。',
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

    const shot = snap.img ? ui.h('img', {
      src: ctx.asset(snap.img), alt: '已涂黑的存档首页线框截图', loading: 'eager',
      style: SHOT_STYLE,
      onClick: () => ui.modal({ title: '存档页面（已涂黑）', body: ui.h('img', { src: ctx.asset(snap.img), alt: '', style: { width: '100%', height: 'auto', background: '#fff' } }) }),
    }) : null;

    const page = ui.h('div', { class: 'ds-stack' },
      shot,
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
      `域名（不含 www）的第一个字母是 “${site.dom[0].toUpperCase()}”。`,
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
      ui.h('div', { class: 'ds-stack' }, shot && ui.h('img', { src: ctx.asset(snap.img), alt: '已涂黑的存档首页线框截图', style: SHOT_STYLE }),
        ui.h('div', { class: 'ink2' }, '看版面和技术指纹：'), fpNode(snap.fp))));
    const r2 = await ctx.estimate({
      answer: p.y, min: 1996, max: 2025, step: 1, initial: 2010, title: '存档年份',
      format: (v) => `${Math.round(v)} 年`,
      scoring: yearScore,
    });
    ctx.log('year', p.y, r2.guess);

    const res = ctx.combine([r1, r2]);
    const [lo, hi] = eraRange(snap.fp);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['网站', `${site.name}（${site.dom}）`], ['简介', site.about || '—'], ['存档时间', `${snap.ts.slice(0, 4)}-${snap.ts.slice(4, 6)}-${snap.ts.slice(6, 8)}`],
        ['指纹指向的年份', `${lo}–${hi}`], ['你猜的年份', r2.guess != null ? `${Math.round(r2.guess)} 年` : '—']]),
      ui.h('div', { class: 'ink2' }, `这页的年代线索（真实年份 ${p.y}）：`),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, eraNotes(snap.fp).map((t) => ui.h('li', t))),
      ui.h('a', { href: snap.url, target: '_blank', rel: 'noopener' }, '在 Wayback Machine 打开原始存档 →'));
    return res;
  },
};
