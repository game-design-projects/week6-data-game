// #13 Intersection — several street names meeting at one OSM junction; guess the city.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Writing systems (and tell-tale diacritics) present in a list of street names. */
export function scriptsOf(names) {
  const text = names.join('');
  const tests = [
    ['汉字', /[一-鿿]/], ['日文假名', /[぀-ヿ]/], ['韩文', /[가-힯]/], ['西里尔字母', /[Ѐ-ӿ]/],
    ['阿拉伯字母', /[؀-ۿ]/], ['希腊字母', /[Ͱ-Ͽ]/], ['希伯来字母', /[֐-׿]/], ['泰文', /[฀-๿]/],
    ['天城文', /[ऀ-ॿ]/], ['孟加拉文', /[ঀ-৿]/], ['格鲁吉亚字母', /[Ⴀ-ჿ]/], ['亚美尼亚字母', /[԰-֏]/],
    ['僧伽罗文', /[඀-෿]/], ['缅甸文', /[က-႟]/], ['高棉文', /[ក-៿]/], ['蒙古文', /[᠀-᢯]/],
  ];
  const found = tests.filter(([, re]) => re.test(text)).map(([n]) => n);
  if (/[A-Za-z]/.test(text)) {
    const marks = [...new Set(text.normalize('NFC').match(/[^\u0000-\u007f]/g) || [])].filter((c) => /\p{L}/u.test(c) && /[À-ɏ]/.test(c));
    found.unshift(marks.length ? `拉丁字母（含 ${marks.slice(0, 6).join(' ')}）` : '拉丁字母（无变音符号）');
  }
  return found;
}

