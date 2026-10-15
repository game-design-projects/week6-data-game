// #70 Holiday — a year of public holidays with the names hidden; guess the country.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const zh = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };
const WEEKEND = (y, md) => [0, 6].includes(new Date(`${y}-${md}T00:00:00Z`).getUTCDay());
const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const BAR = '▇▇▇';

/**
 * Black out every word that starts with one of the country's `terms` (stems of the country's and capital's
 * name in dozens of languages, precomputed in build/build.mjs; accent-insensitive). CJK terms are plain
 * substrings. Whole words are replaced, so no "▇▇▇lantis"-style fragments survive.
 */
export function redact(text, terms) {
  const alpha = terms.filter((t) => !CJK.test(t));
  const han = terms.filter((t) => CJK.test(t));
  let out = String(text).replace(/[\p{L}\p{M}]+/gu, (w) => {
    if (CJK.test(w)) return w;
    const k = strip(w);
    return alpha.some((t) => k.startsWith(t)) ? BAR : w;
  });
  for (const t of han) out = out.split(t).join(BAR);
  return out.replace(new RegExp(`${BAR}(?:[\\s\\-'’]+${BAR})+`, 'g'), BAR);
}

/** Round score: 1st guess 100, then −1/6 per extra guess, 0 if never found. */
export function scoreFor(n, won, max = 6) {
  return won ? Math.round((100 * (max - n + 1)) / max) : 0;
}

const FAITH = [
  ['基督教', /christmas|easter|good friday|epiphany|ascension|pentecost|assumption|all saints|immaculate|corpus christi|whit monday|holy thursday|maundy|annunciation|nativity|candlemas/i],
  ['伊斯兰教', /eid|ramadan|mawlid|prophet|muharram|ashura|hijri|isra|laylat|arafat|tabaski|korit/i],
  ['佛教', /vesak|buddha|visakha|magha|asalha|songkran|poya/i],
  ['印度教', /diwali|deepavali|holi\b|dussehra|navratri|ganesh|krishna|thaipusam|maha shivaratri/i],
];
/** Count holidays per religion from their English names. */
export function faithCounts(holidays) {
  return FAITH.map(([label, re]) => ({ label, n: holidays.filter((h) => re.test(h.name)).length })).filter((x) => x.n > 0);
}

/** Holidays sorted from most unusual (fewest countries share the English name) to most generic. */
export function rarest(holidays, k) {
  return holidays.slice().sort((a, b) => a.common - b.common || (a.d < b.d ? -1 : 1))
    .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i).slice(0, k);
}

