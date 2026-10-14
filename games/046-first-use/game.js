// #46 First Use — guess the year a word first appeared in written English.
import { fmtNum } from '../../engine/core.js';

/** Score 0..1: full marks within 5 years, decays with error (scale 60 years). */
export function yearScore(guess, answer, scale = 60) {
  const err = Math.max(0, Math.abs(guess - answer) - 5);
  return Math.exp(-err / scale);
}

const era = (y) => (y < 1500 ? '中古英语时期（1500 年以前）' : y < 1700 ? '早期现代英语（莎士比亚的时代）' : y < 1800 ? '启蒙时代' : y < 1900 ? '工业革命与维多利亚时代' : '20 世纪');

export default {
  meta: {
    num: 46,
    slug: 'first-use',
    title: 'First Use',
    tagline: '给你一个英语单词和释义，猜它最早出现在书面英语里的年份。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '屏幕上是一个英语单词和它的释义。想想它描述的东西是什么时候才有的。',
      '拖动滑块或直接输入年份，每天最多 3 次机会；每次提交后会提示“更早”或“更晚”。',
      '线索：以 -ize/-ism 结尾、来自拉丁/法语的学术词多在 1500–1700；科技和日常俚语多在 19–20 世纪。',
      '误差在 5 年以内算命中；每多用一次机会扣 10%。',
    ],
    scoring: '100 × e^(−(|误差|−5)/60)，每多用一次机会 −10%。',
    sources: [
      { name: 'Wiktionary 英语词条的词源部分（“First attested in …”/etydate）', url: 'https://en.wiktionary.org/', note: '通过 MediaWiki API 抓取，仅保留词源中只出现一个年份的词条' },
      { name: 'Peter Norvig count_1w（词频）', url: 'https://norvig.com/ngrams/', note: '用于筛掉过于生僻的词' },
    ],
    dataNote: '原想直接用 Merriam-Webster 的 First Known Use，但它没有开放 API 且禁止抓取，所以改用 Wiktionary 词源里标注的最早书证年份。个别年份与 MW/OED 可能相差几年，各词典对“最早”的判定本就不同。',
  },

  puzzle({ data, pick }) {
    return { w: pick(data.words).w };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const item = ctx.data.words.find((x) => x.w === p.w);
    ctx.log('word', item.w, item.y);
    const same = ctx.data.words.filter((x) => x.w !== item.w && Math.floor(x.y / 25) === Math.floor(item.y / 25)).slice(0, 5);

    ctx.stage.append(ui.panel({ kicker: '英语单词', title: item.w },
      ui.h('p', { class: 'ink2' }, item.g),
      ui.h('div', { class: 'ds-row small mono muted' }, `词频排名 #${fmtNum(item.r)} · ${item.w.length} 个字母`)));

    const res = await ctx.estimate({
      title: '它最早出现在哪一年？',
      answer: item.y, min: 1200, max: 2000, step: 1, initial: 1700,
      format: (v) => `${Math.round(v)} 年`,
      attempts: 3, tolerance: 5,
      scoring: (g, a) => yearScore(g, a),
    });

    res.detail = ui.kv([
      ['答案', `${item.w}：${item.y} 年`],
      ['时代', era(item.y)],
      ['线索', item.y >= 1800 ? '词义指向近代才出现的事物或口语。' : '多为从拉丁语/法语借入的书面词。'],
      ['同期的词', same.length ? same.map((x) => `${x.w} (${x.y})`).join('、') : '—'],
    ]);
    return res;
  },
};
