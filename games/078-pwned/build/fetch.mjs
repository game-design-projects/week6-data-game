// Fetch common passwords list + HIBP k-anonymity counts (no key needed). Cached in raw/.
import fs from 'node:fs'; import crypto from 'node:crypto';
const UA = 'daily-data-games-class-project';
fs.mkdirSync('raw', { recursive: true });
const listF = 'raw/10k.txt';
if (!fs.existsSync(listF)) fs.writeFileSync(listF, await (await fetch('https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10k-most-common.txt', { headers: { 'User-Agent': UA } })).text());
const words = fs.readFileSync(listF, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
// sample: take every ~12th entry from first 6000 to span the range, plus top 40
const pick = [...words.slice(0, 40), ...words.filter((_, i) => i >= 40 && i < 6000 && i % 13 === 0)];
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').toUpperCase();
const prefixes = new Map();
for (const w of pick) {
  const h = sha(w), p = h.slice(0, 5), f = `raw/range-${p}.txt`;
  if (!fs.existsSync(f)) {
    const r = await fetch('https://api.pwnedpasswords.com/range/' + p, { headers: { 'User-Agent': UA, 'Add-Padding': 'true' } });
    if (!r.ok) { console.error('fail', p, r.status); continue; }
    fs.writeFileSync(f, await r.text()); await new Promise((r) => setTimeout(r, 400));
  }
}
console.log('fetched', pick.length);
fs.writeFileSync('raw/picked.json', JSON.stringify(pick));
