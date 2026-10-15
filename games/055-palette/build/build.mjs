// raw/artworks.json + raw/img/*.jpg -> ../data.json : 5 dominant colours per painting via k-means (ffmpeg decodes pixels).
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const raw = path.join(import.meta.dirname, 'raw');
const all = JSON.parse(fs.readFileSync(path.join(raw, 'artworks.json')));
// id -> [zh, id, cap, from, to, note]. from/to = the period the label is normally used for (the AIC label is
// only kept when the painting's year lies inside it +-10 years, which removes mislabelled outliers).
const STYLES = {
  Impressionism: ['印象派', 'Impressionism', 30, 1860, 1915, '1870–1890 年代的巴黎画派，户外写生、短促笔触，色彩明亮、阴影里也带蓝紫。'],
  'Post-Impressionism': ['后印象派', 'Post-Impressionism', 22, 1880, 1915, '继印象派之后，用更纯、更饱和的颜色表达结构与情绪（梵高、高更、塞尚、修拉）。'],
  Realism: ['现实主义', 'Realism', 20, 1840, 1910, '19 世纪中叶起如实描绘日常生活，色调多为沉稳的土色与灰调。'],
  Renaissance: ['文艺复兴', 'Renaissance', 16, 1400, 1620, '14–16 世纪的欧洲：蛋彩与早期油画，常见金色背景、深红、群青与暗褐。'],
  Modernism: ['现代主义', 'Modernism', 18, 1890, 1960, '20 世纪初起打破写实传统，常有大面积平涂的纯色或抽象色块。'],
  Neoclassicism: ['新古典主义', 'Neoclassicism', 6, 1760, 1830, '18 世纪末的复古风格，画面冷静克制，肤色与灰蓝、土色为主。'],
  Baroque: ['巴洛克', 'Baroque', 8, 1600, 1750, '17 世纪的强烈明暗对比：深色背景里浮出温暖的高光。'],
  'Barbizon School': ['巴比松派', 'Barbizon School', 5, 1830, 1880, '19 世纪中叶法国森林写生，以绿、褐、灰为主的田园色调。'],
  Mannerism: ['样式主义', 'Mannerism', 4, 1520, 1610, '16 世纪后期的矫饰风格，人物拉长，色彩偏冷艳、对比强。'],
  'Japanese (culture or style)': ['日本传统', 'Japanese', 14, 1300, 1960, '日本绘画与浮世绘：大面积留白或平涂，色彩来自矿物与植物颜料。'],
  'Chinese (culture or style)': ['中国传统', 'Chinese', 8, 1300, 1960, '中国绢本、纸本绘画：墨色与淡彩，整体偏暖黄、偏灰。'],
  'Folk Art': ['民间艺术', 'Folk Art', 8, 1750, 1900, '美国民间绘画：自学成才的画家，平涂的明快颜色与朴素构图。'],
};
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
function pixels(file) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=48:48:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1e7 });
  const px = []; for (let i = 0; i + 2 < buf.length; i += 3) px.push([buf[i], buf[i + 1], buf[i + 2]]); return px;
}
function kmeans(px, k = 5) {
  const mean = px.reduce((s, p) => s.map((v, i) => v + p[i] / px.length), [0, 0, 0]);
  let cs = [px.reduce((b, p) => (d2(p, mean) < d2(b, mean) ? p : b))];
  while (cs.length < k) cs.push(px.reduce((b, p) => (Math.min(...cs.map((c) => d2(p, c))) > Math.min(...cs.map((c) => d2(b, c))) ? p : b)));
  let asg = [];
  for (let it = 0; it < 15; it++) {
    asg = px.map((p) => cs.reduce((bi, c, i) => (d2(p, c) < d2(p, cs[bi]) ? i : bi), 0));
    cs = cs.map((c, i) => { const m = px.filter((_, j) => asg[j] === i); return m.length ? m[0].map((_, ch) => m.reduce((s, p) => s + p[ch], 0) / m.length) : c; });
  }
  return cs.map((c, i) => ({ c, n: asg.filter((a) => a === i).length / px.length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
}
function thumb(file) { // 160px-wide q-scaled JPEG as data URI (AIC's IIIF server blocks browser hotlinking)
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=160:-2', '-q:v', '8', '-f', 'mjpeg', '-'], { maxBuffer: 1e7 });
  return 'data:image/jpeg;base64,' + b.toString('base64');
}
const used = {}; const out = [];
for (const a of all) {
  const s = STYLES[a.style_title]; if (!s) continue;
  if (a.date_end - a.date_start > 12) continue;
  const year = Math.round((a.date_start + a.date_end) / 2);
  if (year < s[3] - 10 || year > s[4] + 10) continue;
  if ((used[a.style_title] = (used[a.style_title] || 0) + 1) > s[2]) continue;
  const f = path.join(raw, 'img', a.id + '.jpg'); if (!fs.existsSync(f)) continue;
  let cl, th; try { cl = kmeans(pixels(f)); th = thumb(f); } catch { console.log('bad image', a.id); continue; } if (cl.length < 5) continue;
  out.push({ id: a.id, title: a.title, artist: a.artist_title || '佚名', year, style: s[1], thumb: th, colors: cl.map((x) => hex(x.c)), share: cl.map((x) => +x.n.toFixed(3)) });
}
const styles = Object.values(STYLES).map(([zh, en, , from, to, note]) => ({ id: en, zh, from, to, note }));
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ styles, paintings: out }));
console.log(out.length, 'paintings');
