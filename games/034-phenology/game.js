// #34 Phenology — a species' weekly observation curve in one country; name the species,
// then predict when the same species peaks in another country.

const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Month/day label for the start of week w (1..52) of a non-leap year. */
export function weekDate(w) {
  let doy = (w - 1) * 7;
  let m = 0;
  while (doy >= MD[m]) { doy -= MD[m]; m++; }
  return { m: m + 1, d: doy + 1 };
}
export const weekLabel = (w) => { const { m, d } = weekDate(w); return `第 ${w} 周 · ${m} 月 ${d} 日前后`; };
/** Circular distance between two weeks of the year (0..26). */
export const weekDist = (a, b) => { const d = Math.abs(a - b) % 52; return Math.min(d, 52 - d); };
/** Score 0..1: full marks on the exact week, ~0.37 at 6 weeks off. */
/** Number of weeks at or above half of the peak (0..100 normalised curve). */
export const seasonWidth = (c) => c.filter((v) => v >= 50).length;
export const weekScore = (guess, answer) => Math.exp(-weekDist(guess, answer) / 6);

const GROUP_ZH = { Aves: '鸟类', Insecta: '昆虫', Plantae: '植物', Fungi: '真菌', Reptilia: '爬行动物', Amphibia: '两栖动物', Mammalia: '哺乳动物' };
const SOUTH = new Set(['AU', 'NZ']);
const name = (s) => s.zh || s.en || s.sci;

