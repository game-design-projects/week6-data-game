// DOM layer: renders state.js games and feeds them input. All rules live in state.js.
import { MAX_TESTS, TEST_PENALTY, MATCH, square, oklab, rgb, hsvToHex, hexToHsv } from './color.js';
import * as S from './state.js';
import * as P from './painting.js';
import { EPOCH, LEVELS } from './levels.js';

const GAME_URL = 'https://stevenli-phoenix-work.itch.io/week6-data-game';
const log = (...args) => console.debug('[restoration]', ...args);
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// Storage can be missing or throw (private mode, blocked cookies in the itch iframe); the game still plays.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('rst:v1:' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('rst:v1:' + k, JSON.stringify(v)); } catch { /* play without saving */ } },
};

const today = Math.max(1, S.dayNumber(new Date(), EPOCH));
const levelFor = n => LEVELS[(n - 1) % LEVELS.length];
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const isLight = hex => oklab(hex)[0] > 0.7;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let n = today, level, game;
let fresh = { test: false };
let hsv = { h: 0, s: 0.5, v: 0.75 }; // picker position; kept here because a gray hex has no hue to recover
let showOriginal = true; // after the round: the original painting, or the player's version

// ---------- sound: tiny synthesized plips, no assets ----------
let audio = null;
let muted = !!store.get('muted');
function tone(freq, { dur = 0.12, type = 'sine', gain = 0.07, at = 0, slide = 0.5 } = {}) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime + at, o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* no audio, no problem */ }
}

// ---------- the picker: hue ring around a saturation/brightness square ----------
const picker = $('picker'), sv = $('sv'), hueThumb = $('hue-thumb'), svThumb = $('sv-thumb');
const RING_MID = 0.443; // ring centerline as a fraction of the picker width (the ring is the outer 22.6% of the radius)
const clamp01 = x => Math.min(1, Math.max(0, x));
let drag = null;

function setHsv(next) {
  if (!S.canPick(game)) return;
  hsv = { ...hsv, ...next };
  game = S.pick(game, hsvToHex(hsv.h, hsv.s, hsv.v));
  save();
  render();
}

function pointAt(e) {
  if (drag === 'hue') {
    const r = picker.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    setHsv({ h: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360 });
  } else {
    const r = sv.getBoundingClientRect();
    setHsv({ s: clamp01((e.clientX - r.left) / r.width), v: 1 - clamp01((e.clientY - r.top) / r.height) });
  }
}

picker.addEventListener('pointerdown', e => {
  if (!S.canPick(game)) return;
  const r = picker.getBoundingClientRect(), q = sv.getBoundingClientRect(), pad = 12;
  const dist = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) / (r.width / 2);
  if (e.target === hueThumb || (dist > 0.72 && dist <= 1.04)) drag = 'hue';
  else if (e.clientX > q.left - pad && e.clientX < q.right + pad && e.clientY > q.top - pad && e.clientY < q.bottom + pad) drag = 'sv';
  else return;
  picker.setPointerCapture(e.pointerId);
  (drag === 'hue' ? hueThumb : svThumb).focus({ preventScroll: true });
  e.preventDefault();
  pointAt(e);
});
picker.addEventListener('pointermove', e => { if (drag) pointAt(e); });
const endDrag = () => { if (drag) tone(520, { dur: 0.06, type: 'triangle', slide: 1.1, gain: 0.035 }); drag = null; };
picker.addEventListener('pointerup', endDrag);
picker.addEventListener('pointercancel', endDrag);

// Arrow keys nudge the focused thumb; Shift moves further.
hueThumb.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
  if (!step) return;
  setHsv({ h: (hsv.h + step * (e.shiftKey ? 15 : 2) + 360) % 360 });
  e.preventDefault();
});
svThumb.addEventListener('keydown', e => {
  const d = (e.shiftKey ? 0.1 : 0.02);
  const move = { ArrowRight: { s: hsv.s + d }, ArrowLeft: { s: hsv.s - d }, ArrowUp: { v: hsv.v + d }, ArrowDown: { v: hsv.v - d } }[e.key];
  if (!move) return;
  setHsv(Object.fromEntries(Object.entries(move).map(([k, x]) => [k, clamp01(x)])));
  e.preventDefault();
});

