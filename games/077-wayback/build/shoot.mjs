// Render a redacted "wireframe screenshot" of every cached archive page with headless Chrome.
// Images become grey blocks (logos gone), all text goes through the redactor, scripts are removed.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import path from 'node:path';
import { SITES } from './sites.mjs'; import { makeRedactor } from './redact.mjs';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync('raw/page', { recursive: true }); fs.mkdirSync('raw/png', { recursive: true }); fs.mkdirSync('../img', { recursive: true });
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const attr = (tag, n) => (tag.match(new RegExp(`\\b${n}\\s*=\\s*["']?(\\d+%?)`, 'i')) || [])[1];
export function wireframe(h, rec, red) {
  const base = `https://web.archive.org/web/${rec.ts}/${rec.orig}`;
  h = h.replace(/<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>|<iframe[\s\S]*?<\/iframe>|<object[\s\S]*?<\/object>|<embed[^>]*>|<!--[\s\S]*?-->|<link[^>]+rel=["']?(?:shortcut |apple-touch-)?icon[^>]*>|<meta[^>]+http-equiv=["']?refresh[^>]*>/gi, '');
  h = h.replace(/<svg\b[\s\S]*?<\/svg>|<canvas\b[\s\S]*?<\/canvas>|<video\b[\s\S]*?<\/video>|<input[^>]+type=["']?image[^>]*>/gi, '<span style="display:inline-block;width:28px;height:28px;background:#b9b9b9"></span>');
  h = h.replace(/<img\b[^>]*>/gi, (t) => {
    const w = attr(t, 'width'), hh = attr(t, 'height');
    const st = `display:inline-block;background:#b9b9b9;${w ? `width:${/%$/.test(w) ? w : w + 'px'};` : 'width:60px;'}${hh ? `height:${/%$/.test(hh) ? hh : hh + 'px'};` : 'height:24px;'}`;
    return `<span style="${st}"></span>`;
  });
  // redact visible text nodes, title, and remove attributes that may carry names
  h = h.replace(/>([^<]+)</g, (m, t) => '>' + red(t) + '<');
  h = h.replace(/<title[^>]*>([\s\S]*?)<\/title>/i, (m, t) => `<title>${red(t)}</title>`);
  h = h.replace(/\s(?:alt|title|placeholder|value|summary|content)\s*=\s*("[^"]*"|'[^']*')/gi, (m, v) => /^\s(?:value|content)/i.test(m) ? m.replace(v, v[0] + red(v.slice(1, -1)) + v[0]) : '');
  h = h.replace(/<meta[^>]+charset[^>]*>/gi, '').replace(/\uFFFD/g, '');
  const inject = `<meta charset="utf-8"><base href="${base}"><style>*{background-image:none!important}body{background-color:#fff!important}</style>`;
  return /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + inject) : inject + h;
}
if (process.argv[1].endsWith('shoot.mjs')) {
  for (const s of SITES) {
    if (only && s[0] !== only) continue;
    const red = makeRedactor(s);
    for (const f of fs.readdirSync('raw/html').filter((f) => f.startsWith(s[0] + '-'))) {
      const rec = JSON.parse(fs.readFileSync('raw/html/' + f)); if (!rec.ok || !rec.html) continue;
      const name = `${s[0]}-${rec.y}`, png = `raw/png/${name}.png`, out = `../img/${name}.webp`;
      if (fs.existsSync(out) && !process.argv.includes('--force')) continue;
      if (process.argv.includes('--reencode') && fs.existsSync(png)) { execFileSync('cwebp', ['-q', '35', '-resize', '680', '0', png, '-o', out], { stdio: 'ignore' }); continue; }
      fs.writeFileSync(`raw/page/${name}.html`, wireframe(rec.html, rec, red));
      const shot = (file) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1000,640',
        '--virtual-time-budget=6000', `--screenshot=${path.resolve(png)}`, 'file://' + path.resolve(file)], { stdio: 'ignore', timeout: 25000 });
      try {
        try { shot(`raw/page/${name}.html`); } catch {
          // external CSS hung: retry fully offline (no stylesheets, no base) so layout is table/markup only
          const off = wireframe(rec.html, rec, red).replace(/<link[^>]+stylesheet[^>]*>/gi, '').replace(/<base[^>]*>/i, '').replace(/@import[^;]+;/gi, '');
          fs.writeFileSync(`raw/page/${name}.html`, off); shot(`raw/page/${name}.html`);
        }
        execFileSync('cwebp', ['-q', '35', '-resize', '680', '0', png, '-o', out], { stdio: 'ignore' });
        console.log(name, fs.statSync(out).size);
      } catch (e) { console.log(name, 'FAIL', e.message.slice(0, 60)); }
    }
  }
}
