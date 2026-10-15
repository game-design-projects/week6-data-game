import { readFileSync, writeFileSync } from 'node:fs';
const repos = JSON.parse(readFileSync('raw/repos.json'));
const byName = new Map(repos.map((r) => [r.full, r]));
const weeks = []; for (let d = Date.UTC(2023, 1, 6); d < Date.UTC(2024, 4, 27); d += 7 * 864e5) weeks.push(new Date(d).toISOString().slice(0, 10));
const acc = new Map();
for (const line of readFileSync('raw/weekly.tsv', 'utf8').trim().split('\n')) {
  const [n, w, c] = line.split('\t');
  if (!acc.has(n)) acc.set(n, new Array(weeks.length).fill(0));
  const i = weeks.indexOf(w); if (i >= 0) acc.get(n)[i] = +c;
}
// Repos whose GitHub description is written in Chinese get an English one (the player sees descriptions as a clue).
const EN_DESC = {
  'jackfrued/Python-100-Days': 'Python - 100 days from beginner to master',
  'CyC2018/CS-Notes': 'Essential knowledge for technical interviews: LeetCode, operating systems, computer networks, system design',
  '521xueweihan/HelloGitHub': 'Share interesting, entry-level open source projects on GitHub.',
  'Snailclimb/JavaGuide': 'A Java interview and general backend guide covering CS fundamentals, databases, distributed systems, high concurrency, system design and AI application development',
  'krahets/hello-algo': '"Hello Algo": an animated, run-in-one-click tutorial on data structures and algorithms, in several languages, with code in Python, Java, C++, C, C#, JS, Go, Swift, Rust, Ruby, Kotlin, TS, Dart and more',
  'justjavac/free-programming-books-zh_CN': 'Free programming books in Chinese. Contributions welcome',
  'ruanyf/weekly': 'A weekly newsletter for tech enthusiasts, published every Friday',
  'macrozheng/mall': 'An e-commerce system with a storefront and an admin back office, built on Spring Boot and MyBatis and deployed with Docker. The storefront covers home portal, recommendations, search, product pages, cart, order flow, membership, customer service and help center; the back office covers products, orders, members, promotions, operations, content, reports, finance and permissions.',
  'fighting41love/funNLP': 'A huge collection of NLP resources, mostly for Chinese: word lists and dictionaries, corpora and datasets, knowledge graphs, pretrained models, extraction tools and chatbots',
};
const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
const out = [];
for (const [n, s] of acc) {
  const tot = s.reduce((a, b) => a + b, 0);
  if (tot < 3000 || s.filter((x) => x > 0).length < weeks.length - 4) continue; // need full coverage
  const r = byName.get(n);
  out.push({ id: n, stars: r.stars, lang: r.lang, created: r.created, desc: EN_DESC[n] || (CJK.test(r.desc || '') ? (() => { throw new Error('no English description for ' + n); })() : r.desc), topics: r.topics.slice(0, 6), total: tot, s });
}
out.sort((a, b) => b.stars - a.stars);
writeFileSync('../data.json', JSON.stringify({ weeks, repos: out, asOf: '2026-10', window: [weeks[0], weeks[weeks.length - 1]] }));
console.log(out.length, 'repos', weeks.length, 'weeks');
