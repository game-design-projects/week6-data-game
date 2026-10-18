// Builds web/levels.js: one vivid survey color per day, each with an AI-written clue ladder
// that has been checked by rules and then by a second model that tries to decode it.
//
//   node scripts/build-levels.mjs --gen local:hintlab --qa local:hintlab --days 90
//   ~/.claude/skills/opencode-go/scripts/go.sh exec -- node scripts/build-levels.mjs --gen go:claude-haiku-5-5 --qa go:gpt-6-luna
//
// LLM replies are cached under data/llm-cache/ (git-ignored), so re-running with the same settings
// makes no new calls. Colors, recipes and par never come from the model: they are computed here.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { candidates, dailyOrder } from './colors.mjs';
import { makeClient, pool } from './llm.mjs';
import { GEN_SYSTEM, ladderPrompt, parseLadder, leaks } from './hints.mjs';
import { accuracy, distance } from '../web/color.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')]));
const GEN = args.gen || 'local:hintlab';
const QA = args.qa || GEN;
const DAYS = +(args.days || 90);
const EPOCH = args.epoch || '2026-10-17';
const SEED = +(args.seed || 4553);
const ATTEMPTS = 5;
const QA_FLOOR = 45; // all clues together must lead a reader at least this close
// In-game order, from the experiment: the vague scene is the free clue, the concrete object
// next, the plain description last because it gives the most away.
const ORDER = ['vague', 'object', 'plain'];

const ask = makeClient({ cacheDir: path.join(root, 'data', 'llm-cache') });
const DEC_SYSTEM = 'You are playing a paint-mixing game. You read hints about a hidden color and picture the exact shade.';
const decodePrompt = hints => `Hints, from vague to precise:\n${hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\nReply with only your best guess as a hex code, like #4A7FC1.`;

function problems(ladder, name) {
  if (!ladder) return ['reply was not the JSON ladder'];
  const out = [];
  for (const k of ORDER) {
    const text = ladder[k].trim();
    const l = leaks(text, name, k === 'plain');
    if (l.words > 18) out.push(`${k}: ${l.words} words`);
    if (l.name.length) out.push(`${k}: uses "${l.name.join(', ')}" from the name`);
    if (l.color.length) out.push(`${k}: color word "${l.color.join(', ')}"`);
    if (/[#\d]/.test(text)) out.push(`${k}: has a number or hex`);
  }
  return out;
}

async function qa(clues, hex) {
  const reply = await ask(QA, { system: DEC_SYSTEM, user: decodePrompt(clues), temperature: 0 });
  const guess = reply.match(/#[0-9a-f]{6}\b/i)?.[0].toUpperCase();
  return guess ? { guess, acc: accuracy(guess, hex) } : { guess: null, acc: 0 };
}

async function clueLadder(c) {
  const tried = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const user = ladderPrompt(c) + (attempt ? `\nAttempt ${attempt + 1}: your earlier hints broke these rules: ${tried.at(-1)}. Write new ones.` : '');
    const ladder = parseLadder(await ask(GEN, { system: GEN_SYSTEM, user }));
    const bad = problems(ladder, c.name);
    if (bad.length) { tried.push(bad.join('; ')); continue; }
    const clues = ORDER.map(k => ladder[k].trim().replace(/^["“]|["”.]$/g, '').replace(/\s+/g, ' '));
    const check = await qa(clues, c.hex);
    if (check.acc < QA_FLOOR) { tried.push(`a reader guessed ${check.guess}, too far off (${check.acc}%)`); continue; }
    return { clues, qa: check, attempts: attempt + 1 };
  }
  console.error(`[levels] ${c.name} ${c.hex}: no valid ladder after ${ATTEMPTS} attempts (${tried.join(' | ')})`);
  return null;
}

const all = dailyOrder(candidates({ log: console.error }), SEED);
const tried = all.slice(0, Math.ceil(DAYS * 1.3)); // spare colors for the ones whose clues fail
const ladders = await pool(tried, GEN.startsWith('local') ? 2 : 6, async (c, i) => {
  const r = await clueLadder(c);
  if (i % 10 === 9) console.error(`[levels] ${i + 1}/${tried.length} ladders`);
  return r;
});
const ok = tried.map((c, i) => ladders[i] && { c, ...ladders[i] }).filter(Boolean);
// Keep the seeded order, but never two days in a row in one hue family, and no near-twin
// (OKLab distance < MIN_WEEK_GAP) anywhere within a week.
const MIN_WEEK_GAP = 0.1;
const sextant = item => Math.floor(item.c.h / 60) % 6;
const fits = w => !picked.length || (sextant(w) !== sextant(picked.at(-1)) && picked.slice(-6).every(p => distance(p.c.hex, w.c.hex) >= MIN_WEEK_GAP));
const picked = [], waiting = [];
for (const item of ok) {
  waiting.push(item);
  for (let i; picked.length < DAYS && (i = waiting.findIndex(fits)) >= 0;) picked.push(waiting.splice(i, 1)[0]);
}
if (picked.length < DAYS) console.error(`[levels] only ${picked.length} of ${DAYS} days have valid clues`);

const levels = picked.map(({ c, clues, qa: check }) => ({
  hex: c.hex,
  name: c.name,
  clues,
  par: { counts: c.par.counts, total: c.par.total, acc: c.par.acc },
  best: { counts: c.best.counts, total: c.best.total, acc: c.best.acc },
  qa: check.acc,
}));
const model = GEN.slice(GEN.indexOf(':') + 1);
const src = `// Generated by scripts/build-levels.mjs (--gen ${GEN} --qa ${QA} --seed ${SEED}). Do not edit by hand.
export const EPOCH = '${EPOCH}';
export const CLUE_MODEL = '${model}';
export const LEVELS = ${JSON.stringify(levels, null, 1)};
`;
await writeFile(path.join(root, 'web', 'levels.js'), src);
const mean = xs => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.error(`[levels] wrote ${levels.length} levels; mean QA ${mean(levels.map(l => l.qa))}%, attempts ${mean(picked.map(p => p.attempts))}`);
