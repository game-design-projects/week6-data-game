// Small committed fixture for game.test.mjs: 4 trimmed top lists (day-3..day) + series of the leading spike candidates.
import fs from 'node:fs'; import path from 'node:path';
import { topMap, rankSpikes, seriesUrl } from '../game.js';
import { cached } from './fetch.mjs';
const RAW = path.join(import.meta.dirname, 'raw');
const day = '2026-10-12', days = ['2026-10-09', '2026-10-10', '2026-10-11', day];
const tops = days.map((d) => {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, `top-${d}.json`), 'utf8'));
  return { items: [{ articles: j.items[0].articles.slice(0, 120).map(({ article, views, rank }) => ({ article, views, rank })) }] };
});
const maps = tops.map(topMap);
const spikes = rankSpikes(maps.slice(0, 3), maps[3]).slice(0, 4);
const series = {};
for (const s of spikes) series[s.a] = await cached(`art-${day}-${s.a}.json`.replace(/[\/?]/g, '_'), seriesUrl(s.a, day));
fs.writeFileSync(path.join(import.meta.dirname, 'fixture.json'), JSON.stringify({ day, tops, series }));
console.log(spikes.map((s) => `${s.a} x${s.ratio.toFixed(1)}`));
