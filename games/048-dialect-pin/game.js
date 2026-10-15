// #48 Dialect Pin — the NYT dialect quiz run backwards: read five answers, name the state they grew up in.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Naive-Bayes share (0..1) of each state given [[qid, optionKey], …] (uniform prior, +1% smoothing). */
export function posterior(data, picks) {
  const codes = Object.keys(data.states);
  const ll = codes.map((c) => picks.reduce((a, [q, k]) => a + Math.log((data.questions[q].opts[k].p[c] ?? 0) / 100 + 0.01), 0));
  const mx = Math.max(...ll);
  const ex = ll.map((v) => Math.exp(v - mx));
  const z = ex.reduce((a, b) => a + b, 0);
  return Object.fromEntries(codes.map((c, i) => [c, ex[i] / z]));
}

/** Per-clue "tell": how many times more common the answer is in the true state than the 48-state average. */
export function clueLifts(data, st, clues) {
  return clues.map(([q, k]) => {
    const o = data.questions[q].opts[k];
    const mine = o.p[st] / 100;
    return { q, k, mine, nat: o.nat, lift: mine / Math.max(o.nat, 0.005) };
  });
}

/** Top-n states by posterior after all given picks (the "lookalikes"), excluding `skip`. */
export function lookalikes(data, picks, skip, n = 2) {
  return Object.entries(posterior(data, picks)).filter(([c]) => c !== skip).sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Clue lines to scan for answer leaks: everything the player sees before guessing. */
export function clueTexts(data, p) {
  return [...p.clues.map(([q, k]) => `${data.questions[q].zh} ${data.questions[q].opts[k].t}`)];
}

/** How many answers are visible after `n` guesses have been made (2 at the start, +1 per wrong guess, max 5). */
export const visibleAnswers = (n) => Math.min(5, n + 2);

export default {
  meta: {
    num: 48,
    slug: 'dialect-pin',
    title: 'Dialect Pin',
    tagline: '把方言测验倒过来玩：看一个人怎么回答 soda 还是 pop，猜他在美国哪个州长大。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '哈佛方言调查问了美国人上百个用词问题：汽水叫 soda 还是 pop？斜对面叫 kitty-corner 还是 catty-corner？',
      '一开始你只看到一位说话人的 2 个回答。每猜错一次，多揭开一个回答，最多 6 次。',
      '每次猜测会告诉你该州离答案多远、在哪个方向，以及「像不像」：只看已揭开的回答，这个州的人这样说的可能性占 48 州的多少。猜过的州会涂在下方地图上，揭晓后地图才显示地名。',
      '诀窍：找「某个地区独有」的说法，比如 y\'all、buggy、bubbler、rolling，它们比 sneakers 或 soda 这类到处都有的词有用得多。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Harvard Dialect Survey（Bert Vaux & Scott Golder, 2003）', url: 'http://www4.uwm.edu/FLL/linguistics/dialect/maps.html', note: '各州回答比例' },
      { name: 'asucbi/BDSR2 上的各州结果文本镜像', url: 'https://github.com/asucbi/BDSR2/tree/main/proc/hds', note: '本游戏实际下载处（原站目前难以访问）' },
    ],
    dataNote: '这是 2003 年的静态调查，没有提供实时接口（原站 uwm.edu 不稳定，也无 CORS/API），所以用快照。数据是各州回答比例，不是某个真人的完整问卷。「说话人」是用该州最有辨识度的 5 个说法拼出的一个典型代表（比该州比例≥12%、且至少是全国均值 1.7 倍的选项）。原调查没有阿拉斯加、夏威夷和华盛顿特区，也有 5 个州因说法太接近全国平均而不出题。每个州最多 4 套线索，共 145 题（轮完前不重复）；每套线索合起来要让真实州在 48 州里排进前 4。题目只选用词类问题，读音类题的音标在镜像中丢失。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { st: p.st, clues: p.clues, rank: p.rank };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const S = D.states;
    const Q = D.questions;
    const ans = S[p.st];
    const line = ([q, k]) => ui.h('div', { style: { marginBottom: '4px' } },
      ui.h('span', { class: 'muted small' }, Q[q].zh, '：'), ' ', ui.h('b', `“${Q[q].opts[k].t}”`));
    const clues = [
      ui.h('div', { class: 'ds-stack' }, ui.h('div', { class: 'small muted' }, '一位说话人这样回答：'), line(p.clues[0]), line(p.clues[1])),
      ...p.clues.slice(2).map(line),
      `地区：美国${{ NE: '东北部', S: '南部', MW: '中西部', W: '西部' }[ans.reg]}。`,
    ];
    const options = Object.entries(S).map(([c, s]) => ({ id: c, label: s.zh, hint: `${s.en} · ${c}`, aliases: [c, s.en] }));
    let calls = 0;
    const tried = [];
    const mapper = makeMap(ctx, S);
    const gp = ctx.guess({
      title: '他在哪个州长大？',
      placeholder: '输入州名，如 TX 或 Texas…',
      options,
      answer: p.st,
      maxGuesses: 6,
      clues,
      cluesTitle: '说话人的回答',
      columns: ['距离', '方向', '像不像'],
      near: (g, a) => haversineKm(S[g.id], S[a.id]) < 450,
      feedback: (g) => {
        calls++;
        tried.push(g.id);
        mapper.update(tried, g.id === p.st ? p.st : null);
        const shown = p.clues.slice(0, visibleAnswers(calls - 1));
        const post = posterior(D, shown)[g.id];
        ctx.log('guess', { g: g.id, shown: shown.length, post: +post.toFixed(3) });
        const pct = `${Math.round(post * 100)}%`;
        const fit = { text: pct, num: true, state: post >= 0.25 ? 'hit' : post >= 0.08 ? 'near' : undefined };
        if (g.id === p.st) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, fit];
        const km = haversineKm(S[g.id], ans);
        return [{ text: fmtKm(km), num: true, state: km < 450 ? 'near' : undefined }, { text: arrow(bearingDeg(S[g.id], ans)) }, fit];
      },
    });
    mapper.mount(gp);
    const res = await gp;
    mapper.update(tried, p.st, true);

    const lifts = clueLifts(D, p.st, p.clues);
    const best = lifts.reduce((a, b) => (b.lift > a.lift ? b : a));
    const weak = lifts.reduce((a, b) => (b.lift < a.lift ? b : a));
    const rows = p.clues.map(([q, k], i) => {
      const o = Q[q].opts[k];
      const top = Object.entries(o.p).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${S[c].zh} ${v}%`).join('、');
      return { q: Q[q].zh, a: o.t, mine: `${o.p[p.st]}%`, nat: `${(o.nat * 100).toFixed(0)}%`, lift: `×${lifts[i].lift.toFixed(1)}`, top };
    });
    const like = lookalikes(D, p.clues, p.st, 2).map(([c, v]) => `${S[c].zh}（${Math.round(v * 100)}%）`).join('、');
    const bq = Q[best.q];
    const wq = Q[weak.q];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.zh}（${ans.en}，${p.st}）。判断一个州，看的是回答占比比全国均值高多少倍（“倍数”一列）：`),
      ui.table({
        columns: [{ key: 'q', label: '问题' }, { key: 'a', label: '回答' }, { key: 'mine', label: ans.zh, num: true }, { key: 'nat', label: '州均值', num: true }, { key: 'lift', label: '倍数', num: true }, { key: 'top', label: '最高的三个州' }],
        rows,
      }),
      ui.callout(`本题最大的破绽是“${bq.zh}”答“${bq.opts[best.k].t}”：${ans.zh}有 ${(best.mine * 100).toFixed(0)}% 的人这样说，是全国均值的 ${best.lift.toFixed(1)} 倍；最没用的是“${wq.zh}”答“${wq.opts[weak.k].t}”（仅 ×${weak.lift.toFixed(1)}）。`),
      ui.callout(`5 个回答合起来，${ans.zh}的可能性占 48 州的 ${Math.round(posterior(D, p.clues)[p.st] * 100)}%，排名第 ${p.rank}；最容易混淆的邻居是${like}。`));
    ctx.log('done', { st: p.st, score: res.score });
    return res;
  },
};

