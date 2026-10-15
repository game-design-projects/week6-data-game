// #0 Presets demo — hidden from the gallery. Exercises every preset once so
// `node scripts/check.mjs 000-presets-demo` smoke-tests the whole engine, and
// doubles as a copy-paste reference for game authors.
export default {
  meta: {
    num: 0,
    slug: 'presets-demo',
    title: 'Presets Demo',
    tagline: 'Every gameplay preset the engine ships with, in one page. For development and testing only.',
    category: 'literacy',
    data: 'synthetic',
    hidden: true,
    howTo: ['Try the estimate, choice, ordering, matching, grouping and canvas mini-games in turn.', 'All the data here is made up and only used to test the engine.'],
    sources: [{ name: 'None (synthetic data)' }],
  },

  puzzle({ rng }) {
    return { n: rng.int(10, 1000), series: Array.from({ length: 4 }, (_, k) => Array.from({ length: 24 }, (_, i) => Math.sin((i + k * 3) / 4) * 10 + rng.float(0, 2))) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const r1 = await ctx.estimate({ answer: p.n, min: 1, max: 10000, log: true, unit: 'items', title: 'Estimate a number (log scale, 3 tries)', attempts: 3 });
    const r2 = await ctx.rounds({
      rounds: [
        { prompt: 'Which is bigger?', options: [{ label: '7 × 8' }, { label: '6 × 9' }], correct: 0, explain: '56 > 54' },
        { prompt: 'Pick all the primes', options: [2, 4, 7, 9, 11].map((x) => ({ label: String(x) })), correct: [0, 2, 4] },
      ],
      multi: false,
    });
    const r3 = await ctx.order({ items: [{ id: 'a', label: 'Elephant', value: 6000 }, { id: 'b', label: 'Horse', value: 500 }, { id: 'c', label: 'Cat', value: 4 }, { id: 'd', label: 'Mouse', value: 0.02 }], title: 'Order by weight', format: (v) => `${v} kg` });
    const charts = await Promise.all(p.series.map((s) => ui.plot((Plot, c) => ({ height: 90, marks: [Plot.lineY(s, { stroke: c.accent })] }), { axis: false })));
    const r4 = await ctx.match({
      left: charts.map((body, i) => ({ id: `s${i}`, body })),
      right: ['A', 'B', 'C', 'D'].map((x) => ({ id: x, label: `Series ${x}` })),
      answer: { s0: 'A', s1: 'B', s2: 'C', s3: 'D' },
      title: 'Match',
    });
    const r5 = await ctx.groups({
      groups: [
        { label: 'Fruits', items: ['Apple', 'Banana', 'Orange', 'Grape'] },
        { label: 'Planets', items: ['Mars', 'Venus', 'Jupiter', 'Saturn'] },
        { label: 'Colors', items: ['Red', 'Blue', 'Green', 'Purple'] },
        { label: 'Instruments', items: ['Piano', 'Guitar', 'Drum', 'Flute'] },
      ],
    });
    // canvas: click the dot three times
    const r6 = await new Promise((resolve) => {
      let hits = 0;
      let dot = { x: 100, y: 80 };
      const s = ctx.canvas({
        aspect: 2,
        onFrame(dt, g, st) {
          g.clearRect(0, 0, st.w, st.h);
          g.fillStyle = st.colors.accent;
          g.beginPath(); g.arc(dot.x, dot.y, 18, 0, Math.PI * 2); g.fill();
          st.hud.textContent = `Hits ${hits}/3`;
        },
        onPointer(type, pt, st) {
          if (type !== 'down') return;
          if (Math.hypot(pt.x - dot.x, pt.y - dot.y) < 24) {
            hits++;
            dot = { x: ctx.rng.float(30, st.w - 30), y: ctx.rng.float(30, st.h - 30) };
            if (hits >= 3) { s.stop(); resolve({ score: 3, max: 3, summary: 'Canvas hits 3/3' }); }
          }
        },
      });
      s.start();
      if (ctx.autoplay) setTimeout(() => { s.stop(); resolve({ score: 3, max: 3, summary: 'autoplay' }); }, 50);
    });
    return ctx.combine([r1, r2, r3, r4, r5, r6]);
  },
};