// ---------- the painting ----------
const canvas = $('art'), ctx = canvas.getContext('2d', { willReadFrequently: true });
let art = null; // { n, base, work, idx, off, edge, full } for the level on screen
let artFrame = 0;

const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`could not load ${src}`)); img.src = src; });

async function loadArt(num, lv) {
  art = null;
  $('art-status').textContent = 'Loading the painting…';
  canvas.width = lv.w;
  canvas.height = lv.h;
  ctx.clearRect(0, 0, lv.w, lv.h);
  try {
    const img = await loadImage(`paintings/${lv.id}.jpg`);
    if (num !== n) return; // the player moved on to another day while this loaded
    ctx.drawImage(img, 0, 0, lv.w, lv.h);
    const base = ctx.getImageData(0, 0, lv.w, lv.h);
    const idx = P.regionIndices(lv.mask);
    art = { n: num, base: base.data, work: new ImageData(new Uint8ClampedArray(base.data), lv.w, lv.h), idx, off: P.offsets(base.data, idx), edge: P.edgeIndices(idx, lv.w, lv.h), full: null };
    $('art-status').textContent = '';
    drawArt();
    loadImage(`paintings/${lv.id}-full.jpg`).then(full => { if (art?.n === num) { art.full = full; drawArt(); } }, () => {});
  } catch (e) {
    // getImageData throws on file:// pages; the game needs to be served over http(s)
    log('painting failed', e);
    $('art-status').textContent = location.protocol === 'file:' ? 'Open this page through a web server to see the painting.' : 'The painting did not load. Try reloading.';
  }
}

/** Repaint on the next frame; dragging the picker calls this many times a frame. */
function drawArt() {
  if (artFrame) return;
  artFrame = requestAnimationFrame(() => {
    artFrame = 0;
    if (!art || art.n !== n) return;
    if (game.done && showOriginal && art.full) { ctx.drawImage(art.full, 0, 0, canvas.width, canvas.height); return; }
    const hex = game.done ? S.best(game).hex : game.pick;
    P.repaint(art.work.data, art.base, art.idx, art.off, hex);
    if (!hex) for (const p of art.edge) art.work.data.set([255, 255, 255], p * 4); // outline the patch until it has a color
    ctx.putImageData(art.work, 0, 0);
  });
}

// ---------- actions ----------
function save() { store.set('game:' + n, game); }

function runTest() {
  if (!S.canTest(game)) return;
  game = S.test(game, level);
  const t = game.tests.at(-1);
  log('test', game.tests.length, t.hex, t.acc, t.hint.map(h => h.word).join(', '));
  fresh.test = true;
  save();
  tone(392, { dur: 0.16, type: 'triangle', slide: 1 });
  tone(t.acc >= MATCH ? 784 : t.acc >= 70 ? 523 : 330, { dur: 0.22, type: 'triangle', slide: 1, at: 0.09 });
  if (game.done) finish(); else render();
}

function lockIn() {
  if (!S.canLock(game)) return;
  game = S.lock(game);
  save();
  finish();
}