export default {
  meta: {
    num: 70,
    slug: 'holiday',
    title: 'Holiday',
    tagline: '一整年的法定假日日历，名字全部藏起来。看日期猜国家。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '日历上标出了某个国家 2026 年所有的法定假日：主色是全国假日，黄色只在部分地区放假，灰块是周末。',
      '从列表里选一个国家来猜，最多 6 次。每猜错一次多解锁一条线索：宗教色彩、假日名称、当地语言名称、首都首字母。名称里的国名、首都名已经涂掉。',
      '每次猜测会显示你猜的国家首都离答案多远、在哪个方向，以及你猜的国家有多少比例的假日和答案落在同一天。',
      '提示：复活节前后的连休说明是基督教国家；日期每年漂移的假日多半跟着阴历或伊斯兰历。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分（83、67、50、33、17），6 次都没猜中 0 分。',
    sources: [
      { name: 'Nager.Date Public Holiday API（2026 年，仅法定假日 Public 类）', url: 'https://date.nager.at/Api' },
      { name: 'GeoNames（首都坐标与名称）', url: 'https://download.geonames.org/export/dump/' },
    ],
    dataNote: '快照数据：Nager.Date 虽然允许浏览器直接访问，但一年的假日表不会变，所以构建时抓一次存成 data.json。只收录法定假日，不含银行假日、学校假日和纪念日。每日答案只从 155 个主权国家/地区中抽取，海外属地（如阿鲁巴、关岛）只作为可猜选项。',
  },

  puzzle({ data, pick }) {
    const country = pick(data.countries.filter((c) => c.play));
    return { year: data.year, cc: country.cc };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byCC = new Map(ctx.data.countries.map((c) => [c.cc, c]));
    const ans = byCC.get(p.cc);
    const H = ans.holidays;
    const hide = (t) => redact(t, ans.terms);
    const narrow = (globalThis.innerWidth ?? 1000) < 560;

    // clue 1 — the calendar
    const cells = [];
    for (let m = 1; m <= 12; m++) {
      const days = new Date(Date.UTC(p.year, m, 0)).getUTCDate();
      for (let d = 1; d <= days; d++) {
        const md = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hol = H.find((x) => x.d === md);
        cells.push({ m, d, md, kind: hol ? (hol.global ? '全国假日' : '地区假日') : WEEKEND(p.year, md) ? '周末' : '平日' });
      }
    }
    const WEEKEND_FILL = 'color-mix(in srgb, var(--muted) 40%, transparent)';
    const calendar = await ui.plot((Plot, c) => ({
      height: narrow ? 220 : 300,
      marginLeft: 36,
      padding: 0.12,
      x: { label: null, ticks: [1, 5, 10, 15, 20, 25, 31], tickSize: 0 },
      y: { label: null, tickFormat: (m) => `${m}月`, tickSize: 0 },
      color: { domain: ['全国假日', '地区假日', '周末', '平日'], range: [c.accent, c.near, WEEKEND_FILL, c.paper2] },
      marks: [
        Plot.cell(cells, { x: 'd', y: 'm', fill: 'kind', rx: 2, title: (x) => `${x.md} · ${x.kind}` }),
      ],
    }));

    const regional = H.filter((x) => !x.global).length;
    const onWeekend = H.filter((x) => WEEKEND(p.year, x.d)).length;
    const faith = faithCounts(H);
    const rare = rarest(H, 3);
    const localOnly = rarest(H.filter((x) => strip(x.local) !== strip(x.name)), 1)[0]; // a local name worth showing
    const mid = rarest(H.filter((x) => x.common >= 3 && x.common <= 40), 3);
    const list = (xs, key = 'name') => ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } },
      xs.map((x) => ui.h('li', ui.h('span', { class: 'mono small muted' }, `${x.d}  `), hide(x[key]))));
    const swatch = (color, label) => ui.h('span', ui.h('span', { style: { color } }, '■'), ` ${label}`);

    const clues = [
      ui.h('div', calendar, ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px', flexWrap: 'wrap' } },
        swatch('var(--accent)', '全国假日'), swatch('var(--near)', '地区假日'), swatch(WEEKEND_FILL, '周六日'))),
      `今年共 ${H.length} 个假日，其中 ${regional} 个只在部分地区放假，${onWeekend} 个落在周六日。`,
      faith.length
        ? `宗教色彩：${faith.map((f) => `${f.label}节日 ${f.n} 个`).join('，')}。`
        : '宗教色彩：名单里没有明显的基督教、伊斯兰教、佛教或印度教节日。',
      mid.length ? ui.h('div', '一些常见的节日（别的国家也有；国名、首都名已涂掉）：', list(mid)) : '这个国家没有“中等常见”的节日，别的线索更有用。',
      ui.h('div', '最独特的三个假日（英文名，国名、首都名已涂掉）：', list(rare),
        localOnly && ui.h('div', { style: { marginTop: '8px' } }, `其中 ${localOnly.d} 这天的当地语言名称：`, list([localOnly], 'local'))),
      `首都的英文名以 “${ans.capital.name[0]}” 开头。`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.cc, label: zh(c.cc), hint: c.name, aliases: [c.name, c.cc] }));
    const res = await ctx.guess({
      options,
      answer: ans.cc,
      maxGuesses: 6,
      title: '这是哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues,
      cluesTitle: '日历和线索',
      columns: ['首都距离', '方向', '同日假日'],
      scoring: scoreFor,
      near: (g, a) => haversineKm(byCC.get(g.id).capital, byCC.get(a.id).capital) < 1000,
      feedback: (g) => {
        const gc = byCC.get(g.id);
        if (gc.cc === ans.cc) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: `${H.length}/${H.length}`, state: 'hit', num: true }];
        const km = haversineKm(gc.capital, ans.capital);
        const shared = sharedDays(gc, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 1000 ? 'near' : undefined },
          { text: arrow(bearingDeg(gc.capital, ans.capital)) },
          { text: `${shared}/${H.length}`, num: true, state: shared >= H.length * 0.6 ? 'near' : undefined },
        ];
      },
    });

    // the "why" — specific to this country
    const twins = ctx.data.countries.filter((c) => c.cc !== ans.cc)
      .map((c) => ({ c, n: sharedDays(c, ans) })).sort((a, b) => b.n - a.n).slice(0, 3);
    const why = [];
    const top = rare[0];
    why.push(`最有辨识度的假日是 ${top.d} 的 “${top.name}”${strip(top.local) !== strip(top.name) ? `（当地叫 “${top.local}”）` : ''}，2026 年名单里只有 ${top.common} 个国家有同名假日。`);
    if (faith.length) why.push(`宗教色彩：${faith.map((f) => `${f.label} ${f.n} 个`).join('、')}，这些假日的日期跟着宗教历法，是判断文化圈的好线索。`);
    else why.push('名单里没有明显的宗教节日，说明是以国庆、劳动节这类世俗假日为主。');
    why.push(`日历最像的国家：${twins.map((t) => `${zh(t.c.cc)}（${t.n} 天相同）`).join('、')}，同一个文化圈、殖民史或宗教的国家常常共享假日。`);
    if (regional) why.push(`其中 ${regional} 个假日只在部分地区放假，说明这个国家实行联邦或地方自治。`);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${zh(ans.cc)}（${ans.name}），首都 ${ans.capital.name}。${p.year} 年共 ${H.length} 个法定假日。`),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, why.map((t) => ui.h('li', t))),
      ui.table({
        columns: [{ key: 'd', label: '日期' }, { key: 'name', label: '名称' }, { key: 'local', label: '当地名称' }],
        rows: H,
      }));
    return res;
  },
};

function sharedDays(a, b) {
  const set = new Set(b.holidays.map((x) => x.d));
  return a.holidays.filter((x) => set.has(x.d)).length;
}