/** The most common word shared by 2+ street names (e.g. "Rue", "Street"). */
export function commonWord(names) {
  const cnt = new Map();
  for (const n of names) for (const w of new Set(n.split(/[\s,.\-–]+/).filter((x) => x.length >= 2))) cnt.set(w, (cnt.get(w) || 0) + 1);
  const best = [...cnt.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  return best ? { word: best[0], count: best[1] } : null;
}

/** Naming conventions that point to a language family / region. [regex, 说明] */
export const PATTERNS = [
  [/\b(Rue|Quai|Impasse|Chemin|Allée)\b/i, '“Rue / Quai / Impasse” 是法语街名'],
  [/(straße|strasse|str\.|\bgasse\b|platz\b|\bweg\b|\bufer\b|damm\b)/i, '“-straße / -gasse / -platz” 是德语街名'],
  [/\b(Calle|Avenida|Paseo|Plaza|Carrer|Plaça|Ronda|Travesía|Jirón|Carrera|Transversal|Calzada)\b/i, '“Calle / Carrer / Avenida” 是西语（或加泰罗尼亚语）街名'],
  [/\b(Rua|Praça|Travessa|Largo|Calçada)\b|\bAvenida\b.*[ãçõ]/i, '“Rua / Praça / Calçada” 是葡语街名'],
  [/\b(Via|Viale|Piazza|Corso|Vicolo)\b/i, '“Via / Corso / Piazza” 是意大利语街名'],
  [/\b(Strada|Bulevardul|Calea|Șoseaua)\b/i, '“Strada / Bulevardul” 是罗马尼亚语街名'],
  [/(gatan|gata\b|gate\b|gade\b|vägen|vej\b|veien|torg\b)/i, '“-gatan / -gata / -gade” 是北欧语言街名'],
  [/(katu\b|tie\b|kuja\b)/i, '“-katu / -tie” 是芬兰语街名'],
  [/(straat|laan\b|plein\b|gracht\b|kade\b)/i, '“-straat / -plein / -gracht” 是荷兰语街名'],
  [/\b(utca|tér|körút|lépcső)\b/i, '“utca / tér” 是匈牙利语街名'],
  [/(ulica|ul\.|aleja|plac\b|aleje)/i, '“ulica / aleja / plac” 是波兰语街名'],
  [/\b(ulice|náměstí|nábřeží|třída)\b|^U\s/i, '“ulice / náměstí” 是捷克语街名'],
  [/\b(улица|площадь|проспект|переулок|бульвар|вулиця|площа)\b/i, '“улица / площадь / вулиця” 是俄语或乌克兰语街名'],
  [/(sokağı|sokak|caddesi|cad\.)/i, '“Sokağı / Caddesi” 是土耳其语街名'],
  [/\b(Jalan|Lorong|Lebuh)\b/i, '“Jalan” 是马来语 / 印尼语的“路”'],
  [/\b(Phố|Đường|Ngõ)\b/i, '“Phố / Đường” 是越南语的“街 / 路”'],
  [/^ถนน|ซอย/, '“ถนน / ซอย” 是泰语的“路 / 巷”'],
  [/(通り|道路|国道|駅前)/, '“通り / 国道” 是日语街名'],
  [/[가-힣]+(로|길)\b/, '“-로 / -길” 是韩国的道路命名制度'],
  [/(胡同|大街|路|街|巷)/, '“路 / 街 / 巷 / 胡同” 是中文街名'],
  [/(شارع|طريق)/, '“شارع” 是阿拉伯语的“街”'],
  [/(ქუჩა|გამზირი)/, '“ქუჩა” 是格鲁吉亚语的“街”'],
  [/(רחוב|שדרות)/, '“שדרות / רחוב” 是希伯来语的“大道 / 街”'],
  [/\b\d+(st|nd|rd|th)\b.*\b(Street|Avenue)\b|\b(North|South|East|West)\w*\b.*\b(Street|Avenue)\b/i, '数字街 + 方位词（North / West…）是北美网格城市的命名习惯'],
  [/\b(Street|Road|Lane|Crescent|Terrace|Close|Parade|Place|Way)\b/i, '“Street / Road / Crescent / Close” 是英语街名（英国、爱尔兰、澳新、南非、东非等英联邦国家常见）'],
];

/** Which naming conventions show up in these names (specific to this puzzle). */
export function patternsIn(names) {
  const out = [];
  for (const [re, text] of PATTERNS) {
    const hit = names.filter((n) => re.test(n));
    if (hit.length) out.push({ text, hit });
  }
  return out.slice(0, 3);
}

/** 100 → 17 over six guesses, 0 when not found. */
export const scoreFor = (n, won, max = 6) => (won ? Math.round((100 * (max - n + 1)) / max) : 0);

export default {
  meta: {
    num: 13,
    slug: 'intersection',
    title: 'Intersection',
    tagline: '几条街道在同一个路口交汇。只凭街道名，猜这是世界上哪座城市。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '给你 OpenStreetMap 上某个真实路口交汇的街道名（3 到 6 条，能凑 5 条以上的路口优先）。',
      '从列表里选一座城市来猜，最多 6 次。每猜错一次，多解锁一条线索：文字系统、大洲、国家、首字母……',
      '每次猜测会告诉你那座城市离答案多远、在哪个方向——用它缩小范围。',
      '提示：Rue、Straße、Calle、通り、路……命名习惯、变音符号、纪念人物的名字，都是线索。',
      '计分：第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'OpenStreetMap（Overpass API）', url: 'https://overpass-api.de/', note: '© OpenStreetMap contributors, ODbL。取每座城市中心 3 km 半径内的已命名道路。' },
    ],
    dataNote: '数据为 OpenStreetMap 的快照，不是实时数据：当天的谜题由日期决定，跟地图是否更新无关。城市中心坐标为手工选取的近似值；路口是中心 3 km 范围内同时交汇街道名最多的节点（尽量 5 条以上，部分城市只有 3–4 条），并排除街名里直接写出城市名或国家名的路口，因此不一定是最著名的路口。不含步行道、小径和停车场道路。街名为 OSM 当地原文，不翻译。',
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
        ui.h('span', { style: { fontSize: '1.1rem', fontWeight: 600, overflowWrap: 'anywhere' } }, s.n))));
    ctx.stage.append(ui.panel({ kicker: '同一个路口 · 来自 OpenStreetMap', title: `${ans.streets.length} 条街道在这里交汇` }, streetList));

    const clues = [
      `一共 ${ans.streets.length} 条街道，名字原样取自当地地图。`,
      `文字系统：${scripts.join('、') || '未知'}。${cw ? `其中 ${cw.count} 条街名都带 “${cw.word}”。` : ''}`,
      `这座城市在 ${ans.continent}。`,
      `这座城市在 ${ans.country}。`,
      `城市英文名以 “${ans.city[0]}” 开头，共 ${ans.city.length} 个字母。`,
    ];
    const options = all.map((c) => ({ id: c.city, label: c.zh, hint: `${c.city} · ${c.country}`, aliases: [c.city, c.country, c.cc] }));
    const res = await ctx.guess({
      options, answer: ans.city, maxGuesses: 6, title: '这是哪座城市？', placeholder: '输入城市名（中文或英文）…',
      clues, cluesTitle: '线索', columns: ['距离', '方向'],
      scoring: (n, won) => scoreFor(n, won),
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1000,
      feedback: (g) => {
        const gc = byId.get(g.id);
        if (gc.city === ans.city) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        const km = haversineKm(gc, ans);
        return [{ text: fmtKm(km), num: true, state: km < 1000 ? 'near' : undefined }, { text: arrow(bearingDeg(gc, ans)) }];
      },
    });
    ctx.log('result', res.score);

    const pats = patternsIn(names);
    const why = ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, [
      ui.h('li', null, `文字系统：${scripts.join('、')}${cw ? `；${cw.count} 条街名共用 “${cw.word}”` : ''}。`),
      ...pats.map((x) => ui.h('li', null, `${x.text}：${x.hit.slice(0, 3).join('、')}`)),
      ui.h('li', null, `这个路口在 ${ans.city} 市中心约 ${fmtKm(haversineKm({ lat: ans.junction[0], lng: ans.junction[1] }, ans))} 外，共 ${ans.streets.length} 条街道交汇。`),
    ]);
    let mapEl = null;
    try {
      const m = await ui.createMap({ center: ans.junction, zoom: 16, labels: true, height: 240 });
      m.pin(ans.junction, 'answer', ans.city);
      mapEl = m.el;
    } catch (e) { ctx.log.warn('map failed', String(e)); }
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${ans.zh}（${ans.city}），${ans.country}`],
        ['路口坐标', `${ans.junction[0]}, ${ans.junction[1]}`],
        ['地图', ui.h('a', { href: `https://www.openstreetmap.org/?mlat=${ans.junction[0]}&mlon=${ans.junction[1]}#map=18/${ans.junction[0]}/${ans.junction[1]}`, target: '_blank', rel: 'noopener' }, '在 OpenStreetMap 上查看')],
        ['线索在哪', why],
      ]),
      mapEl,
      ui.table({ columns: [{ key: 'n', label: '街道名（原文）' }, { key: 'en', label: '英文名（OSM name:en）' }], rows: ans.streets.map((s) => ({ n: s.n, en: s.en || '—' })) }));
    return res;
  },
};