function finish() {
  const results = store.get('results') || {};
  if (!results[n]) {
    const b = S.best(game);
    results[n] = { pts: S.points(game), acc: b.acc, tests: game.tests.length, on: localDate(), hex: level.hex };
    store.set('results', results);
  }
  log('finished', n, results[n]);
  [523, 659, 784].forEach((f, i) => tone(f, { dur: 0.3, type: 'triangle', slide: 1, at: i * 0.08, gain: 0.06 }));
  render();
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- rendering ----------
const POLE = { lighter: '#ffffff', darker: '#222222', redder: '#e5484d', greener: '#2fa35a', yellower: '#f5c400', bluer: '#3b6fe0' };
const AXIS_OK = { L: 'lightness', a: 'red–green', b: 'yellow–blue' };

function chip(h) {
  const c = el('span', 'chip');
  if (!h.strength) { c.classList.add('ok'); c.textContent = `✓ ${AXIS_OK[h.axis]}`; return c; }
  const pole = el('i', 'pole');
  pole.style.setProperty('--pole', POLE[h.word]);
  const bars = el('span', 'bars');
  for (let i = 1; i <= 3; i++) bars.append(el('i', i <= h.strength ? 'on' : ''));
  c.append(pole, document.createTextNode(h.word), bars);
  c.title = ['', 'a little', 'clearly', 'a lot'][h.strength] + ' ' + h.word;
  return c;
}

function paint(node, hex) {
  node.style.setProperty('--c', hex);
  node.style.setProperty('--on', isLight(hex) ? '#1b1a19' : '#fff');
}

function renderPicker() {
  const hue = hsvToHex(hsv.h, 1, 1);
  const a = hsv.h * Math.PI / 180;
  sv.style.setProperty('--hue', hsv.h.toFixed(1));
  hueThumb.style.left = `${50 + 100 * RING_MID * Math.sin(a)}%`;
  hueThumb.style.top = `${50 - 100 * RING_MID * Math.cos(a)}%`;
  hueThumb.style.setProperty('--c', hue);
  hueThumb.setAttribute('aria-valuenow', Math.round(hsv.h));
  svThumb.style.left = `${hsv.s * 100}%`;
  svThumb.style.top = `${(1 - hsv.v) * 100}%`;
  svThumb.style.setProperty('--c', hsvToHex(hsv.h, hsv.s, hsv.v));
  svThumb.setAttribute('aria-valuetext', `${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`);
  picker.classList.toggle('off', !S.canPick(game));
  for (const t of [hueThumb, svThumb]) t.tabIndex = S.canPick(game) ? 0 : -1;

  const swatch = $('swatch'), mine = swatch.querySelector('.mine');
  const shown = game.done ? S.best(game).hex : game.pick;
  swatch.classList.toggle('is-empty', !shown);
  if (shown) paint(mine, shown); else mine.style.removeProperty('--c');
  $('swatch-label').textContent = game.done ? 'your best' : shown ? (S.canTest(game) ? 'your pick' : 'already tested') : 'pick a color';
  $('swatch-hex').textContent = shown || '';
  swatch.setAttribute('aria-label', shown ? `${game.done ? 'Your best' : 'Your pick'} ${shown}` : 'No color picked yet');
  drawArt();
}

function renderInfo() {
  $('art-title').textContent = level.title;
  $('art-meta').textContent = [level.artist, level.date].filter(Boolean).join(' · ');
}

function renderTests() {
  const list = $('tests');
  $('tests-count').textContent = `${game.tests.length} of ${MAX_TESTS}`;
  $('tests-empty').hidden = game.tests.length > 0;
  list.replaceChildren(...game.tests.map((t, i) => {
    const li = el('li', 'test');
    if (i === game.tests.length - 1) li.classList.add('latest');
    if (fresh.test && i === game.tests.length - 1) li.classList.add('fresh');
    const sw = el('span', 'sw');
    sw.style.setProperty('--c', t.hex);
    sw.title = t.hex;
    const acc = el('span', 'acc', Math.round(t.acc));
    acc.append(el('small', null, '%'));
    const chips = el('span', 'chips');
    chips.append(...t.hint.map(chip));
    li.append(sw, acc, chips);
    return li;
  }));
  const line = $('score-line');
  line.replaceChildren();
  if (game.tests.length && !game.done) {
    const b = S.best(game);
    const left = el('span');
    left.append('Lock in now: ', el('b', null, `${S.points(game)} pts`));
    const cost = game.tests.length > 1 ? ` − ${TEST_PENALTY * (game.tests.length - 1)} for tests` : '';
    line.append(left, el('span', null, `best ${Math.round(b.acc)}%${cost}`));
  }
}

function shareText() {
  const grid = game.tests.map(t => square(t.acc)).join('');
  return `Restoration #${n} · ${level.title} · ${S.points(game)} pts\n${grid} ${game.tests.length} test${game.tests.length > 1 ? 's' : ''}\n${GAME_URL}`;
}

function renderResult() {
  const card = $('result');
  card.hidden = !game.done;
  $('tests-card').hidden = game.done;
  $('mixer').hidden = game.done;
  const compare = $('btn-compare');
  compare.hidden = !game.done;
  compare.textContent = showOriginal ? 'Show my version' : 'Show the original';
  if (!game.done) return;
  const b = S.best(game);
  $('result-kicker').textContent = b.acc >= 98 ? 'Spot on' : b.acc >= MATCH ? 'A match' : b.acc >= 80 ? 'Close' : 'Locked in';
  $('result-points').textContent = S.points(game);
  const meta = $('result-meta');
  meta.replaceChildren(el('div', 'grid', game.tests.map(t => square(t.acc)).join('')), el('div', null, `best match ${Math.round(b.acc)}%`), el('div', null, `${game.tests.length} test${game.tests.length > 1 ? 's' : ''}`));
  $('result-name').textContent = level.crowd;
  $('result-hex').textContent = level.hex;
  // Side by side in RGB, so the miss is concrete: which channel was off and by how much.
  const par = $('result-par');
  const row = (label, hex) => {
    const dot = el('i', 'dot');
    dot.style.setProperty('--c', hex);
    return [dot, el('span', null, label), el('code', null, `${hex}  rgb(${rgb(hex).join(', ')})`)];
  };
  const diff = rgb(level.hex).map((t, i) => t - rgb(b.hex)[i]);
  par.replaceChildren(...row('Your best', b.hex), ...row('The original', level.hex),
    el('span'), el('span'), el('span', null, `Off by R ${fmtDiff(diff[0])} · G ${fmtDiff(diff[1])} · B ${fmtDiff(diff[2])}`));
  const credit = $('result-credit');
  credit.replaceChildren(`${level.title}, ${level.artist}${level.date ? ', ' + level.date : ''}. `);
  const a = el('a', null, 'Art Institute of Chicago');
  a.href = level.url;
  a.target = '_blank';
  a.rel = 'noopener';
  credit.append(a, level.credit ? ` · ${level.credit}` : '');
  $('share-text').hidden = true;
  tickNext();
}

const fmtDiff = d => (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d);

function tickNext() {
  const next = $('next');
  if (!game.done) return;
  if (n !== today) { next.textContent = `${n < today ? 'Archive' : 'Preview of'} puzzle #${n}. Today's is #${today}.`; return; }
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((midnight - now) / 1000));
  next.textContent = `Next painting in ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
setInterval(tickNext, 1000);

function render() {
  $('puzzle-label').textContent = `#${n} · ${fmtDate(S.dateOf(n, EPOCH))}${n < today ? ' · from the archive' : n > today ? ' · preview' : ''}`;
  renderPicker();
  renderInfo();
  renderTests();
  renderResult();
  $('btn-test').disabled = !S.canTest(game);
  $('btn-lock').disabled = !S.canLock(game);
  $('btn-lock').textContent = game.tests.length ? `Lock in · ${S.points(game)}` : 'Lock in';
  fresh = { test: false };
}

