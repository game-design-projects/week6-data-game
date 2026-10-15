// engine/presets.js — reusable game loops. Each preset renders its own UI into
// ctx.stage (or opts.container), waits for the player, and resolves with a
// stage result {score, max, win, emoji, summary}. Games chain/compose them.
import { h, panel, tile, pips, button, toast, shake, toNode, clear, colors } from './dom.js';
import { createMap } from './libs.js';
import {
  normalize, expScore, pctError, logError, emojiBar, fmtNum, fmtKm, fmtPct, haversineKm, bearingDeg, arrow, clamp, TILE, jaccard,
} from './core.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mount = (ctx, opts, el) => ((opts.container ?? ctx.stage).append(el), el);

// ═════════════════════════════ guess ═════════════════════════════
/**
 * Guess an entity from a fixed list, with optional progressive clues and
 * per-guess feedback cells (distance, direction, attribute comparisons…).
 */
export async function guess(ctx, {
  options,
  answer,
  maxGuesses = 6,
  title = '你的猜测',
  placeholder = '输入并从列表中选择…',
  clues = [],
  cluesTitle = '线索',
  feedback,
  columns = [],
  near,
  onGuess,
  scoring,
  max = 100,
  container,
} = {}) {
  const log = ctx.log.scope('guess');
  const byId = new Map(options.map((o) => [String(o.id), o]));
  const ans = byId.get(String(answer));
  if (!ans) throw new Error(`guess: answer "${answer}" is not in options`);
  log('start', { options: options.length, maxGuesses, clues: clues.length });

  // clues
  const clueEls = clues.map((c, i) => h('div', { class: ['ds-clue', i > 0 && 'locked'] }, h('div', { class: 'body' }, i === 0 ? toNode(c) : h('span', { class: 'muted small' }, '猜错一次解锁'))));
  const revealClue = (i) => {
    if (i >= clues.length) return;
    const el = clueEls[i];
    el.classList.remove('locked');
    clear(el.querySelector('.body')).append(toNode(clues[i]));
  };
  if (clues.length) mount(ctx, { container }, panel({ kicker: `${clues.length} 条`, title: cluesTitle }, h('div', { class: 'ds-clues' }, clueEls)));

  // guess rows
  const cols = `minmax(0, 2.2fr) ${columns.map(() => 'minmax(0, 1fr)').join(' ')}`.trim();
  const rows = h('div', { class: 'ds-guesses', style: { '--cols': cols } },
    columns.length ? h('div', { class: 'ds-guess-head' }, h('span', '猜测'), columns.map((c) => h('span', c))) : null);
  const pipEl = h('span');
  const input = h('input', { class: 'ds-input', placeholder, autocomplete: 'off', spellcheck: false, 'aria-label': title, role: 'combobox', 'aria-expanded': 'false' });
  const list = h('div', { class: 'list hidden', role: 'listbox' });
  const submit = button('猜', { variant: 'accent' });
  const combo = h('div', { class: 'ds-combo', style: { flex: '1 1 220px' } }, input, list);
  const form = h('form', { class: 'ds-row', style: { alignItems: 'stretch', flexWrap: 'nowrap' } }, combo, submit);
  const box = mount(ctx, { container }, panel({ title, aside: pipEl }, form, h('div', { style: { height: '12px' } }), rows));

  const used = new Set();
  let n = 0;
  let won = false;
  const emoji = [];
  pipEl.replaceChildren(pips(maxGuesses, 0));

  // combobox
  let matches = [];
  let active = 0;
  let chosen = null;
  const render = () => {
    clear(list);
    if (!matches.length) list.append(h('div', { class: 'empty' }, '没有匹配的选项'));
    matches.slice(0, 60).forEach((o, i) => {
      list.append(h('div', {
        class: ['opt', used.has(String(o.id)) && 'used'], role: 'option', 'aria-selected': String(i === active),
        onMousedown: (e) => { e.preventDefault(); pick(o); },
      }, h('span', o.label), o.hint && h('span', { class: 'hint' }, o.hint)));
    });
    list.classList.toggle('hidden', !input.value.trim());
    input.setAttribute('aria-expanded', String(!list.classList.contains('hidden')));
  };
  const search = () => {
    chosen = null;
    const q = normalize(input.value);
    if (!q) { matches = []; render(); return; }
    const scored = [];
    for (const o of options) {
      const names = [o.label, ...(o.aliases ?? [])].map(normalize);
      const s = names.some((x) => x === q) ? 0 : names.some((x) => x.startsWith(q)) ? 1 : names.some((x) => x.split(' ').some((w) => w.startsWith(q))) ? 2 : names.some((x) => x.includes(q)) ? 3 : -1;
      if (s >= 0) scored.push([s, o]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label));
    matches = scored.map((x) => x[1]);
    active = Math.max(0, matches.findIndex((o) => !used.has(String(o.id))));
    render();
  };
  const pick = (o) => {
    if (used.has(String(o.id))) { toast('这个已经猜过了'); return; }
    chosen = o;
    input.value = o.label;
    list.classList.add('hidden');
  };
  input.addEventListener('input', search);
  input.addEventListener('blur', () => setTimeout(() => list.classList.add('hidden'), 120));
  input.addEventListener('keydown', (e) => {
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { active = Math.min(matches.length - 1, active + 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    if (e.key === 'Enter' && matches[active] && !chosen) { pick(matches[active]); e.preventDefault(); }
    if (e.key === 'Escape') list.classList.add('hidden');
  });

  const apply = (o) => {
    n++;
    used.add(String(o.id));
    const correct = String(o.id) === String(ans.id);
    const isNear = !correct && near ? !!near(o, ans) : false;
    const state = correct ? 'hit' : isNear ? 'near' : 'miss';
    const cells = feedback ? feedback(o, ans) ?? [] : [];
    rows.append(h('div', { class: 'ds-guess' }, tile(o.label, { state, lead: true }), cells.map((c, i) => tile(c.text, { state: c.state, num: c.num, title: c.title, i: i + 1 }))));
    emoji.push(correct ? TILE.hit : isNear ? TILE.near : TILE.miss);
    log('guess', { n, id: o.id, correct });
    onGuess?.(o, { correct, n });
    if (correct) won = true;
    else revealClue(n);
    pipEl.replaceChildren(pips(maxGuesses, n, { won }));
  };

  await new Promise((resolve) => {
    const step = (o) => {
      apply(o);
      if (won || n >= maxGuesses) { form.remove(); resolve(); }
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const o = chosen ?? (matches[active] && normalize(matches[active].label) === normalize(input.value) ? matches[active] : null);
      if (!o) { shake(combo); toast('请从列表中选一个'); return; }
      if (used.has(String(o.id))) { toast('这个已经猜过了'); return; }
      input.value = '';
      chosen = null;
      matches = [];
      render();
      step(o);
      input.focus();
    });
    if (ctx.autoplay) {
      (async () => {
        const wrong = options.find((o) => String(o.id) !== String(ans.id));
        if (wrong) { await sleep(30); step(wrong); }
        if (!won && n < maxGuesses) { await sleep(30); step(ans); }
      })();
    }
  });

  if (!won) {
    box.append(h('div', { style: { marginTop: '14px' } }, h('div', { class: 'ds-callout bad' }, '答案是 ', h('b', ans.label))));
  }
  // reveal any remaining clues at the end so the player sees the full picture
  for (let i = 0; i < clues.length; i++) revealClue(i);

  const score = scoring ? scoring(n, won) : won ? Math.round((max * (maxGuesses - n + 1)) / maxGuesses) : 0;
  return { score, max, win: won, emoji: emoji.join(''), summary: won ? `${n}/${maxGuesses} 次猜中` : `没猜中 · ${ans.label}`, answer: ans };
}

// ═════════════════════════════ estimate ═════════════════════════════
/**
 * Estimate a number with a slider (+ typed input). Scoring by % error, log
 * error, absolute error, or a custom fn. attempts > 1 adds higher/lower hints.
 */
export async function estimate(ctx, {
  answer,
  min,
  max,
  step,
  log: logScale = false,
  initial,
  unit = '',
  format = (v) => fmtNum(v, step && step < 1 ? Math.min(4, String(step).split('.')[1]?.length ?? 0) : 0),
  title = '你的估计',
  prompt,
  attempts = 1,
  scoring = logScale ? 'log' : 'pct',
  scale,
  tolerance,
  maxScore = 100,
  container,
} = {}) {
  const log = ctx.log.scope('estimate');
  if (!Number.isFinite(answer)) throw new Error('estimate: answer must be a finite number');
  if (!(max > min)) throw new Error('estimate: need min < max');
  if (logScale && !(min > 0)) throw new Error('estimate: log scale needs min > 0');
  log('start', { min, max, logScale, attempts });

  const errOf = (g) => (typeof scoring === 'function' ? null : scoring === 'log' ? logError(g, answer) : scoring === 'abs' ? Math.abs(g - answer) : pctError(g, answer));
  const sc = scale ?? (scoring === 'log' ? 0.3 : scoring === 'abs' ? (max - min) / 10 : 0.35);
  const scoreOf = (g) => (typeof scoring === 'function' ? Math.round(maxScore * clamp(scoring(g, answer), 0, 1)) : expScore(errOf(g), sc, maxScore));
  const tol = tolerance ?? (scoring === 'log' ? 0.05 : scoring === 'abs' ? (max - min) / 100 : 0.05);
  const within = (g) => (typeof scoring === 'function' ? scoring(g, answer) >= 0.95 : errOf(g) <= tol);

  // append the unit unless a custom format() already printed it
  const hasUnit = (txt) => !unit || String(txt).includes(unit.trim());
  const fu = (v) => { const t = format(v); return hasUnit(t) ? String(t) : `${t} ${unit}`; };

  const RES = 1000;
  const toPos = (v) => (logScale ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min)) * RES;
  const fromPos = (p) => {
    const t = p / RES;
    let v = logScale ? Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min))) : min + t * (max - min);
    if (step) v = Math.round(v / step) * step;
    else if (logScale) { const mag = 10 ** Math.floor(Math.log10(v)); v = Math.round(v / (mag / 10)) * (mag / 10); }
    return clamp(v, min, max);
  };
  let value = clamp(initial ?? fromPos(RES / 2), min, max);

  const readout = h('div', { class: 'ds-readout' });
  const range = h('input', { type: 'range', class: 'ds-range', min: 0, max: RES, step: 1, 'aria-label': title });
  const typed = h('input', { class: 'ds-input num', inputmode: 'decimal', style: { maxWidth: '170px' }, 'aria-label': '精确输入' });
  const submit = button(attempts > 1 ? '提交' : '就这个', { variant: 'accent' });
  const history = h('div', { class: 'ds-stack' });
  const pipEl = h('span');
  const sync = (from) => {
    if (from !== 'range') range.value = String(toPos(value));
    range.style.setProperty('--fill', `${(toPos(value) / RES) * 100}%`);
    if (from !== 'typed') typed.value = String(value);
    readout.replaceChildren(format(value), hasUnit(format(value)) ? '' : h('span', { class: 'unit' }, unit));
  };
  range.addEventListener('input', () => { value = fromPos(Number(range.value)); sync('range'); });
  typed.addEventListener('input', () => {
    const v = Number(String(typed.value).replace(/[, _$%]/g, ''));
    if (Number.isFinite(v)) { value = clamp(v, min, max); sync('typed'); }
  });
  sync();

  const scaleRow = h('div', { class: 'ds-row between small muted mono' }, h('span', fu(min)), logScale ? h('span', '对数刻度') : null, h('span', fu(max)));
  const controls = h('div', { class: 'ds-stack' }, readout, range, scaleRow, h('div', { class: 'ds-row', style: { justifyContent: 'center' } }, typed, submit));
  const box = mount(ctx, { container }, panel({ title, aside: attempts > 1 ? pipEl : null }, prompt ? h('p', { class: 'ink2' }, toNode(prompt)) : null, controls, history));
  if (attempts > 1) pipEl.replaceChildren(pips(attempts, 0));

  const guesses = [];
  await new Promise((resolve) => {
    const go = (g) => {
      guesses.push(g);
      const ok = within(g);
      log('attempt', { n: guesses.length, g, ok });
      if (attempts > 1) {
        const dir = g < answer ? '↑ 更高' : g > answer ? '↓ 更低' : '✓';
        const err = errOf(g);
        const errTxt = scoring === 'log' && err != null ? `差 ${(10 ** err).toFixed(1)}×` : scoring === 'pct' ? `差 ${fmtPct(err)}` : '';
        history.append(h('div', { class: 'ds-guess', style: { '--cols': '2fr 1fr 1fr' } },
          tile(fu(g), { lead: true, num: true, state: ok ? 'hit' : 'miss' }),
          tile(ok ? '✓' : dir, { state: ok ? 'hit' : 'near', i: 1 }),
          tile(ok ? '命中' : errTxt, { num: true, i: 2 })));
        pipEl.replaceChildren(pips(attempts, guesses.length, { won: ok }));
      }
      if (ok || guesses.length >= attempts) { controls.remove(); resolve(); }
    };
    submit.addEventListener('click', () => go(value));
    typed.addEventListener('keydown', (e) => e.key === 'Enter' && go(value));
    if (ctx.autoplay) (async () => { await sleep(30); go(fromPos(RES * 0.3)); if (guesses.length < attempts) { await sleep(30); go(answer); } })();
  });

  const last = guesses[guesses.length - 1];
  const penalty = 1 - 0.1 * (guesses.length - 1);
  const score = Math.round(scoreOf(last) * Math.max(0.5, penalty));

  // reveal on a number line
  const lo = Math.min(last, answer), hi = Math.max(last, answer);
  const pad = (hi - lo) * 0.25 || Math.abs(answer) * 0.2 || 1;
  const a = logScale ? Math.max(min, lo / 1.5) : lo - pad, b = logScale ? hi * 1.5 : hi + pad;
  const pos = (v) => `${(logScale ? (Math.log(v) - Math.log(a)) / (Math.log(b) - Math.log(a)) : (v - a) / (b - a)) * 100}%`;
  box.append(
    h('div', { class: 'ds-numline', 'aria-hidden': 'true' },
      h('div', { class: 'track' }),
      h('div', { class: 'mark answer', style: { left: pos(answer) } }, h('span', `答案 ${fu(answer)}`), h('i')),
      h('div', { class: 'mark guess below', style: { left: pos(last) } }, h('span', `你 ${format(last)}`), h('i'))),
    h('div', { class: 'ds-row between', style: { marginTop: '10px' } },
      h('span', { class: 'ink2' }, '正确答案 ', h('b', { class: 'mono' }, fu(answer))),
      h('span', { class: 'mono' }, `${score}/${maxScore}`)));

  const err = errOf(last);
  const summary = typeof scoring === 'function' ? `${format(last)} vs ${format(answer)}`
    : scoring === 'log' ? `差 ${(10 ** err).toFixed(2)}×` : scoring === 'pct' ? `误差 ${fmtPct(err)}` : `差 ${format(Math.abs(last - answer))}`;
  return { score, max: maxScore, win: score >= maxScore * 0.5, emoji: emojiBar(score / maxScore), summary, guess: last, guesses };
}

