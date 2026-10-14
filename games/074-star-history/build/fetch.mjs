// 1) top repos metadata via gh api search (cached) 2) weekly WatchEvent (=star) counts from the
// GH Archive mirror on the public ClickHouse playground (github_events), window 2023-02-06..2024-05-26.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const F = 'raw/repos.json';
let repos;
if (existsSync(F)) repos = JSON.parse(readFileSync(F));
else {
  repos = [];
  for (const page of [1, 2]) {
    const r = JSON.parse(execFileSync('gh', ['api', `search/repositories?q=stars:>15000&sort=stars&per_page=100&page=${page}`], { maxBuffer: 1 << 26 }));
    repos.push(...r.items.map((x) => ({ full: x.full_name, stars: x.stargazers_count, lang: x.language, created: x.created_at.slice(0, 10), desc: x.description, topics: x.topics || [] })));
    await sleep(2500);
  }
  writeFileSync(F, JSON.stringify(repos));
}
const OUT = 'raw/weekly.tsv';
if (!existsSync(OUT)) {
  const list = repos.map((r) => `'${r.full.replace(/'/g, '')}'`).join(',');
  const sql = `SELECT repo_name, toStartOfWeek(created_at, 1) w, count() c FROM github_events
    WHERE event_type='WatchEvent' AND created_at >= '2023-02-06' AND created_at < '2024-05-27' AND repo_name IN (${list})
    GROUP BY repo_name, w ORDER BY repo_name, w FORMAT TSV`;
  const res = await fetch('https://play.clickhouse.com/?user=play', { method: 'POST', body: sql, headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  if (!res.ok) throw new Error(await res.text());
  writeFileSync(OUT, await res.text());
}
console.log('ok', repos.length);
