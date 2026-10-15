// raw etymonline dump + curated word list (words.json) -> ../data.json
// Year = the leading date of the etymonline entry ("1562" exact, "1560s" decade -> midpoint 1565).
import fs from 'node:fs';
const here = new URL('./', import.meta.url).pathname;
const dump = JSON.parse(fs.readFileSync(here + 'raw/etymonline-index.json'));
const list = JSON.parse(fs.readFileSync(here + 'words.json'));

const LANGS = [
  ['Low German', '低地德语'], ['Middle French', '法语'], ['Old French', '法语'], ['French', '法语'], ['Spanish', '西班牙语'], ['Portuguese', '葡萄牙语'],
  ['Italian', '意大利语'], ['Dutch', '荷兰语'], ['German', '德语'], ['Greek', '希腊语'], ['Latin', '拉丁语'], ['Arabic', '阿拉伯语'],
  ['Hindi', '印地语'], ['Sanskrit', '梵语'], ['Japanese', '日语'], ['Turkish', '土耳其语'], ['Nahuatl', '纳瓦特尔语'], ['Carib', '加勒比语'],
  ['Arawakan', '阿拉瓦克语'], ['Norwegian', '挪威语'], ['Malay', '马来语'], ['Persian', '波斯语'], ['Hebrew', '希伯来语'], ['Icelandic', '冰岛语'], ['Old Norse', '古诺尔斯语'], ['Norse', '古诺尔斯语'],
];
// manual fixes where the first language named in the entry is not the donor language
const OVERRIDE = { karma: '梵语', jungle: '印地语', zombie: '西非语言', tariff: '意大利语（源自阿拉伯语）', shark: '来源不明', ecology: '希腊语词根', photograph: '希腊语词根', bicycle: '希腊语词根', algorithm: '法语（源自阿拉伯语人名）', sandwich: '人名（桑威奇伯爵）', coconut: '葡萄牙语词根', vitamin: '拉丁语词根', cocaine: '西班牙语词根（coca）', picnic: '法语', critique: '法语', saga: '古诺尔斯语', asbestos: '希腊语', surf: '来源不明', dude: '来源不明', bankruptcy: '意大利语（banca rotta）', stationery: '英语内部造词（station 的派生）' };
const fmt = (s) => s.replace(/\s+/g, ' ').trim();
const out = [];
const miss = [];
for (const [w, zh, pos] of list) {
  const cands = dump.filter((e) => e.word === w && e.etymology && /^(1[5-9]\d\d|20[01]\d)s?\b/.test(e.etymology) && (!pos || e.pos === pos));
  if (!cands.length) { miss.push(w); continue; }
  const e = cands[0];
  const m = e.etymology.match(/^(\d{4})(s?)\b/);
  const decade = m[2] === 's';
  const y = decade ? +m[1] + 5 : +m[1];
  const body = fmt(e.etymology.replace(/\[[^\]]*\]/g, ''));
  // origin language: first language named right after the leading "from"/"borrowed from"
  const head = body.slice(m[0].length, m[0].length + 90);
  let o = '';
  if (/^[,;]?\s*(?:American English,?\s*)?(?:from|borrowed|via)\b/.test(head) || /\bfrom\b/.test(head)) {
    let best = null;
    for (const [en, cn] of LANGS) { const i = head.search(new RegExp(`\\b${en}\\b`)); if (i >= 0 && (!best || i < best.i)) best = { i, cn }; }
    if (best) o = best.cn;
  }
  if (!o) o = '英语内部造词';
  if (OVERRIDE[w]) o = OVERRIDE[w];
  let ex = body;
  if (ex.length > 230) { const cut = ex.slice(0, 230); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; ')); ex = (i > 80 ? cut.slice(0, i) : cut.replace(/\s\S*$/, '')) + (i > 80 && cut[i] === '.' ? '.' : '…');
    ex = ex.replace(/\s*\((?:see|cf\.|compare)?[^)]*$/i, '…').replace(/…{2,}/g, '…'); }
  out.push({ w, zh, p: e.pos || '', y, d: decade ? 1 : 0, o, ex });
}
if (miss.length) { console.error('MISSING', miss); process.exit(1); }
out.sort((a, b) => a.y - b.y || a.w.localeCompare(b.w));
fs.writeFileSync(here + '../data.json', JSON.stringify({ source: 'etymonline.com via github.com/yosevu/etymonline', words: out }));
const by = {};
out.forEach((x) => { const k = Math.floor(x.y / 50) * 50; by[k] = (by[k] || 0) + 1; });
console.log(out.length, by);
console.log(out.map((x) => `${x.w}:${x.o}`).join(' '));
