// Checks a submitted round and scores it on the server, from the colors the player tested.
// The client's own score is never trusted: the answer and the scoring rules are the game's own
// (web/levels.js, web/color.js), so a round scores the same here as on screen.
import { LEVELS, EPOCH } from '../web/levels.js';
import { MAX_TESTS, TEST_PENALTY, accuracy } from '../web/color.js';
import { dayNumber } from '../web/state.js';

const HEX = /^#[0-9A-F]{6}$/;
const DEVICE = /^[A-Za-z0-9-]{8,64}$/;
export const NAME_MAX = 24;

/** A display name: printable, single-spaced, at most NAME_MAX characters. */
export function cleanName(name) {
  const s = String(name ?? '').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return s || 'Anonymous';
}

export const cleanDevice = d => (typeof d === 'string' && DEVICE.test(d) ? d : null);

/**
 * { day, device, name, tests: ['#RRGGBB', ...] } -> { row } or { error }.
 * Days up to tomorrow (UTC) are accepted: players are a day ahead of UTC in some time zones.
 */
export function scoreRound(body, now = new Date()) {
  if (!body || typeof body !== 'object') return { error: 'expected a JSON object' };
  const device = cleanDevice(body.device);
  if (!device) return { error: 'bad device id' };
  const day = body.day;
  if (!Number.isInteger(day) || day < 1 || day > dayNumber(now, EPOCH) + 1) return { error: 'bad day' };
  const tests = Array.isArray(body.tests) ? body.tests.map(t => String(t).toUpperCase()) : [];
  if (!tests.length || tests.length > MAX_TESTS || !tests.every(t => HEX.test(t)) || new Set(tests).size !== tests.length) {
    return { error: `tests must be 1 to ${MAX_TESTS} different #RRGGBB colors` };
  }
  const level = LEVELS[(day - 1) % LEVELS.length];
  const accs = tests.map(t => accuracy(t, level.hex));
  const best = accs.indexOf(Math.max(...accs));
  const pts = Math.max(0, Math.round(accs[best] - TEST_PENALTY * (tests.length - 1)));
  return { row: { day, device, name: cleanName(body.name), pts, acc: accs[best], tests: tests.length, hex: tests[best] } };
}
