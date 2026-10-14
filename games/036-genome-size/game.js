// #36 Genome Size — guess a genome size on a log scale. Anchors: human, fly, E. coli.

export const ANCHORS = ['人类', '黑腹果蝇', '大肠杆菌'];

/** Format a size given in megabases with a readable unit. */
export function fmtMb(mb) {
  if (mb >= 1000) return `${(mb / 1000).toLocaleString('en-US', { maximumFractionDigits: mb < 10000 ? 2 : 1 })} Gb`;
  if (mb >= 1) return `${mb.toLocaleString('en-US', { maximumFractionDigits: mb < 10 ? 1 : 0 })} Mb`;
  return `${(mb * 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} kb`;
}

/** Fold-ratio text relative to the human genome. */
export function vsHuman(mb, human) {
  const r = mb / human;
  if (r >= 1.05) return `约为人类的 ${r >= 10 ? Math.round(r) : r.toFixed(1)} 倍`;
  if (r <= 0.95) return `约为人类的 1/${Math.round(1 / r).toLocaleString('en-US')}`;
  return '和人类差不多大';
}

export default {
  meta: {
    num: 36,
    slug: 'genome-size',
    title: 'Genome Size',
    tagline: '猜一猜这个物种的基因组有多大。从病毒到洋葱，跨度超过六个数量级，按对数刻度计分。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '每天三个物种，由小到大各一个：给出它的基因组大小（单位 Mb，百万碱基对）。',
      '用滑块或直接输入。刻度是对数的：每一格差 10 倍。上方有人类、果蝇、大肠杆菌三个参照。',
      '基因组大小和“复杂度”关系不大：洋葱是人类的约 5 倍，肺鱼更是 10 倍以上；病毒与细菌则小得多。',
    ],
    scoring: '每题 100 × e^(−(log10 猜测 − log10 真值)/0.45)，差 2 倍约 51 分，差 10 倍约 11 分；三题取平均。',
    sources: [
      { name: 'NCBI Genome Reports (eukaryotes / prokaryotes / viruses)', url: 'https://ftp.ncbi.nlm.nih.gov/genomes/GENOME_REPORTS/' },
    ],
    dataNote: '数值是 NCBI 收录的组装序列总长度（同一物种所有最高质量等级组装的下四分位数），不是实验测定的 C 值，可能与教科书数字有 5% 左右的差别；二倍体组装已被尽量排除。物种清单与中文名为手工挑选。',
  },

  puzzle({ data, rng }) {
    const s = data.species;
    const third = Math.floor(s.length / 3);
    const picks = [s.slice(0, third), s.slice(third, 2 * third), s.slice(2 * third)].map((g) => rng.pick(g));
    return { items: picks };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const all = ctx.data.species;
    const byName = Object.fromEntries(all.map((x) => [x.zh, x]));
    const human = byName['人类'].mb;
    ctx.log('items', p.items.map((x) => `${x.zh}=${x.mb}`).join(', '));

    ctx.stage.append(ui.panel({ kicker: '参照物', title: '先记住这三个锚点' },
      ui.grid('140px', ...ANCHORS.map((n) => ui.stat({ label: n, value: fmtMb(byName[n].mb), sub: n === '人类' ? '≈ 30 亿碱基对' : '' })))));

    const results = [];
    for (let i = 0; i < p.items.length; i++) {
      const it = p.items[i];
      const r = await ctx.estimate({
        title: `第 ${i + 1} 题：${it.zh}`,
        prompt: ui.h('span', {}, `${it.sci}（${it.group}）。基因组有多大？输入框的单位是 Mb。`),
        answer: it.mb, min: 0.005, max: 100000, log: true,
        initial: 100, step: 0.001,
        format: fmtMb,
        scoring: (g, a) => Math.exp(-Math.abs(Math.log10(g) - Math.log10(a)) / 0.45),
      });
      results.push(r);
      ctx.log('guess', it.zh, r.guess, it.mb, r.score);
    }

    const res = ctx.combine(results);
    res.detail = ui.panel({ plain: true },
      ui.table({
        columns: [{ key: 'zh', label: '物种' }, { key: 'size', label: '真值', num: true }, { key: 'guess', label: '你的', num: true }, { key: 'rel', label: '对比人类' }],
        rows: p.items.map((it, i) => ({ zh: it.zh, size: fmtMb(it.mb), guess: fmtMb(results[i].guess), rel: vsHuman(it.mb, human) })),
      }),
      ui.callout('规律：基因组大小与生物复杂度几乎无关（C 值悖论）。细菌多在 1–10 Mb，真菌 10–50 Mb，昆虫、鱼类 0.1–2 Gb，哺乳动物约 3 Gb，而洋葱、小麦、肺鱼等因重复序列和多倍体可达 15–35 Gb。'));
    return res;
  },
};