function load(num) {
  n = num;
  level = levelFor(n);
  game = S.revive(store.get('game:' + n));
  hsv = game.pick ? hexToHsv(game.pick) : { h: 0, s: 0.5, v: 0.75 };
  showOriginal = true;
  loadArt(n, level);
  log('load', n, { tests: game.tests.length, done: game.done });
  render();
}

// ---------- dialogs ----------
function openArchive() {
  const results = store.get('results') || {};
  const grid = $('archive');
  grid.replaceChildren();
  for (let d = today; d >= 1; d--) {
    const r = results[d];
    const b = el('button', 'day');
    b.type = 'button';
    b.append(el('b', null, `#${d}`), el('span', null, r ? `${r.pts} pts` : fmtDate(S.dateOf(d, EPOCH)).replace(/^\w+,?\s/, '')));
    if (r) {
      b.classList.add('done');
      b.style.setProperty('--c', r.hex);
      b.style.setProperty('--on', isLight(r.hex) ? '#1b1a19' : '#fff');
    } else if (store.get('game:' + d)?.tests?.length) b.lastChild.textContent = 'in progress';
    if (d === n) b.classList.add('current');
    b.addEventListener('click', () => { $('dlg-archive').close(); load(d); });
    grid.append(b);
  }
  $('dlg-archive').showModal();
}

