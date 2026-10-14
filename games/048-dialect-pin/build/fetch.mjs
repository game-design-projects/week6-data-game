// Downloads per-state Harvard Dialect Survey result pages (as transcribed text) from the asucbi/BDSR2 GitHub mirror.
import fs from 'node:fs';
const base = 'https://raw.githubusercontent.com/asucbi/BDSR2/main/proc/hds/harvard%20dialect%20survey/';
const ST = 'AL AR AZ CA CO CT DE FL GA IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC SD TN TX UT VA VT WA WI WV WY'.split(' ');
fs.mkdirSync('raw', { recursive: true });
for (const s of ST) {
  const f = `raw/${s}.txt`;
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) continue;
  const r = await fetch(`${base}${s}.txt`, { headers: { 'User-Agent': 'daily-data-games/1.0' } });
  if (!r.ok) throw new Error(`${s} ${r.status}`);
  fs.writeFileSync(f, await r.text());
  await new Promise((r) => setTimeout(r, 200));
}
console.log('ok', ST.length);