export default {
  meta: {
    num: 34,
    slug: 'phenology',
    title: 'Phenology',
    tagline: '某物种在某个国家一年里每周被观测到的曲线。先认出它是谁，再预测它在另一个国家什么时候最热闹。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '图里是 iNaturalist 公民科学家一年里观测到某个物种的相对频率（已除以同类生物的总观测量，扣掉“夏天人人出门拍照”的偏差）。',
      '第一步：从 5 个同类物种里选出这条曲线属于谁。高峰窄说明季节性强（迁徙鸟、开花期），高峰宽说明常年可见。',
      '第二步：同一物种在另一个国家的观测高峰在第几周？注意南北半球的季节是反的，纬度不同高峰也会前后挪动。',
      '第一步答对得 1/3，第二步按周数误差计分：差 0 周满分，差约 6 周降到约三分之一（首尾相接按环形计算）。',
    ],
    scoring: '第一步 33 分（选对）；第二步 67 × e^(−周差/6)。',
    sources: [
      { name: 'iNaturalist API · observations/histogram（research grade）', url: 'https://api.inaturalist.org/v1/docs/#!/Observations/get_observations_histogram' },
      { name: 'iNaturalist API · observations/species_counts', url: 'https://api.inaturalist.org/v1/docs/#!/Observations/get_observations_species_counts' },
    ],
    dataNote: '快照数据（95 道题、132 个物种，鸟类、昆虫、植物、两栖类）：美国、加拿大、英国、澳大利亚、新西兰五个地区的 research-grade 观测，按“物种每周观测数 ÷ 同地区同类生物每周观测总数”归一化后做 3 周平滑。曲线反映的是“被人观测到”的季节，并不严格等于物种的生理物候。第二步只选“按同半球同周、跨半球加半年”这类朴素猜法也会错 3 周以上的题，所以得靠对物种的了解。没有做成实时：这是按年份汇总的季节曲线，每天变化很小，没有必要实时抓取。照片版权归原作者，来自 iNaturalist。',
  },

  puzzle({ data, rng, pick }) {
    const p = pick(data.puzzles);
    return { s: p.s, a: p.a, b: p.b, o: rng.shuffle([p.s, ...p.o]) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const sp = ctx.data.species;
    const ans = sp[p.s];
    const A = ans.curves[p.a], B = ans.curves[p.b];
    const places = ctx.data.places;
    ctx.log('phenology', { species: ans.sci, a: p.a, b: p.b, peakA: A.peak, peakB: B.peak });

    const rows = (c, label) => c.c.map((v, i) => ({ w: i + 1, v, label }));
    const ticks = Array.from({ length: 12 }, (_, i) => Array.from({ length: 52 }, (_, k) => k + 1).find((w) => weekDate(w).m === i + 1 && weekDate(w).d <= 7));
    const monthOf = (w) => `${weekDate(w).m}月`;
    const ticks2 = ticks.filter((_, i) => i % 2 === 0);
    const chart = (series, height = 220) => ui.plot((Plot, c) => ({
      height, marginLeft: 12,
      x: { domain: [1, 52], ticks: ticks2, tickFormat: monthOf, label: null },
      y: { axis: null, domain: [0, 105] },
      marks: [
        Plot.areaY(series[0].rows, { x: 'w', y: 'v', fill: c.accent, fillOpacity: 0.18, curve: 'monotone-x' }),
        ...series.map((s, i) => Plot.lineY(s.rows, { x: 'w', y: 'v', stroke: [c.accent, c.ink][i], strokeWidth: 2.5, curve: 'monotone-x' })),
        Plot.tip(series[0].rows, Plot.pointerX({ x: 'w', y: 'v', title: (d) => `${weekLabel(d.w)}\n相对频率 ${d.v}%` })),
      ],
    }), { height });

    ctx.stage.append(ui.panel(
      { kicker: `${places[p.a]}（${SOUTH.has(p.a) ? '南' : '北'}半球）· 一年 52 周`, title: '这是谁的季节？' },
      await chart([{ label: places[p.a], rows: rows(A) }]),
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px', marginTop: '12px' } },
        ui.stat({ label: '类群', value: GROUP_ZH[ans.g] || ans.g }),
        ui.stat({ label: '观测数', value: core.fmtNum(A.n), sub: '研究级' })),
    ));

    const r1 = await ctx.rounds({
      title: '第一步：认出物种',
      rounds: [{
        prompt: `同属“${GROUP_ZH[ans.g] || ans.g}”，哪一个在${places[p.a]}的曲线是这样？`,
        options: p.o.map((id) => ({ label: name(sp[id]), sub: sp[id].sci })),
        correct: p.o.indexOf(p.s),
        explain: `${name(ans)}（${ans.sci}）在${places[p.a]}的高峰在 ${weekLabel(A.peak)}。`,
      }],
    });
    ctx.log('stage1', r1.score);

    ctx.stage.append(ui.callout(`${name(ans)} 在${places[p.a]}的高峰是 ${weekLabel(A.peak)}。同一个物种在${places[p.b]}（${SOUTH.has(p.b) ? '南' : '北'}半球）呢？`));
    const r2 = await ctx.estimate({
      title: `第二步：它在${places[p.b]}什么时候最热闹？`,
      answer: B.peak, min: 1, max: 52, step: 1, initial: 26, attempts: 1,
      scoring: weekScore, format: (v) => weekLabel(Math.round(v)),
    });
    ctx.log('stage2', { guess: r2.guess, answer: B.peak });

    const res = ctx.combine([
      { ...r1, score: r1.score * 33, max: 33 },
      { ...r2, score: r2.score * 0.67, max: 67 },
    ]);
    const shift = weekDist(A.peak, B.peak);
    const wA = seasonWidth(A.c), wB = seasonWidth(B.c);
    const signed = ((B.peak - A.peak + 78) % 52) - 26;
    const cross = SOUTH.has(p.a) !== SOUTH.has(p.b);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ans.photo ? ui.h('img', { src: `https://inaturalist-open-data.s3.amazonaws.com/photos/${ans.photo.id}/medium.jpeg`, alt: ans.sci, onerror: (e) => { e.target.style.display = 'none'; }, style: { width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: 'var(--radius, 8px)' } }) : null,
      ui.kv([
        ['物种', `${name(ans)}（${ans.sci}）`],
        [`${places[p.a]}高峰`, weekLabel(A.peak)],
        [`${places[p.b]}高峰`, weekLabel(B.peak)],
        ['相差', `${shift} 周${cross ? '，南北半球季节相反' : ''}`],
        ['怎么看出来', `${places[p.a]}的曲线有 ${wA} 周高于峰值的一半（${wA <= 8 ? '窄峰，季节性很强' : wA <= 16 ? '中等宽度的季节' : '宽峰，常年可见'}），高峰在第 ${A.peak} 周。${places[p.b]}${cross ? `在对面半球，季节反过来，两地高峰相隔 ${shift} 周（整半年是 26 周）` : shift <= 2 ? '与它几乎同步' : `比${places[p.a]}${signed > 0 ? '晚' : '早'} ${shift} 周`}，高峰第 ${B.peak} 周，宽度 ${wB} 周。`],
        ['照片', ans.photo ? `${ans.photo.by || 'iNaturalist 用户'} · ${String(ans.photo.lic).toUpperCase()}` : '—'],
      ]),
      await chart([{ label: places[p.b], rows: rows(B) }, { label: places[p.a], rows: rows(A) }], 200),
      ui.h('div', { class: 'small muted' }, `彩线 ${places[p.b]}，白线 ${places[p.a]}。` + (cross ? '跨过赤道，季节差约半年。' : '同半球，高峰随纬度、海拔和气候前后挪几周。')));
    return res;
  },
};
