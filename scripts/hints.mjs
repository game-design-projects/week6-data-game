// Hint prompts and checks shared by the hint experiment and the level builder.

export const COLOR_WORDS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'violet', 'pink', 'brown', 'black', 'white', 'gray', 'grey', 'cyan', 'magenta', 'teal', 'turquoise', 'indigo', 'lavender', 'maroon', 'navy'];
const MODIFIERS = new Set(['light', 'dark', 'pale', 'deep', 'bright', 'dull', 'dusty', 'medium', 'very', 'pastel', 'neon', 'electric', 'vivid', 'darkish', 'lightish', 'hot', 'true', 'pure', 'rich', 'strong', 'soft', 'warm', 'cool', 'ugly', 'baby', 'muted', 'faded', 'burnt', 'off', 'ish']);

export const GEN_SYSTEM = 'You write the daily hint for a paint-mixing game. Players never see the hidden color: they read your hint, then mix paint to match it. A good hint makes the exact shade imaginable (hue, how light, how vivid) without naming it. Be concrete and accurate rather than poetic.';
const RULES = `At most 14 words each. Never use the survey name or any word from it, hex codes, or numbers. "Color words" means: ${COLOR_WORDS.join(', ')}.`;
function describe(c) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16));
  return `Hidden color: ${c.hex} (sRGB ${r}, ${g}, ${b}; OKLCH lightness ${Math.round(c.L * 100)}%, chroma ${c.C.toFixed(2)}, hue ${Math.round(c.h)} degrees). Color-survey name: "${c.name}".`;
}
export const ladderPrompt = c => `${describe(c)}
Write three hints, from vague to precise. Reply with only JSON: {"vague": "...", "object": "...", "plain": "..."}
- vague: a mood, place or moment this color belongs to. No color words.
- object: one or two specific real-world things that are exactly this shade. No color words.
- plain: hue family, how light or dark, how vivid or dull, in everyday words. Color words allowed.
${RULES}`;
export const hexOnlyPrompt = c => `Hidden color: ${c.hex}.
Write one hint: one or two specific real-world things that are exactly this shade. No color words. Reply with only the hint.
${RULES}`;

export function parseLadder(s) {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const j = JSON.parse(m[0]); return ['vague', 'object', 'plain'].every(k => typeof j[k] === 'string' && j[k].trim()) ? j : null; } catch { return null; }
}
const words = s => s.toLowerCase().match(/[a-z]+/g) || [];
export function leaks(hint, name, colorWordsAllowed) {
  const w = new Set(words(hint));
  // The plain clue may say "orange" even when the answer is "orange red"; it may not say "watermelon".
  const nameHit = words(name).filter(x => !MODIFIERS.has(x) && x.length > 2 && w.has(x) && !(colorWordsAllowed && COLOR_WORDS.includes(x)));
  const colorHit = colorWordsAllowed ? [] : COLOR_WORDS.filter(x => w.has(x));
  return { name: nameHit, color: colorHit, words: words(hint).length };
}

