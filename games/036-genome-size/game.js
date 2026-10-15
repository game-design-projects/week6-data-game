// #36 Genome Size — guess a genome size on a log scale. Anchors: human, fly, E. coli.

export const ANCHORS = ['人类', '黑腹果蝇', '大肠杆菌'];
const ANCHOR_SCI = ['Homo sapiens', 'Drosophila melanogaster', 'Escherichia coli'];
export const SCORE_K = 0.45; // log10 units: 2x off -> ~51 pts, 10x off -> ~11 pts

/** 0..1 score of a guess vs the truth, both in Mb. */
export function scoreOf(guess, answer) {
  return Math.exp(-Math.abs(Math.log10(guess) - Math.log10(answer)) / SCORE_K);
}

/** Group -> sorted sizes (Mb) over the whole pool. */
export function groupStats(species) {
  const g = {};
  for (const s of species) (g[s.group] ??= []).push(s.mb);
  return g;
}

/** Specific teaching sentence for one species: typical range of its group + nearest anchor. */
export function explain(it, species, anchors) {
  const sizes = (groupStats(species)[it.group] ?? []).sort((a, b) => a - b);
  const parts = [];
  if (sizes.length >= 4) {
    parts.push(`题库里的「${it.group}」共 ${sizes.length} 种，基因组从 ${fmtMb(sizes[0])} 到 ${fmtMb(sizes[sizes.length - 1])}，中位数 ${fmtMb(sizes[sizes.length >> 1])}；${it.zh}是 ${fmtMb(it.mb)}。`);
  } else parts.push(`${it.zh}（${it.group}）的基因组是 ${fmtMb(it.mb)}。`);
  const near = anchors.map((a) => ({ a, d: Math.abs(Math.log10(it.mb / a.mb)) })).sort((x, y) => x.d - y.d)[0];
  const r = it.mb / near.a.mb;
  const ref = `${near.a.zh}（${fmtMb(near.a.mb)}）`;
  parts.push(r >= 1.15 ? `大约是${ref}的 ${r >= 10 ? Math.round(r) : r.toFixed(1)} 倍。` : r <= 0.65 ? `大约是${ref}的 1/${Math.round(1 / r)}。` : `和${ref}差不多大（${r < 1 ? '略小' : '略大'}）。`);
  if (it.note) parts.push(it.note);
  return parts.join('');
}

export const GROUP_HINT = {
  病毒: '病毒基因组最小，多在 3–200 kb；巨型病毒（拟菌、潘多拉）才逼近细菌。',
  细菌: '细菌基因组几乎都在 0.5–10 Mb，大致与基因数成正比，致病菌多在 2–6 Mb。',
  古菌: '古菌基因组与细菌同量级，1–5 Mb。',
};

/** Format a size given in megabases with a readable unit. */
export function fmtMb(mb) {
  if (mb >= 1000) return `${(mb / 1000).toLocaleString('en-US', { maximumFractionDigits: mb < 10000 ? 2 : 1 })} Gb`;
  if (mb >= 1) return `${mb.toLocaleString('en-US', { maximumFractionDigits: mb < 10 ? 1 : 0 })} Mb`;
  return `${(mb * 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} kb`;
}

/** Fold-ratio text relative to the human genome. */
export function vsHuman(mb, human) {
  const r = mb / human;
  if (r >= 1.15) return `约为人类的 ${r >= 10 ? Math.round(r) : r.toFixed(1)} 倍`;
  if (r <= 0.65) return `约为人类的 1/${Math.round(1 / r).toLocaleString('en-US')}`;
  return r < 0.9 ? '比人类略小' : r > 1.1 ? '比人类略大' : '和人类差不多大';
}

export default {
  meta: {
    num: 36,
    slug: 'genome-size',
    title: 'Genome Size',
    tagline: '猜一猜这个物种的基因组有多大。从病毒到肺鱼，跨度超过七个数量级，按对数刻度计分。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '每天三个物种，由小到大各一个：猜它的基因组大小（Mb，百万碱基对）。',
      '用滑块或直接输入（输入框的单位固定是 Mb，0.01 Mb = 10 kb）。滑块是对数刻度：每一大格差 10 倍。上方有人类、果蝇、大肠杆菌三个参照。',
      '基因组大小和“复杂度”关系不大：洋葱约是人类的 5 倍，肺鱼超过 10 倍；病毒与细菌则小得多。先判断它属于哪一类，再对照参照物。',
    ],
    scoring: '每题 100 × e^(−|log10 猜测 − log10 真值| / 0.45)：差 2 倍约 51 分，差 10 倍约 11 分，差 100 倍几乎 0 分；三题总分 300。',
    sources: [
      { name: 'NCBI Genome Reports（真核生物 / 原核生物 / 病毒）', url: 'https://ftp.ncbi.nlm.nih.gov/genomes/GENOME_REPORTS/' },
    ],
    dataNote: '数值是 NCBI 收录的基因组组装总长度，不是实验测定的 C 值，可能与教科书数字差 5–20%：每个物种先去掉线粒体、单条染色体等残缺条目，优先取染色体级别的组装，再用下四分位数附近的组装的中位数，以避开二倍体合并的“双倍”组装。组装明显不完整的物种（如挪威云杉）已剔除。物种清单（约 280 种）与中文名为手工挑选。数据为快照：NCBI 报告文件 200 多 MB，不适合浏览器实时读取，REST 接口（api.ncbi.nlm.nih.gov/datasets）也不支持浏览器跨域调用，因此用 build/ 脚本离线生成。',
  },

  puzzle({ data, pick }) {
    const s = data.species.filter((x) => !ANCHOR_SCI.includes(x.sci));
    const third = Math.floor(s.length / 3);
    const tiers = [s.slice(0, third), s.slice(third, 2 * third), s.slice(2 * third)];
    return { items: tiers.map((t) => pick(t)) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const all = ctx.data.species;
    const anchors = ANCHOR_SCI.map((sci, i) => ({ ...all.find((x) => x.sci === sci), zh: ANCHORS[i] }));
    const human = anchors[0].mb;
    ctx.log('items', p.items.map((x) => `${x.zh}=${x.mb}`).join(', '));

    ctx.stage.append(ui.panel({ kicker: '参照物', title: '先记住这三个锚点' },
      ui.grid('140px', ...anchors.map((a) => ui.stat({ label: a.zh, value: fmtMb(a.mb), sub: a.zh === '人类' ? '≈ 30 亿碱基对' : '' })))));

    const results = [];
    for (let i = 0; i < p.items.length; i++) {
      const it = p.items[i];
      const r = await ctx.estimate({
        title: `第 ${i + 1} 题：${it.zh}`,
        prompt: ui.h('span', {}, `${it.sci}（${it.group}）。基因组有多大？输入框的单位是 Mb。`),
        answer: it.mb, min: 0.001, max: 100000, log: true,
        initial: 100, step: 0.001,
        format: fmtMb,
        scoring: scoreOf,
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
      ...p.items.map((it, i) => ui.callout(`${it.zh}：${explain(it, all, anchors)}${GROUP_HINT[it.group] ? ' ' + GROUP_HINT[it.group] : ''}`, results[i].score >= 50 ? 'good' : undefined)),
      ui.callout('规律：基因组大小与生物复杂度几乎无关（C 值悖论）。细菌多在 1–10 Mb，真菌 10–50 Mb，昆虫、鱼类 0.1–2 Gb，哺乳动物约 3 Gb，而洋葱、小麦、肺鱼等因重复序列和多倍体可达 15–35 Gb。'));
    return res;
  },
};
