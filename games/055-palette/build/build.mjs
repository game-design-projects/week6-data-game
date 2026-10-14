// raw/artworks.json + raw/img/*.jpg -> ../data.json : 5 dominant colours per painting via k-means (ffmpeg decodes pixels).
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const raw = path.join(import.meta.dirname, 'raw');
const all = JSON.parse(fs.readFileSync(path.join(raw, 'artworks.json')));
const STYLES = { Impressionism: ['印象派', 'Impressionism', 22], 'Post-Impressionism': ['后印象派', 'Post-Impressionism', 14], Realism: ['现实主义', 'Realism', 14], Renaissance: ['文艺复兴', 'Renaissance', 12], Modernism: ['现代主义', 'Modernism', 12], Neoclassicism: ['新古典主义', 'Neoclassicism', 6], Baroque: ['巴洛克', 'Baroque', 5], 'Barbizon School': ['巴比松派', 'Barbizon School', 5], Mannerism: ['样式主义', 'Mannerism', 4], 'Japanese (culture or style)': ['日本传统', 'Japanese', 12], 'Chinese (culture or style)': ['中国传统', 'Chinese', 10], 'Folk Art': ['民间艺术', 'Folk Art', 6] };
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
  if ((used[a.style_title] = (used[a.style_title] || 0) + 1) > s[2]) continue;
  const f = path.join(raw, 'img', a.id + '.jpg'); if (!fs.existsSync(f)) continue;
  const cl = kmeans(pixels(f)); if (cl.length < 5) continue;
  out.push({ id: a.id, title: a.title, artist: a.artist_title || '佚名', year: a.date_start, style: s[1], thumb: thumb(f), colors: cl.map((x) => hex(x.c)), share: cl.map((x) => +x.n.toFixed(3)) });
}
const styles = Object.values(STYLES).map(([zh, en]) => ({ id: en, zh }));
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ styles, paintings: out }));
console.log(out.length, 'paintings');