function openStats() {
  const results = store.get('results') || {};
  const played = Object.keys(results).map(Number);
  const pts = played.map(d => results[d].pts);
  let streak = 0;
  for (let d = today; d >= 1; d--) {
    if (results[d]?.on === S.dateOf(d, EPOCH)) streak++;
    else if (d !== today) break; // today not played yet still keeps yesterday's streak
  }
  const stat = (v, label) => { const s = el('div', 'stat'); s.append(el('b', null, v), el('span', null, label)); return s; };
  $('stat-row').replaceChildren(
    stat(played.length, 'played'),
    stat(pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : '–', 'average'),
    stat(pts.length ? Math.max(...pts) : '–', 'best'),
    stat(streak, 'day streak'),
  );
  const buckets = Array.from({ length: 10 }, (_, i) => pts.filter(p => Math.min(9, Math.floor(p / 10)) === i).length);
  const max = Math.max(1, ...buckets);
  const mine = results[n] ? Math.min(9, Math.floor(results[n].pts / 10)) : -1;
  $('histogram').replaceChildren(...buckets.map((c, i) => i).reverse().map(i => {
    const row = el('div', 'hbar' + (i === mine ? ' mine' : ''));
    const bar = el('i');
    bar.style.width = `${(buckets[i] / max) * 100}%`;
    row.append(el('span', null, i === 9 ? '90–100' : `${i * 10}–${i * 10 + 9}`), el('span'), el('span', null, buckets[i] || ''));
    row.children[1].append(bar);
    return row;
  }));
  $('dlg-stats').showModal();
}

async function share() {
  const text = shareText();
  try {
    await navigator.clipboard.writeText(text);
    toast('Result copied');
    return;
  } catch { /* the itch iframe may not grant clipboard access */ }
  const area = $('share-text');
  area.value = text;
  area.hidden = false;
  area.select();
  try { if (document.execCommand('copy')) { toast('Result copied'); return; } } catch { /* fall through */ }
  toast('Select the text to copy it');
}

// ---------- wiring ----------
$('btn-test').addEventListener('click', runTest);
$('btn-lock').addEventListener('click', lockIn);
$('btn-share').addEventListener('click', share);
$('btn-more').addEventListener('click', openArchive);
$('btn-archive').addEventListener('click', openArchive);
$('btn-stats').addEventListener('click', openStats);
$('btn-help').addEventListener('click', () => $('dlg-help').showModal());
$('dlg-help').addEventListener('close', () => store.set('seen-help', true));
const soundBtn = $('btn-sound');
const paintSound = () => { soundBtn.classList.toggle('off', muted); soundBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); };
soundBtn.addEventListener('click', () => { muted = !muted; store.set('muted', muted); paintSound(); tone(660); });
paintSound();

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button')) return; // let the focused button handle it
  const k = e.key.toLowerCase();
  if (k === 'enter') { runTest(); e.preventDefault(); }
  else if (k === 'l') lockIn();
  else if (k === '?') $('dlg-help').showModal();
});

$('btn-compare').addEventListener('click', () => { showOriginal = !showOriginal; render(); });

// #day=N opens a specific puzzle (handy for testing future levels locally).
const hashDay = +(location.hash.match(/day=(\d+)/)?.[1] || 0);
load(hashDay >= 1 && hashDay <= LEVELS.length ? hashDay : today);
if (!store.get('seen-help')) $('dlg-help').showModal();
log(`puzzle #${today} of ${LEVELS.length} built (epoch ${EPOCH})`);
