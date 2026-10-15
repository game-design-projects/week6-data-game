import fs from 'node:fs'; import crypto from 'node:crypto';
const pick = JSON.parse(fs.readFileSync('raw/picked.json', 'utf8'));
const bad = /breast|lust|footjob|knocker|stiff|peepee|squert|fingerig|gagging|pounding|toilet|henti|lesben|fuking|nasty|mistress|pimp|slave|boozer|getsdown|poop|fishhead|tattoo|loverboy|cuddles|babybaby|dogboy|fuck|shit|dick|pussy|cock|bitch|sex|porn|nigg|fag|slut|whore|cunt|ass|boob|tit|anal|cum|rape|nazi|hell|spank|naked|nude|horny|hooker|bang|kill|gay|lesbian|dildo|playboy|penis|vagina|sperm|hentai|suck|erotic|milf|tits|boner/i;
const rank = new Map(fs.readFileSync('raw/10k.txt', 'utf8').split('\n').map((x) => x.trim()).filter(Boolean).map((w, i) => [w, i + 1]));
const items = [];
for (const w of pick) {
  if (bad.test(w) || w.length < 3) continue;
  const h = crypto.createHash('sha1').update(w).digest('hex').toUpperCase();
  const t = fs.readFileSync(`raw/range-${h.slice(0, 5)}.txt`, 'utf8').split('\n').find((l) => l.startsWith(h.slice(5)));
  const n = t ? parseInt(t.split(':')[1], 10) : 0;
  if (n > 0) items.push({ p: w, n, r: rank.get(w) });
}
fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items }));
console.log(items.length);
