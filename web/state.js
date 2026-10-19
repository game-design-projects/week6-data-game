// Game rules as plain data in, plain data out, so they can be unit-tested without a DOM.
import { MAX_TESTS, TEST_PENALTY, accuracy, hint } from './color.js';


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

const HEX = /^#[0-9A-F]{6}$/;

/** `pick` is the color on the picker right now; it can change freely until the round is locked. */
export function newGame() {
  return { pick: null, tests: [], done: false };
}

const tested = (g, hex) => g.tests.some(t => t.hex === hex);
export const canPick = g => !g.done;
export const canTest = g => !g.done && !!g.pick && !tested(g, g.pick) && g.tests.length < MAX_TESTS;
export const canLock = g => !g.done && g.tests.length > 0;

export function pick(g, hex) {
  if (!canPick(g) || !HEX.test(hex)) return g;
  return { ...g, pick: hex };
}

/** Test the picked color against the target: records accuracy + per-axis hint. */
export function test(g, level) {
  if (!canTest(g)) return g;
  const hex = g.pick;
  const tests = [...g.tests, { hex, acc: accuracy(hex, level.hex), hint: hint(hex, level.hex) }];
  const next = { ...g, tests };
  return tests.length >= MAX_TESTS ? lock(next) : next;
}

export function lock(g) {
  if (!g.tests.length) return g;
  return { ...g, done: true };
}

export const best = g => g.tests.reduce((b, t) => (!b || t.acc > b.acc ? t : b), null);

/** Best test, minus TEST_PENALTY per extra test. */
export function points(g) {
  const b = best(g);
  if (!b) return 0;
  return Math.max(0, Math.round(b.acc - TEST_PENALTY * (g.tests.length - 1)));
}

/** What locking in right now would score; null before the first test. */
export const pointsIfLocked = g => (g.tests.length ? points(g) : null);

/** Restore a saved game; anything malformed starts fresh rather than crashing the page. */
export function revive(saved) {
  const g = newGame();
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.tests)) return g;
  const okTest = t => t && HEX.test(t.hex) && typeof t.acc === 'number' && Array.isArray(t.hint);
  if (!saved.tests.every(okTest)) return g;
  const tests = saved.tests.map(({ hex, acc, hint }) => ({ hex, acc, hint }));
  const pick = HEX.test(saved.pick) ? saved.pick : tests.at(-1)?.hex ?? null;
  return { pick, tests, done: !!saved.done && tests.length > 0 };
}
