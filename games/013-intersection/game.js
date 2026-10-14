// #13 Intersection — five street names meeting at one OSM junction; guess the city.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Writing systems (and tell-tale diacritics) present in a list of street names. */
export function scriptsOf(names) {
  const text = names.join('');
  const tests = [
    ['汉字', /[一-鿿]/], ['日文假名', /[぀-ヿ]/], ['韩文', /[가-힯]/], ['西里尔字母', /[Ѐ-ӿ]/],
    ['阿拉伯字母', /[؀-ۿ]/], ['希腊字母', /[Ͱ-Ͽ]/], ['希伯来字母', /[֐-׿]/], ['泰文', /[฀-๿]/],
    ['天城文', /[ऀ-ॿ]/], ['孟加拉文', /[ঀ-৿]/], ['格鲁吉亚字母', /[Ⴀ-ჿ]/],
  ];
  const found = tests.filter(([, re]) => re.test(text)).map(([n]) => n);
  if (/[A-Za-z]/.test(text)) {
    const marks = [...new Set(text.normalize('NFC').match(/[^\u0000-\u007f]/g) || [])].filter((c) => /\p{L}/u.test(c) && /[À-ɏ]/.test(c));
    found.unshift(marks.length ? `拉丁字母（含 ${marks.slice(0, 6).join(' ')}）` : '拉丁字母（无变音符号）');
  }
  return found;
}

/** Hide the city's own name inside a street name. */
export function redactCity(name, city) {
  const stems = [city.city, city.zh].filter((w) => w && w.length > 2).map((w) => (/^[\x00-\x7f]+$/.test(w) ? w.slice(0, Math.max(4, w.length - 2)) : w));
  let out = name;
  for (const s of stems) out = out.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi'), '▇▇▇');
  return out;
}

/** The most common last/first word shared by 2+ street names (e.g. "Rue", "Street"). */
export function commonWord(names) {
  const cnt = new Map();
  for (const n of names) for (const w of new Set(n.split(/[\s,.-]+/).filter((x) => x.length >= 2))) cnt.set(w, (cnt.get(w) || 0) + 1);
  const best = [...cnt.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])[0];
  return best ? { word: best[0], count: best[1] } : null;
}

export default {
  meta: {
    num: 13,
    slug: 'intersection',
    title: 'Intersection',
    tagline: '几条街道在同一个路口交汇。只凭街道名，猜这是世界上哪座城市。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '给你 OpenStreetMap 上某个真实路口交汇的街道名（3 到 6 条）。',
      '从列表里选一座城市来猜，最多 6 次。每猜错一次，多解锁一条线索：文字系统、大洲、国家……',
      '每次猜测会告诉你那座城市离答案多远、在哪个方向。',
      '提示：Rue、Straße、Calle、通り、路……命名习惯、变音符号、纪念人物的名字，都是线索。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'OpenStreetMap（Overpass API）', url: 'https://overpass-api.de/', note: '© OpenStreetMap contributors, ODbL。每座城市取市中心 1.1 km 半径内、同一节点上交汇街道名最多的路口。' },
    ],
    dataNote: '城市中心坐标为手工选取的近似值；路口为该城市中心 1.1 km 范围内同名街道种类最多的节点，不一定是最著名的路口。',
  },

  puzzle({ data, pick }) {
    const c = pick(data.puzzles);
    return { city: c.city };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const all = ctx.data.puzzles;
    const byId = new Map(all.map((c) => [c.city, c]));
    const ans = byId.get(p.city);
    const names = ans.streets.map((s) => s.n);
    ctx.log('intersection', ans.city, names);
    const scripts = scriptsOf(names);
    const cw = commonWord(names);

    const streetList = ui.h('div', { class: 'ds-stack', style: { gap: '8px' } },
      ans.streets.map((s, i) => ui.h('div', { class: 'ds-row', style: { gap: '10px', alignItems: 'baseline' } },
        ui.h('span', { class: 'mono muted small' }, String(i + 1)),
        ui.h('span', { style: { fontSize: '1.1rem', fontWeight: 600 } }, redactCity(s.n, ans)))));
    ctx.stage.append(ui.panel({ kicker: '同一个路口 · 来自 OpenStreetMap', title: `${ans.streets.length} 条街道在这里交汇` }, streetList));

    const clues = [
      `一共 ${ans.streets.length} 条街道，名字原样取自当地地图（城市名已涂掉）。`,
      `文字系统：${scripts.join('、') || '未知'}。${cw ? `其中 ${cw.count} 条街名都带 “${cw.word}”。` : ''}`,
      `这座城市在 ${ans.continent}。`,
      `这座城市在 ${ans.country}。`,
      `城市英文名以 “${ans.city[0]}” 开头，共 ${ans.city.length} 个字母。`,
    ];
    const options = all.map((c) => ({ id: c.city, label: c.zh, hint: `${c.city} · ${c.country}`, aliases: [c.city, c.country, c.cc] }));
    const res = await ctx.guess({
      options, answer: ans.city, maxGuesses: 6, title: '这是哪座城市？', placeholder: '输入城市名（中文或英文）…',
      clues, cluesTitle: '线索', columns: ['距离', '方向'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1000,
      feedback: (g) => {
        const gc = byId.get(g.id);
        if (gc.city === ans.city) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        const km = haversineKm(gc, ans);
        return [{ text: fmtKm(km), num: true, state: km < 1000 ? 'near' : undefined }, { text: arrow(bearingDeg(gc, ans)) }];
      },
    });
    ctx.log('result', res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${ans.zh}（${ans.city}），${ans.country}`],
        ['路口坐标', `${ans.junction[0]}, ${ans.junction[1]}`],
        ['地图', ui.h('a', { href: `https://www.openstreetmap.org/?mlat=${ans.junction[0]}&mlon=${ans.junction[1]}#map=18/${ans.junction[0]}/${ans.junction[1]}`, target: '_blank', rel: 'noopener' }, '在 OpenStreetMap 上查看')],
        ['线索', `文字：${scripts.join('、')}${cw ? `；共同用词 “${cw.word}”` : ''}`],
      ]),
      ui.table({ columns: [{ key: 'n', label: '街道名（原文）' }, { key: 'en', label: '英文名（OSM name:en）' }], rows: ans.streets.map((s) => ({ n: s.n, en: s.en || '—' })) }));
    return res;
  },
};
