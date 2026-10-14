// raw Wiktionary wikitext -> data.json  (English entries with a stated first-attestation year)
import fs from 'node:fs';
const raw = new URL('./raw/', import.meta.url).pathname;
const out = new URL('../data.json', import.meta.url).pathname;
const RE = /(?:first attested|attested|first recorded|first used|first known use|etydate=)\s*(?:since|in|from|around|c\.|circa|by|as early as)?\s*(?:the\s+)?(?:year\s+)?(1[0-9]{3}|20[0-2][0-9])(?!\d)/i;
const rank = new Map(fs.readFileSync(raw + 'count_1w.txt', 'utf8').split('\n').map((l, i) => [l.split('\t')[0], i + 1]));
const words = [];
for (const f of fs.readdirSync(raw).filter((x) => x.startsWith('pages-'))) {
  const j = JSON.parse(fs.readFileSync(raw + f));
  for (const p of Object.values(j.query.pages)) {
    const txt = p.revisions?.[0]?.slots?.main?.['*'];
    if (!txt) continue;
    const m = txt.match(/==English==([\s\S]*?)(?=\n==[^=]|$)/);
    if (!m) continue;
    const en = m[1];
    const ety = en.match(/===Etymology[^=]*===([\s\S]*?)(?=\n===)/);
    if (!ety) continue;
    const em = ety[1].match(RE);
    if (!em) continue;
    const yrs = new Set([...ety[1].replace(/<ref[\s\S]*?<\/ref>/g, '').matchAll(/\b(1[0-9]{3}|20[0-2][0-9])\b/g)].map((x) => x[1]));
    if (yrs.size !== 1) continue; // ambiguous etymology (several dates) -> skip
    const r = rank.get(p.title);
    if (!r || r > 70000) continue; // keep words people may know
    const year = +em[1];
    // first definition line as gloss
    const defs = [...en.matchAll(/^# (?!\*)(.+)$/gm)].map((x) => x[1]);
    const clean = (s) => s.replace(/\{\{(?:lb|label|lbl)\|en\|([^}]*)\}\}/g, '').replace(/\{\{(?:l|m|w|gloss|n-g|non-gloss|ng)\|[^|}]*\|([^|}]*)[^}]*\}\}/g, '$1').replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').trim();
    const gloss = defs.map(clean).find((d) => d.length > 8 && d.length < 140 && !/obsolete|misspelling|alternative|plural of|form of/i.test(d));
    if (!gloss || /[,:;]$/.test(gloss) || /[\[\]{}]/.test(gloss)) continue;
    // etymology note, cleaned (strip wiki markup)
    let note = clean(ety[1].replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/\{\{(?:bor\+?|der|inh\+?|af|suf|com|calque|cog|ncog|clipping|blend|back-form|compound|doublet)\|([^}]*)\}\}/g, (_, a) => a.split('|').slice(1).filter((x) => !/=/.test(x)).join(' + ')));
    note = note.replace(/\s+/g, ' ').slice(0, 220);
    words.push({ w: p.title, y: year, r, g: gloss.slice(0, 120), e: note });
  }
}
const BAD = new Set('alba cowan em ultimo xoxo hentai pagan msec orthotics cock mic mike motherfucker dado bola accident'.split(' '));
for (let i = words.length - 1; i >= 0; i--) if (BAD.has(words[i].w)) words.splice(i, 1);
words.forEach((x) => delete x.e);
words.sort((a, b) => a.w.localeCompare(b.w));
const byDec = {};
words.forEach((x) => { const d = Math.floor(x.y / 100) * 100; byDec[d] = (byDec[d] || 0) + 1; });
console.log(words.length, byDec);
fs.writeFileSync(out, JSON.stringify({ source: 'en.wiktionary.org', words }));
console.log(fs.statSync(out).size);
