// #0 Presets demo — hidden from the gallery. Exercises every preset once so
// `node scripts/check.mjs 000-presets-demo` smoke-tests the whole engine, and
// doubles as a copy-paste reference for game authors.
export default {
  meta: {
    num: 0,
    slug: 'presets-demo',
    title: 'Presets Demo',
    tagline: '引擎自带的全部玩法预设，一页走完。只用于开发和测试。',
    category: 'literacy',
    data: 'synthetic',
    hidden: true,
    howTo: ['依次体验估数、选择、排序、配对、分组和画布小游戏。', '这里的数据都是编的，只用于测试引擎。'],
    sources: [{ name: '无（合成数据）' }],
  },

  puzzle({ rng }) {
    return { n: rng.int(10, 1000), series: Array.from({ length: 4 }, (_, k) => Array.from({ length: 24 }, (_, i) => Math.sin((i + k * 3) / 4) * 10 + rng.float(0, 2))) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const r1 = await ctx.estimate({ answer: p.n, min: 1, max: 10000, log: true, unit: '个', title: '估数（对数刻度，3 次机会）', attempts: 3 });
    const r2 = await ctx.rounds({
      rounds: [
        { prompt: '哪个更大？', options: [{ label: '7 × 8' }, { label: '6 × 9' }], correct: 0, explain: '56 > 54' },
        { prompt: '选出所有质数', options: [2, 4, 7, 9, 11].map((x) => ({ label: String(x) })), correct: [0, 2, 4] },
      ],
      multi: false,
    });
    const r3 = await ctx.order({ items: [{ id: 'a', label: '大象', value: 6000 }, { id: 'b', label: '马', value: 500 }, { id: 'c', label: '猫', value: 4 }, { id: 'd', label: '老鼠', value: 0.02 }], title: '按体重排序', format: (v) => `${v} kg` });
    const charts = await Promise.all(p.series.map((s) => ui.plot((Plot, c) => ({ height: 90, marks: [Plot.lineY(s, { stroke: c.accent })] }), { axis: false })));
    const r4 = await ctx.match({
      left: charts.map((body, i) => ({ id: `s${i}`, body })),
      right: ['A', 'B', 'C', 'D'].map((x) => ({ id: x, label: `序列 ${x}` })),
      answer: { s0: 'A', s1: 'B', s2: 'C', s3: 'D' },
      title: '配对',
    });
    const r5 = await ctx.groups({
      groups: [
        { label: '水果', items: ['苹果', '香蕉', '橙子', '葡萄'] },
        { label: '行星', items: ['火星', '金星', '木星', '土星'] },
        { label: '颜色', items: ['红', '蓝', '绿', '紫'] },
        { label: '乐器', items: ['钢琴', '吉他', '鼓', '笛子'] },
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
          st.hud.textContent = `命中 ${hits}/3`;
        },
        onPointer(type, pt, st) {
          if (type !== 'down') return;
          if (Math.hypot(pt.x - dot.x, pt.y - dot.y) < 24) {
            hits++;
            dot = { x: ctx.rng.float(30, st.w - 30), y: ctx.rng.float(30, st.h - 30) };
            if (hits >= 3) { s.stop(); resolve({ score: 3, max: 3, summary: '画布命中 3/3' }); }
          }
        },
      });
      s.start();
      if (ctx.autoplay) setTimeout(() => { s.stop(); resolve({ score: 3, max: 3, summary: 'autoplay' }); }, 50);
    });
    return ctx.combine([r1, r2, r3, r4, r5, r6]);
  },
};
