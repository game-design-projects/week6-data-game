import fs from 'node:fs'; import crypto from 'node:crypto';
const pick = JSON.parse(fs.readFileSync('raw/picked.json', 'utf8'));
const bad = /fuck|shit|dick|pussy|cock|bitch|sex|porn|nigg|fag|slut|whore|cunt|ass|boob|tit|anal|cum|rape|nazi|hell|spank|naked|nude|horny|hooker|bang|kill|gay|lesbian|dildo|playboy|penis|vagina|sperm|hentai|suck|erotic|milf|tits|boner/i;
const items = [];
for (const w of pick) {
  if (bad.test(w) || w.length < 3) continue;
  const h = crypto.createHash('sha1').update(w).digest('hex').toUpperCase();
  const t = fs.readFileSync(`raw/range-${h.slice(0, 5)}.txt`, 'utf8').split('\n').find((l) => l.startsWith(h.slice(5)));
  const n = t ? parseInt(t.split(':')[1], 10) : 0;
  if (n > 0) items.push({ p: w, n });
}
fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items }));
console.log(items.length);