// ═════════════════════════════ pin ═════════════════════════════
/** Drop a pin on a map; scored by great-circle km. */
export async function pin(ctx, {
  answer,
  view = { center: [20, 0], zoom: 2 },
  labels = false,
  basemap = 'gray',
  scale = 1500,
  maxScore = 100,
  title = '在地图上标出位置',
  prompt,
  attempts = 1,
  hint = (km, deg) => `还差 ${fmtKm(km)}，往 ${arrow(deg)} 方向`,
  setup,
  reveal,
  height,
  container,
} = {}) {
  const log = ctx.log.scope('pin');
  if (!answer || !Number.isFinite(answer.lat) || !Number.isFinite(answer.lng)) throw new Error('pin: answer {lat, lng} required');
  const status = h('div', { class: 'ink2 small' }, '点击地图放置图钉，可以拖动或重新点击调整');
  const submit = button('确定位置', { variant: 'accent', disabled: true });
  const pipEl = h('span');
  const box = mount(ctx, { container }, panel({ title, aside: attempts > 1 ? pipEl : null }, prompt ? h('p', { class: 'ink2' }, toNode(prompt)) : null));
  const m = await createMap({ ...view, labels, basemap, height });
  m.el.classList.add('crosshair');
  box.append(m.el, h('div', { class: 'ds-row between', style: { marginTop: '12px' } }, status, submit));
  requestAnimationFrame(() => m.map.invalidateSize());
  if (view.bounds) requestAnimationFrame(() => m.map.fitBounds(view.bounds, { padding: [12, 12] }));
  await setup?.(m);
  if (attempts > 1) pipEl.replaceChildren(pips(attempts, 0));

  let marker = null;
  let current = null;
  const tries = [];
  m.map.on('click', (e) => {
    const ll = e.latlng.wrap();
    current = { lat: ll.lat, lng: ll.lng };
    if (marker) marker.setLatLng(e.latlng);
    else {
      marker = m.pin(e.latlng, 'accent');
      marker.dragging?.enable?.();
      marker.on('dragend', () => { const p = marker.getLatLng().wrap(); current = { lat: p.lat, lng: p.lng }; });
    }
    submit.disabled = false;
  });

  await new Promise((resolve) => {
    const go = () => {
      if (!current) return;
      const km = haversineKm(current, answer);
      tries.push({ ...current, km });
      log('attempt', { n: tries.length, km: Math.round(km) });
      const done = tries.length >= attempts || km <= scale * 0.02;
      if (!done) {
        m.L.circleMarker([current.lat, current.lng], { radius: 5, color: colors().muted, weight: 2, fillOpacity: 0.6 }).addTo(m.map);
        status.textContent = hint(km, bearingDeg(current, answer));
        pipEl.replaceChildren(pips(attempts, tries.length));
        return;
      }
      submit.remove();
      resolve();
    };
    submit.addEventListener('click', go);
    if (ctx.autoplay) {
      (async () => {
        await sleep(30);
        current = { lat: clamp(answer.lat + 3, -85, 85), lng: answer.lng + 3 };
        marker = m.pin([current.lat, current.lng], 'accent');
        go();
        while (tries.length < attempts && tries[tries.length - 1].km > scale * 0.02) { current = { lat: answer.lat, lng: answer.lng }; go(); }
      })();
    }
  });

  const last = tries[tries.length - 1];
  const penalty = 1 - 0.15 * (tries.length - 1);
  const score = Math.round(expScore(last.km, scale, maxScore) * Math.max(0.4, penalty));
  marker?.dragging?.disable?.();
  const c = colors();
  m.pin([answer.lat, answer.lng], 'answer', answer.label);
  m.L.polyline([[last.lat, last.lng], [answer.lat, answer.lng]], { color: c.ink, weight: 2, dashArray: '6 6' }).addTo(m.map);
  m.setLabels(true);
  m.map.fitBounds(m.L.latLngBounds([[last.lat, last.lng], [answer.lat, answer.lng]]).pad(0.35), { maxZoom: 12 });
  await reveal?.(m, last);
  m.el.classList.remove('crosshair');
  status.replaceChildren('你离答案 ', h('b', { class: 'mono' }, fmtKm(last.km)), answer.label ? ` · ${answer.label}` : '', h('span', { class: 'mono', style: { marginLeft: '10px' } }, `${score}/${maxScore}`));
  return { score, max: maxScore, win: score >= maxScore * 0.5, emoji: emojiBar(score / maxScore), summary: fmtKm(last.km), km: last.km, guess: last, map: m };
}

