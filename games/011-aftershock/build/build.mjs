// raw USGS feeds -> data.json, using the same toPuzzle() as the live loader.
import fs from 'node:fs';
import { toPuzzle } from '../game.js';
const byDay = {};
for (const f of fs.readdirSync('raw').filter((x) => x.endsWith('.json'))) {
  for (const q of JSON.parse(fs.readFileSync('raw/' + f)).features) {
    const d = new Date(q.properties.time).toISOString().slice(0, 10);
    (byDay[d] ||= []).push(q);
  }
}
const puzzles = [];
for (const [date, features] of Object.entries(byDay).sort()) {
  const p = toPuzzle({ features }, date);
  if (p) puzzles.push(p);
}
fs.writeFileSync('../data.json', JSON.stringify({ puzzles }));
console.log(puzzles.length, fs.statSync('../data.json').size);
