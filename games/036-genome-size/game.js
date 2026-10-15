// #36 Genome Size — guess a genome size on a log scale. Anchors: human, fly, E. coli.

export const ANCHORS = ['Human', 'Fruit fly', 'E. coli'];
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
    parts.push(`The pool has ${sizes.length} species in "${it.group}", with genomes from ${fmtMb(sizes[0])} to ${fmtMb(sizes[sizes.length - 1])} (median ${fmtMb(sizes[sizes.length >> 1])}). ${it.name} is ${fmtMb(it.mb)}. `);
  } else parts.push(`${it.name} (${it.group}) has a ${fmtMb(it.mb)} genome. `);
  const near = anchors.map((a) => ({ a, d: Math.abs(Math.log10(it.mb / a.mb)) })).sort((x, y) => x.d - y.d)[0];
  const r = it.mb / near.a.mb;
  const ref = `${near.a.name} (${fmtMb(near.a.mb)})`;
  parts.push(r >= 1.15 ? `About ${r >= 10 ? Math.round(r) : r.toFixed(1)}× ${ref}.` : r <= 0.65 ? `About 1/${Math.round(1 / r)} of ${ref}.` : `About the size of ${ref} (${r < 1 ? 'slightly smaller' : 'slightly larger'}).`);
  if (it.note) parts.push(it.note);
  return parts.join('').replace(/ +/g, ' ').trim();
}

export const GROUP_HINT = {
  Viruses: 'Viral genomes are the smallest, mostly 3-200 kb; only giant viruses (mimivirus, pandoravirus) rival bacteria.',
  Bacteria: 'Bacterial genomes almost all fall between 0.5 and 10 Mb, roughly proportional to gene count; most pathogens sit at 2-6 Mb.',
  Archaea: 'Archaeal genomes are the same scale as bacterial ones, 1-5 Mb.',
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
  if (r >= 1.15) return `${r >= 10 ? Math.round(r) : r.toFixed(1)}× the human genome`;
  if (r <= 0.65) return `1/${Math.round(1 / r).toLocaleString('en-US')} of the human genome`;
  return r < 0.9 ? 'Slightly smaller than human' : r > 1.1 ? 'Slightly larger than human' : 'About human-sized';
}

export default {
  meta: {
    num: 36,
    slug: 'genome-size',
    title: 'Genome Size',
    tagline: 'Guess how big this species\' genome is. From viruses to lungfish it spans more than seven orders of magnitude, scored on a log scale.',
    category: 'science',
    data: 'snapshot',
    howTo: [
      'Three species a day, one small, one medium, one large: guess each genome\'s size in Mb (megabase pairs).',
      'Use the slider or type a value (the box is always in Mb; 0.01 Mb = 10 kb). The slider is logarithmic: each major tick is 10× the last. Human, fruit fly and E. coli are shown as reference points.',
      'Genome size has little to do with "complexity": an onion has about 5× the human genome and a lungfish over 10×, while viruses and bacteria are far smaller. Work out which group it belongs to, then compare with the references.',
    ],
    scoring: 'Each question: 100 × e^(−|log10 guess − log10 truth| / 0.45). 2× off is about 51 points, 10× off about 11, 100× off nearly 0. Three questions, 300 max.',
    sources: [
      { name: 'NCBI Genome Reports (eukaryotes / prokaryotes / viruses)', url: 'https://ftp.ncbi.nlm.nih.gov/genomes/GENOME_REPORTS/' },
    ],
    dataNote: 'Values are total assembly lengths recorded by NCBI, not lab-measured C-values, so they can differ from textbook numbers by 5-20%. For each species we drop organelle and single-chromosome fragments, prefer chromosome-level assemblies, then take the median of assemblies near the lower quartile to avoid doubled diploid assemblies. Species with clearly incomplete assemblies (such as Norway spruce) were left out. The species list (about 280) and common names are hand-picked. Snapshot data: the NCBI report files are 200+ MB and the REST API (api.ncbi.nlm.nih.gov/datasets) does not allow browser cross-origin calls, so the build/ scripts generate it offline.',
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
    const anchors = ANCHOR_SCI.map((sci, i) => ({ ...all.find((x) => x.sci === sci), name: ANCHORS[i] }));
    const human = anchors[0].mb;
    ctx.log('items', p.items.map((x) => `${x.name}=${x.mb}`).join(', '));

    ctx.stage.append(ui.panel({ kicker: 'References', title: 'Keep these three anchors in mind' },
      ui.grid('140px', ...anchors.map((a) => ui.stat({ label: a.name, value: fmtMb(a.mb), sub: a.name === 'Human' ? '≈ 3 billion base pairs' : '' })))));

    const results = [];
    for (let i = 0; i < p.items.length; i++) {
      const it = p.items[i];
      const r = await ctx.estimate({
        title: `Question ${i + 1}: ${it.name}`,
        prompt: ui.h('span', {}, `${it.sci} (${it.group}). How big is its genome? The box is in Mb.`),
        answer: it.mb, min: 0.001, max: 100000, log: true,
        initial: 100, step: 0.001,
        format: fmtMb,
        scoring: scoreOf,
      });
      results.push(r);
      ctx.log('guess', it.name, r.guess, it.mb, r.score);
    }

    const res = ctx.combine(results);
    res.detail = ui.panel({ plain: true },
      ui.table({
        columns: [{ key: 'name', label: 'Species' }, { key: 'size', label: 'Actual', num: true }, { key: 'guess', label: 'Yours', num: true }, { key: 'rel', label: 'vs. human' }],
        rows: p.items.map((it, i) => ({ name: it.name, size: fmtMb(it.mb), guess: fmtMb(results[i].guess), rel: vsHuman(it.mb, human) })),
      }),
      ...p.items.map((it, i) => ui.callout(`${it.name}: ${explain(it, all, anchors)}${GROUP_HINT[it.group] ? ' ' + GROUP_HINT[it.group] : ''}`, results[i].score >= 50 ? 'good' : undefined)),
      ui.callout('The pattern: genome size barely tracks organismal complexity (the C-value paradox). Bacteria are mostly 1-10 Mb, fungi 10-50 Mb, insects and fish 0.1-2 Gb, mammals about 3 Gb, while onion, wheat and lungfish reach 15-35 Gb thanks to repeats and polyploidy.'));
    return res;
  },
};