// ═════════════════════════════ rounds ═════════════════════════════
/**
 * A series of multiple-choice questions (higher/lower, pick-the-real-one…).
 * rounds: [{prompt, body?, options: [{label, sub?, body?}], correct: index | [indices], explain?}]
 * multi: true → player selects several then submits (partial credit by Jaccard).
 */
export async function rounds(ctx, { rounds: list, multi = false, title, minWidth = 150, container } = {}) {
  const log = ctx.log.scope('rounds');
  let total = 0;
  const emoji = [];
  for (let r = 0; r < list.length; r++) {
    const q = list[r];
    const correct = new Set([].concat(q.correct));
    const picked = new Set();
    const btns = q.options.map((o, i) => h('button', { class: 'ds-choice', type: 'button' }, h('span', toNode(o.label)), o.sub && h('span', { class: 'sub' }, toNode(o.sub)), o.body && toNode(o.body)));
    const submit = multi ? button('提交', { variant: 'accent', disabled: true }) : null;
    const after = h('div');
    const card = mount(ctx, { container }, panel({ kicker: `第 ${r + 1} / ${list.length} 题`, title: q.prompt ? toNode(q.prompt) : title },
      q.body ? h('div', { style: { marginBottom: '12px' } }, toNode(q.body)) : null,
      h('div', { class: 'ds-choices', style: { '--min': `${minWidth}px` } }, btns),
      submit && h('div', { class: 'ds-row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, submit),
      after));
    card.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    const pts = await new Promise((resolve) => {
      const finish = () => {
        btns.forEach((b, i) => {
          b.disabled = true;
          b.classList.remove('on');
          if (correct.has(i)) b.classList.add('hit');
          else if (picked.has(i)) b.classList.add('bad');
          else b.classList.add('miss');
        });
        submit?.remove();
        const j = jaccard([...picked], [...correct]);
        resolve(multi ? j : correct.has([...picked][0]) ? 1 : 0);
      };
      btns.forEach((b, i) => b.addEventListener('click', () => {
        if (multi) {
          picked.has(i) ? picked.delete(i) : picked.add(i);
          b.classList.toggle('on', picked.has(i));
          submit.disabled = picked.size === 0;
        } else { picked.add(i); finish(); }
      }));
      submit?.addEventListener('click', finish);
      if (ctx.autoplay) (async () => { await sleep(20); [...correct].forEach((i) => picked.add(i)); if (r % 2 && !multi) { picked.clear(); picked.add(([...correct][0] + 1) % q.options.length); } finish(); })();
    });
    log('round', { r, pts });
    total += pts;
    emoji.push(pts >= 0.999 ? TILE.hit : pts > 0 ? TILE.near : TILE.bad);
    after.append(h('div', { style: { marginTop: '12px' }, class: ['ds-callout', pts >= 0.999 ? 'good' : 'bad'] },
      pts >= 0.999 ? '✓ 正确' : pts > 0 ? `部分正确（${Math.round(pts * 100)}%）` : '✗ 错了', q.explain ? h('span', ' · ', toNode(q.explain)) : null));
    if (r < list.length - 1 && !ctx.autoplay) {
      const next = button(r === list.length - 2 ? '最后一题 →' : '下一题 →', { small: true });
      after.append(h('div', { class: 'ds-row', style: { marginTop: '10px', justifyContent: 'flex-end' } }, next));
      await new Promise((res) => next.addEventListener('click', () => { next.parentElement.remove(); res(); }));
    }
  }
  const score = Math.round(total * 10) / 10;
  return { score, max: list.length, win: score >= list.length / 2, emoji: emoji.join(''), summary: `${fmtNum(score, Number.isInteger(score) ? 0 : 1)}/${list.length} 题` };
}

// ═════════════════════════════ order ═════════════════════════════
/** Arrange items by a hidden value; positions light up green when right. */
export async function order(ctx, {
  items,
  direction = 'desc',
  attempts = 3,
  title = '排序',
  prompt,
  topLabel = direction === 'desc' ? '最高' : '最低',
  bottomLabel = direction === 'desc' ? '最低' : '最高',
  format = (v) => fmtNum(v),
  maxScore = 100,
  container,
} = {}) {
  const log = ctx.log.scope('order');
  const truth = items.slice().sort((a, b) => (direction === 'desc' ? b.value - a.value : a.value - b.value)).map((x) => String(x.id));
  let cur = ctx.rng.shuffle(items);
  if (cur.map((x) => String(x.id)).join() === truth.join()) cur = cur.slice().reverse();
  const ul = h('ul', { class: 'ds-order' });
  const pipEl = h('span');
  const submit = button('提交顺序', { variant: 'accent' });
  const hist = h('div', { class: 'small mono muted', style: { marginTop: '8px' } });
  mount(ctx, { container }, panel({ title, aside: pipEl },
    prompt ? h('p', { class: 'ink2' }, toNode(prompt)) : null,
    h('div', { class: 'small mono muted', style: { marginBottom: '6px' } }, `↑ ${topLabel}`),
    ul,
    h('div', { class: 'small mono muted', style: { marginTop: '6px' } }, `↓ ${bottomLabel}`),
    h('div', { class: 'ds-row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, submit), hist));
  pipEl.replaceChildren(pips(attempts, 0));
  const locked = new Set();
  let showValues = false;

  const draw = () => {
    clear(ul);
    cur.forEach((it, i) => {
      const id = String(it.id);
      const li = h('li', { class: [locked.has(id) && 'hit'], dataset: { id } },
        h('span', { class: 'rank' }, i + 1),
        h('div', { class: 'handle' }, h('div', toNode(it.label)), it.sub && h('div', { class: 'small muted' }, toNode(it.sub))),
        showValues ? h('span', { class: 'val' }, format(it.value)) :
          h('div', { class: 'moves' },
            h('button', { class: 'ds-iconbtn', type: 'button', 'aria-label': '上移', disabled: i === 0, onClick: () => move(i, i - 1) }, '↑'),
            h('button', { class: 'ds-iconbtn', type: 'button', 'aria-label': '下移', disabled: i === cur.length - 1, onClick: () => move(i, i + 1) }, '↓')));
      if (!showValues) dragify(li, i);
      ul.append(li);
    });
  };
  const move = (a, b) => {
    if (b < 0 || b >= cur.length) return;
    const c = cur.slice();
    const [x] = c.splice(a, 1);
    c.splice(b, 0, x);
    cur = c;
    draw();
  };
  const dragify = (li, i) => {
    const handle = li.querySelector('.handle');
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const hgt = li.getBoundingClientRect().height + 8;
      li.classList.add('dragging');
      li.setPointerCapture(e.pointerId);
      let target = i;
      const onMove = (ev) => {
        const dy = ev.clientY - startY;
        li.style.transform = `translateY(${dy}px)`;
        target = clamp(i + Math.round(dy / hgt), 0, cur.length - 1);
      };
      const onUp = () => {
        li.removeEventListener('pointermove', onMove);
        li.removeEventListener('pointerup', onUp);
        li.removeEventListener('pointercancel', onUp);
        li.style.transform = '';
        li.classList.remove('dragging');
        move(i, target);
      };
      li.addEventListener('pointermove', onMove);
      li.addEventListener('pointerup', onUp);
      li.addEventListener('pointercancel', onUp);
    });
  };
  draw();

  const lines = [];
  let used = 0;
  let solved = false;
  let lastCorrect = 0;
  await new Promise((resolve) => {
    const go = () => {
      used++;
      const ids = cur.map((x) => String(x.id));
      const ok = ids.map((id, i) => id === truth[i]);
      ok.forEach((v, i) => (v ? locked.add(ids[i]) : locked.delete(ids[i])));
      lastCorrect = ok.filter(Boolean).length;
      solved = lastCorrect === ids.length;
      lines.push(ok.map((v) => (v ? TILE.hit : TILE.miss)).join(''));
      hist.textContent = `第 ${used} 次：${lastCorrect}/${ids.length} 个位置正确`;
      log('attempt', { used, correct: lastCorrect });
      pipEl.replaceChildren(pips(attempts, used, { won: solved }));
      if (solved || used >= attempts) {
        showValues = true;
        cur = truth.map((id) => items.find((x) => String(x.id) === id));
        truth.forEach((id) => (solved ? locked.add(id) : null));
        submit.remove();
        draw();
        resolve();
      } else draw();
    };
    submit.addEventListener('click', go);
    if (ctx.autoplay) (async () => { await sleep(20); go(); if (!solved) { cur = truth.map((id) => items.find((x) => String(x.id) === id)); go(); } })();
  });
  const score = solved ? Math.round((maxScore * (attempts - used + 1)) / attempts) : Math.round(maxScore * 0.3 * (lastCorrect / items.length));
  return { score, max: maxScore, win: solved, emoji: lines.join('\n'), summary: solved ? `${used}/${attempts} 次排对` : `${lastCorrect}/${items.length} 个位置正确` };
}

// ═════════════════════════════ match ═════════════════════════════
/**
 * Pair each left item (often a chart) with a right label. Correct pairs lock;
 * wrong ones can be retried until attempts run out.
 * left: [{id, body?, label?}], right: [{id, label}], answer: {leftId: rightId}
 */
export async function match(ctx, { left, right, answer, attempts = 3, title = '配对', prompt, maxScore = 100, minWidth = 240, container } = {}) {
  const log = ctx.log.scope('match');
  const pipEl = h('span');
  const sel = new Map();
  const solvedAt = new Map();
  const cards = left.map((l) => {
    const select = h('select', { class: 'ds-input' }, h('option', { value: '' }, '选择…'), right.map((r) => h('option', { value: String(r.id) }, r.label)));
    select.addEventListener('change', () => {
      // keep choices unique: if another select holds this value, swap
      for (const [lid, s] of sel) if (lid !== String(l.id) && s.value === select.value && select.value) s.value = '';
    });
    sel.set(String(l.id), select);
    return h('div', { class: 'ds-panel', style: { padding: '12px' }, dataset: { id: l.id } }, l.label && h('div', { class: 'kicker', style: { marginBottom: '8px' } }, toNode(l.label)), l.body && toNode(l.body), h('div', { style: { marginTop: '10px' } }, select));
  });
  const submit = button('提交配对', { variant: 'accent' });
  const note = h('span', { class: 'small muted' });
  mount(ctx, { container }, panel({ title, aside: pipEl }, prompt ? h('p', { class: 'ink2' }, toNode(prompt)) : null,
    h('div', { class: 'ds-grid', style: { '--min': `${minWidth}px` } }, cards),
    h('div', { class: 'ds-row between', style: { marginTop: '12px' } }, note, submit)));
  pipEl.replaceChildren(pips(attempts, 0));
  let used = 0;
  await new Promise((resolve) => {
    const go = () => {
      const open = [...sel].filter(([lid]) => !solvedAt.has(lid));
      if (open.some(([, s]) => !s.value)) { toast('每一项都要选'); return; }
      used++;
      for (const [lid, s] of open) {
        const ok = s.value === String(answer[lid]);
        const card = cards[left.findIndex((l) => String(l.id) === lid)];
        card.style.borderColor = ok ? 'var(--hit)' : 'var(--bad)';
        if (ok) { solvedAt.set(lid, used); s.disabled = true; }
      }
      log('attempt', { used, solved: solvedAt.size });
      note.textContent = `${solvedAt.size}/${left.length} 对正确`;
      pipEl.replaceChildren(pips(attempts, used, { won: solvedAt.size === left.length }));
      if (solvedAt.size === left.length || used >= attempts) {
        for (const [lid, s] of sel) if (!solvedAt.has(lid)) { s.value = String(answer[lid]); s.disabled = true; }
        submit.remove();
        resolve();
      }
    };
    submit.addEventListener('click', go);
    if (ctx.autoplay) (async () => { await sleep(20); for (const [lid, s] of sel) s.value = String(answer[lid]); go(); })();
  });
  const per = maxScore / left.length;
  const score = Math.round([...solvedAt.values()].reduce((s, k) => s + per * (attempts - k + 1) / attempts, 0));
  const emoji = left.map((l) => { const k = solvedAt.get(String(l.id)); return k === 1 ? TILE.hit : k ? TILE.near : TILE.bad; }).join('');
  return { score, max: maxScore, win: solvedAt.size === left.length, emoji, summary: `${solvedAt.size}/${left.length} 对` };
}

// ═════════════════════════════ groups ═════════════════════════════
const GROUP_COLORS = ['#f2c94c', '#9cc87a', '#93bde6', '#c39be0'];
/** Connections-style: find groups of 4 that share a property. */
export async function groups(ctx, { groups: gs, mistakes = 4, title = '分组', prompt, container } = {}) {
  const log = ctx.log.scope('groups');
  const size = gs[0].items.length;
  const all = ctx.rng.shuffle(gs.flatMap((g, gi) => g.items.map((label) => ({ label: String(label), gi }))));
  const gridEl = h('div', { class: 'ds-groups' });
  const left = h('span', { class: 'small mono' });
  const submit = button('提交', { variant: 'accent', disabled: true });
  const shuffleBtn = button('打乱', { variant: 'ghost', small: true });
  mount(ctx, { container }, panel({ title, aside: left }, prompt ? h('p', { class: 'ink2' }, toNode(prompt)) : null, gridEl,
    h('div', { class: 'ds-row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, shuffleBtn, submit)));
  let pool = all;
  const solved = [];
  const picked = new Set();
  let wrong = 0;
  let found = 0;
  const lines = [];
  const tried = new Set();
  const draw = () => {
    clear(gridEl);
    solved.forEach((gi) => gridEl.append(h('div', { class: 'solved', style: { background: GROUP_COLORS[gi % 4] } }, h('b', gs[gi].label), h('span', gs[gi].items.join(' · ')))));
    pool.forEach((it) => gridEl.append(h('button', { class: ['cell', picked.has(it.label) && 'on'], type: 'button', onClick: () => {
      if (picked.has(it.label)) picked.delete(it.label); else if (picked.size < size) picked.add(it.label);
      submit.disabled = picked.size !== size; draw();
    } }, it.label)));
    left.textContent = `剩余失误 ${'●'.repeat(mistakes - wrong)}${'○'.repeat(wrong)}`;
  };
  shuffleBtn.addEventListener('click', () => { pool = ctx.rng.shuffle(pool); draw(); });
  draw();
  await new Promise((resolve) => {
    const go = () => {
      const sel = pool.filter((x) => picked.has(x.label));
      const key = sel.map((x) => x.label).sort().join('\u0001');
      if (tried.has(key)) { toast('这一组已经试过了'); return; }
      tried.add(key);
      const counts = new Map();
      sel.forEach((x) => counts.set(x.gi, (counts.get(x.gi) ?? 0) + 1));
      lines.push(sel.map((x) => ['🟨', '🟩', '🟦', '🟪'][x.gi % 4]).join(''));
      const best = Math.max(...counts.values());
      if (best === size) {
        const gi = sel[0].gi;
        solved.push(gi);
        found++;
        pool = pool.filter((x) => x.gi !== gi);
      } else {
        wrong++;
        shake(gridEl);
        toast(best === size - 1 ? '差一个！' : '不对');
      }
      picked.clear();
      submit.disabled = true;
      log('submit', { solved: solved.length, wrong });
      if (solved.length === gs.length || wrong >= mistakes) {
        gs.forEach((_, gi) => !solved.includes(gi) && solved.push(gi));
        pool = [];
        draw();
        submit.remove();
        shuffleBtn.remove();
        resolve();
      } else draw();
    };
    submit.addEventListener('click', go);
    if (ctx.autoplay) (async () => { for (let gi = 0; gi < gs.length; gi++) { await sleep(10); gs[gi].items.forEach((l) => picked.add(String(l))); go(); } })();
  });
  const score = Math.max(0, found * 25 - wrong * 5);
  return { score, max: gs.length * 25, win: found === gs.length, emoji: lines.join('\n'), summary: `${found}/${gs.length} 组 · ${wrong} 次失误` };
}

// ═════════════════════════════ canvas ═════════════════════════════
/**
 * A responsive, DPR-aware canvas with a frame loop for action games.
 *   const s = canvasStage(ctx, { aspect: 16/9, onFrame(dt, g, s) {…}, onPointer(type, p, s) {…} })
 *   s.start(); … s.stop();
 * Coordinates are in CSS pixels: s.w × s.h. `s.hud` is an overlay element.
 */
export function canvasStage(ctx, { aspect = 16 / 9, onFrame, onPointer, onKey, container } = {}) {
  const canvas = h('canvas');
  const hud = h('div', { class: 'hud' });
  const el = h('div', { class: 'ds-canvas', style: { aspectRatio: String(aspect) } }, canvas, hud);
  mount(ctx, { container }, el);
  const g = canvas.getContext('2d');
  const s = { el, canvas, g, hud, w: 0, h: 0, t: 0, running: false, colors: colors() };
  const resize = () => {
    const r = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.w = r.width; s.h = r.height;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.colors = colors();
    // resizing wipes the bitmap; a stopped loop would otherwise leave it blank
    if (!s.running && s.started && r.width) onFrame?.(0, g, s);
  };
  new ResizeObserver(resize).observe(el);
  resize();
  let last = 0;
  let raf = 0;
  const frame = (ts) => {
    if (!s.running) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
    last = ts; s.t += dt;
    onFrame?.(dt, g, s);
    raf = requestAnimationFrame(frame);
  };
  s.start = () => { if (s.running) return; s.running = s.started = true; last = 0; raf = requestAnimationFrame(frame); };
  s.stop = () => { s.running = false; cancelAnimationFrame(raf); };
  const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, e }; };
  if (onPointer) {
    canvas.addEventListener('pointerdown', (e) => { try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic event */ } onPointer('down', pt(e), s); });
    canvas.addEventListener('pointermove', (e) => onPointer('move', pt(e), s));
    for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => onPointer('up', pt(e), s));
  }
  if (onKey) {
    const kd = (e) => onKey('down', e, s);
    const ku = (e) => onKey('up', e, s);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) s.stop(); });
  return s;
}
