// raw (build/raw/*.json from fetch.mjs) → ../data.json.  Run from build/: node build.mjs
import { SEEDS, KINDS, LAND } from './seeds.mjs';
import fs from 'node:fs';
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_');
let s = 20261015; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuf = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Characters that only exist in Traditional Chinese: such labels are Wikidata zh-hans fallbacks, drop them.
const TRAD = /[這們個與為說對時國會來傳點開關麼裡愛書電影學後從無發經過風龍師東華島區樂歲鐵羅馬頭寶號亞當標長門陸難飛應獨讀變體戰場黃紅隊雙譯覺齊魯約翰蘭爾亂幾彎禮劍專業鳥魚鷹壞買賣車軍運達還進選邊錄問間聯殺剛優將惡憶懷擊斷歐戲數樣機歷歡燈營環畫異監種稱納細織繼聖練義處觀親誰論護豐豬貓貝負貴費賽趙跡轉輕遊適鄉醫錢鎮陰險隱雜靈願顯颱驚驗體黨龜鏡婦屬編峯寮檔獸兒屆強決況凍則劇卻創單團圖圍壓夢幣廣庫廳張彈態憂懶擇擴擬擾攝敵晝朧檢殘毀氣漢湯滿漸潔濟瀏燒爺牠猶獎現產畢當療盜盡確積穩競節範籃紀約級純紙紐線組絕統綠維綜網緊總繪續罵羅聽職膽臺舊艙莊萊蘇蟲補裝見規視覽訊討訓訪設許評詞話該詳誌認誤課調談請諸諾謀謝識讓豈財貢貧買貿資賓賞賢賴贈趕踐軌輔輪辦農違遺郵鄭釋針鈴鉅銀銅銘錯鍊鎖鑑閉閒閣閱闆闢陣陳陽階際隨離雲霧靜響頁頂項順須預領題額顏類顧餘館饒駐騎驅鬥鶴麗點齒]/;
const groups = [];
const dropLog = [];
for (const [kind, en, zh] of SEEDS) {
  const f = `raw/${kind}_${slug(en)}.json`;
  if (!fs.existsSync(f)) { dropLog.push(`${en}: no raw`); continue; }
  const raw = JSON.parse(fs.readFileSync(f));
  const K = KINDS[kind];
  const seen = new Map();
  for (const b of raw.items) {
    const id = b.item.value.split('/').pop();
    let label = b.zh.value.trim();
    const e = b.en?.value ?? '';
    const y = b.y ? +b.y.value : null;
    const prev = seen.get(id);
    if (prev) { if (y && (!prev.y || y < prev.y)) prev.y = y; continue; }
    seen.set(id, { id, label, en: e, y, sl: +b.sl.value });
  }
  const members = [];
  for (const m of seen.values()) {
    if (m.label === '中华人民共和国') m.label = '中国';
    if (/^Q\d+$/.test(m.label) || m.label.length < 2 || m.label.length > 18) continue;
    if (!/[一-鿿]/.test(m.label)) continue; // latin-only titles would stand out from the Chinese ones
    if (TRAD.test(m.label) || /[(（]/.test(m.label)) continue;
    if (kind === 'border' && !LAND[en].includes(m.en)) continue;
    if (kind !== 'border' && m.sl < 8) continue;
    if (m.label.length <= 5 && m.label.includes('·')) continue; // "诱·惑" style titles read as typos
    if (kind === 'music' && /巡回|演唱会|合集|精选/.test(m.label)) continue;
    if (m.label.includes(zh) || (m.en && m.en.toLowerCase().includes(en.toLowerCase().split(' ').pop()) && kind !== 'border')) continue;
    members.push(m);
  }
  members.sort((a, b) => b.sl - a.sl);
  if (members.length < 9) { dropLog.push(`${en}: only ${members.length} usable`); continue; }
  groups.push({ key: raw.qid, kind, prop: K.prop, en, zh, label: K.tpl.replace('{}', zh), unit: K.unit, members });
}
console.log('groups', groups.length, groups.map((g) => g.zh + g.members.length).join(' '));
console.log('dropped:', dropLog.join('; '));

const POOL = 11; // each group draws from its 11 best-known members
for (const g of groups) { g.pool = g.members.slice(0, POOL); g.ids = new Set(g.members.map((m) => m.id)); g.labs = new Set(g.members.map((m) => m.label)); }
const usable = groups.filter((g) => g.pool.length >= 8);
console.log('usable groups', usable.length, usable.map((g) => `${g.zh}:${g.pool.length}`).join(' '));

const puzzles = []; const seenKey = new Set(); const use = new Map(usable.map((g) => [g.key, 0]));
for (let tries = 0; tries < 200000 && puzzles.length < 120; tries++) {
  // prefer under-used groups so the whole pool is exercised evenly
  const ordered = shuf(usable).sort((a, b) => use.get(a.key) - use.get(b.key) + (rnd() - 0.5) * 3);
  const gs = ordered.slice(0, 4);
  const units = gs.map((g) => g.unit);
  const maxSame = Math.max(...units.map((u) => units.filter((x) => x === u).length));
  if (new Set(units).size < 2 || maxSame > 3 || (maxSame === 3 && rnd() < 0.7) || units.filter((u) => u === '国家').length > 2) continue;
  if (new Set(gs.map((g) => g.zh)).size < 4) continue;
  const key = gs.map((g) => g.key).sort().join();
  if (seenKey.has(key)) continue;
  const chosen = gs.map((g) => shuf(g.pool).slice(0, 4));
  // ambiguity: a pick may not appear (by Wikidata id or by label) anywhere in another chosen group's full fetched list
  if (gs.some((g, i) => chosen.some((c, j) => i !== j && c.some((x) => g.ids.has(x.id) || g.labs.has(x.label))))) continue;
  const labs = chosen.flat().map((x) => x.label);
  if (new Set(labs).size !== 16) continue;
  // an item may not mention any group's subject name, and no member may sit in another chosen group's fetched list
  const names = gs.flatMap((g) => g.zh.split(/[·\s]/).filter((p) => p.length >= 2));
  if (labs.some((l) => names.some((n) => l.includes(n)))) continue;
  seenKey.add(key); gs.forEach((g) => use.set(g.key, use.get(g.key) + 1));
  puzzles.push({ groups: gs.map((g, i) => ({ label: g.label, n: g.zh, qid: g.key, kind: g.kind, prop: g.prop, unit: g.unit, items: chosen[i].map((x) => ({ l: x.label, q: x.id, ...(x.y ? { y: x.y } : {}) })) })) });
}
console.log('puzzles', puzzles.length, 'group use min/max', Math.min(...use.values()), Math.max(...use.values()));
fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), puzzles }));
