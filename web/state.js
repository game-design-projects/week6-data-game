// Game rules as plain data in, plain data out, so they can be unit-tested without a DOM.
import { PAINTS, POT_CAPACITY, MAX_TESTS, TEST_PENALTY, mixHex, accuracy, hint } from './color.js';

export const CLUE_COST = 5; // points for each clue past the first

/** Puzzle number for a local calendar date: EPOCH is #1. */
export function dayNumber(date, epoch) {
  const [y, m, d] = epoch.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86400000) + 1;
}

/** Calendar date (YYYY-MM-DD) of puzzle n. */
export function dateOf(n, epoch) {
  const [y, m, d] = epoch.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n - 1)).toISOString().slice(0, 10);
}

export function newGame() {
  return { committed: PAINTS.map(() => 0), pending: [], tests: [], clues: 1, done: false };
}

/** Drops currently in the pot, by paint. */
export function potCounts(g) {
  const counts = g.committed.slice();
  for (const i of g.pending) counts[i]++;
  return counts;
}
export const potTotal = g => g.committed.reduce((a, b) => a + b, 0) + g.pending.length;
export const potHex = g => mixHex(potCounts(g));

export const canDrop = g => !g.done && potTotal(g) < POT_CAPACITY;
export const canUndo = g => !g.done && g.pending.length > 0;
export const canTest = g => !g.done && g.pending.length > 0 && g.tests.length < MAX_TESTS;
export const canLock = g => !g.done && g.tests.length > 0;
export const canClue = (g, level) => !g.done && g.clues < level.clues.length;

export function addDrop(g, paintIndex) {
  if (!canDrop(g)) return g;
  return { ...g, pending: [...g.pending, paintIndex] };
}

/** Only paint added since the last test can come back out. */
export function undo(g) {
  if (!canUndo(g)) return g;
  return { ...g, pending: g.pending.slice(0, -1) };
}

export function revealClue(g, level) {
  if (!canClue(g, level)) return g;
  return { ...g, clues: g.clues + 1 };
}

/** Test the pot against the target: commits the pending paint and records accuracy + per-axis hint. */
export function test(g, level) {
  if (!canTest(g)) return g;
  const counts = potCounts(g);
  const hex = mixHex(counts);
  const tests = [...g.tests, { counts, hex, acc: accuracy(hex, level.hex), hint: hint(hex, level.hex) }];
  const next = { ...g, committed: counts, pending: [], tests };
  return tests.length >= MAX_TESTS ? lock(next) : next;
}

export function lock(g) {
  if (!g.tests.length) return g;
  return { ...g, done: true, pending: [] };
}

export const best = g => g.tests.reduce((b, t) => (!b || t.acc > b.acc ? t : b), null);

/** Best test, minus TEST_PENALTY per extra test and CLUE_COST per extra clue. */
export function points(g) {
  const b = best(g);
  if (!b) return 0;
  return Math.max(0, Math.round(b.acc - TEST_PENALTY * (g.tests.length - 1) - CLUE_COST * (g.clues - 1)));
}

/** What locking in right now would score; null before the first test. */
export const pointsIfLocked = g => (g.tests.length ? points(g) : null);

/** Restore a saved game; anything malformed starts fresh rather than crashing the page. */
export function revive(saved) {
  const g = newGame();
  if (!saved || typeof saved !== 'object') return g;
  const okCounts = c => Array.isArray(c) && c.length === PAINTS.length && c.every(n => Number.isInteger(n) && n >= 0);
  if (!okCounts(saved.committed) || !Array.isArray(saved.pending) || !Array.isArray(saved.tests)) return g;
  if (!saved.pending.every(i => Number.isInteger(i) && i >= 0 && i < PAINTS.length)) return g;
  return { committed: saved.committed, pending: saved.pending, tests: saved.tests, clues: Math.max(1, Math.min(3, saved.clues | 0)), done: !!saved.done };
}
