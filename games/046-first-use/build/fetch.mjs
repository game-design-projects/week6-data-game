// Download the Online Etymology Dictionary dump (yosevu/etymonline on GitHub, scraped from etymonline.com)
// into build/raw/ (cached; git-ignored). Run: node build/fetch.mjs
import fs from 'node:fs';
const raw = new URL('./raw/', import.meta.url).pathname;
fs.mkdirSync(raw, { recursive: true });
const f = raw + 'etymonline-index.json';
if (fs.existsSync(f)) console.log('cached', f);
else {
  const r = await fetch('https://raw.githubusercontent.com/yosevu/etymonline/master/index.json', { headers: { 'User-Agent': 'daily-data-games/1.0 (NYU class project)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  console.log('saved', f);
}
