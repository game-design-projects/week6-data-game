// raw/artworks.json + raw/img/*.jpg -> ../data.json : 5 dominant colours per painting via k-means (ffmpeg decodes pixels).
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const raw = path.join(import.meta.dirname, 'raw');
const all = JSON.parse(fs.readFileSync(path.join(raw, 'artworks.json')));
// id -> [name, id, cap, from, to, note]. from/to = the period the label is normally used for (the AIC label is
// only kept when the painting's year lies inside it +-10 years, which removes mislabelled outliers).
const STYLES = {
  Impressionism: ['Impressionism', 'Impressionism', 30, 1860, 1915, 'A Paris school of the 1870s-1890s: painting outdoors in quick brushstrokes, with bright color and blue-violet even in the shadows.'],
  'Post-Impressionism': ['Post-Impressionism', 'Post-Impressionism', 22, 1880, 1915, 'Came after Impressionism and used purer, more saturated color to express structure and feeling (van Gogh, Gauguin, Cezanne, Seurat).'],
  Realism: ['Realism', 'Realism', 20, 1840, 1910, 'From the mid-19th century, truthful scenes of everyday life, usually in sober earth tones and grays.'],
  Renaissance: ['Renaissance', 'Renaissance', 16, 1400, 1620, 'Europe in the 14th-16th centuries: tempera and early oil paint, often with gold grounds, deep reds, ultramarine and dark browns.'],
  Modernism: ['Modernism', 'Modernism', 18, 1890, 1960, 'From the early 20th century, breaking with realism, often with large flat areas of pure color or abstract blocks.'],
  Neoclassicism: ['Neoclassicism', 'Neoclassicism', 6, 1760, 1830, 'A late-18th-century revival of antiquity: calm, restrained pictures dominated by flesh tones, blue-grays and earth colors.'],
  Baroque: ['Baroque', 'Baroque', 8, 1600, 1750, 'The dramatic light and dark of the 17th century: warm highlights emerging from deep, dark backgrounds.'],
  'Barbizon School': ['Barbizon School', 'Barbizon School', 5, 1830, 1880, 'Mid-19th-century French forest landscapes in pastoral greens, browns and grays.'],
  Mannerism: ['Mannerism', 'Mannerism', 4, 1520, 1610, 'The affected style of the late 16th century: elongated figures and cool, vivid, high-contrast color.'],
  'Japanese (culture or style)': ['Japanese tradition', 'Japanese', 14, 1300, 1960, 'Japanese painting and ukiyo-e: large areas of blank space or flat color, with pigments from minerals and plants.'],
  'Chinese (culture or style)': ['Chinese tradition', 'Chinese', 8, 1300, 1960, 'Chinese silk and paper painting: ink and pale washes, overall warm yellow and gray.'],
  'Folk Art': ['Folk Art', 'Folk Art', 8, 1750, 1900, 'American folk painting: self-taught artists, bright flat colors and plain composition.'],
};
// Some museum titles carry a Chinese-script duplicate ("Flowers of the Four Seasons ..."): keep the English part only.
const latin = (s) => s.replace(/[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+/g, '').replace(/\s+/g, ' ').trim();
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
  out.push({ id: a.id, title: latin(a.title), artist: latin(a.artist_title || '') || 'Unknown', year, style: s[1], thumb: th, colors: cl.map((x) => hex(x.c)), share: cl.map((x) => +x.n.toFixed(3)) });
}
const styles = Object.values(STYLES).map(([name, en, , from, to, note]) => ({ id: en, name, from, to, note }));
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ styles, paintings: out }));
console.log(out.length, 'paintings');