/**
 * Small US map under the guess panel: every guessed state is shaded, the answer is revealed on the last step.
 * Basemap is label-free while guessing; labels only after the reveal. Never throws (the game works without it).
 */
function makeMap(ctx, S) {
  const byName = Object.fromEntries(Object.entries(S).map(([c, s]) => [s.en, c]));
  let api = null;
  let pending = null;
  let layers = {};
  const paint = () => {
    if (!api || !pending) return;
    const col = ctx.ui.colors();
    const { tried, answer, final } = pending;
    for (const [c, l] of Object.entries(layers)) {
      const guessed = tried.includes(c);
      const hit = answer === c && (final || guessed);
      l.setStyle({
        fillOpacity: hit ? 0.7 : guessed ? 0.4 : 0.04,
        fillColor: hit ? col.hit : col.near,
        color: guessed || hit ? col.ink2 : col.muted,
        weight: guessed || hit ? 1.6 : 0.6,
      });
    }
    if (final) api.setLabels(true);
  };
  return {
    update(tried, answer, final = false) { pending = { tried: [...tried], answer, final }; paint(); },
    async mount(guessPromise) {
      try {
        await ctx.sleep(0);
        const box = ctx.ui.panel({ kicker: '地图', title: '你猜过的州' });
        ctx.stage.append(box);
        const m = await ctx.ui.createMap({ bounds: [[24.3, -125.5], [49.8, -66.2]], height: 340, minZoom: 3, maxZoom: 6 });
        box.append(m.el);
        const gj = await ctx.ui.geo('states');
        for (const f of gj.features) {
          const c = byName[f.properties?.name];
          if (!c) continue;
          layers[c] = m.L.geoJSON(f, { style: { fillOpacity: 0.04, weight: 0.6, color: '#888' }, interactive: false }).addTo(m.map);
          layers[c].setStyle = layers[c].setStyle.bind(layers[c]);
        }
        api = m;
        paint();
        ctx.log('map ready', { states: Object.keys(layers).length });
      } catch (e) {
        ctx.log.warn('map failed', String(e));
      }
    },
  };
}
