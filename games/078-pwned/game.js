// #78 Pwned — which password has leaked more often? Counts from Have I Been Pwned (k-anonymity range API).
export const ROUNDS = 8;

/** Pick `n` disjoint pairs whose counts differ by at least `minRatio`, harder as the day goes on. */
export function makePairs(items, rng, n = ROUNDS, minRatio = 1.25) {
  const pool = rng.shuffle(items.slice());
  const pairs = [];
  const used = new Set();
  for (const a of pool) {
    if (pairs.length >= n) break;
    if (used.has(a.p)) continue;
    const want = pairs.length < 3 ? 6 : pairs.length < 6 ? 2.5 : minRatio; // min-ratio target; easy → hard
    const cand = pool.filter((b) => !used.has(b.p) && b.p !== a.p && Math.max(a.n, b.n) / Math.min(a.n, b.n) >= minRatio && Math.max(a.n, b.n) / Math.min(a.n, b.n) <= Math.max(want * 3, 4));
    const b = cand.find((x) => Math.max(a.n, x.n) / Math.min(a.n, x.n) >= want) || cand[0];
    if (!b) continue;
    used.add(a.p); used.add(b.p);
    pairs.push(rng.chance(0.5) ? [a, b] : [b, a]);
  }
  return pairs;
}

export default {
  meta: {
    num: 78,
    slug: 'pwned',
    title: 'Pwned',
    tagline: '两个常见密码，哪个在泄露数据库里出现得更多？',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '每轮给出两个真实存在的常用密码。',
      '点选你认为在历史泄露数据中出现次数更多的那个，共 8 轮，越往后越接近。',
      '答完会显示真实的泄露次数，并揭示规律：越简单、越像人名或键盘走位的密码，泄露越多。',
    ],
    scoring: '每答对一轮得 1 分，满分 8 分。',
    sources: [
      { name: 'Have I Been Pwned: Pwned Passwords range API', url: 'https://haveibeenpwned.com/API/v3#PwnedPasswords', note: '只发送 SHA-1 前 5 位（k-匿名），返回该前缀下所有哈希的出现次数' },
      { name: 'SecLists 10k-most-common.txt', url: 'https://github.com/danielmiessler/SecLists/tree/master/Passwords/Common-Credentials', note: '候选密码列表' },
    ],
    dataNote: '次数为构建时从 HIBP 抓取的快照，已过滤不雅词汇。',
  },

  puzzle({ data, rng }) {
    return { pairs: makePairs(data.items, rng).map((pr) => pr.map((x) => ({ p: x.p, n: x.n }))) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('pwned pairs', p.pairs.length);
    ctx.stage.append(ui.panel({ kicker: '背景', title: '密码泄露了多少次？' },
      ui.h('p', { class: 'small muted' }, '数据来自 Have I Been Pwned：数十亿条在数据泄露中曝光的真实密码。数字越大，被攻击者拿去撞库的概率越高。')));
    const rounds = p.pairs.map(([a, b], i) => ({
      prompt: `第 ${i + 1} 轮：哪个泄露次数更多？`,
      options: [a, b].map((x) => ({ label: x.p })),
      correct: a.n >= b.n ? 0 : 1,
      explain: `${a.p}：${core.fmtNum(a.n)} 次；${b.p}：${core.fmtNum(b.n)} 次（相差 ${(Math.max(a.n, b.n) / Math.min(a.n, b.n)).toFixed(1)} 倍）`,
    }));
    const r = await ctx.rounds({ rounds, minWidth: 140 });
    const all = p.pairs.flat().sort((x, y) => y.n - x.n);
    r.detail = ui.stack(
      ui.table({ columns: [{ key: 'p', label: '密码' }, { key: 'n', label: '泄露次数', num: true, fmt: (v) => core.fmtNum(v) }], rows: all }),
      ui.callout('规律：泄露次数大体遵循齐普夫分布。越短、越常见的词、纯数字序列和键盘走位（123456、qwerty）排在最前面，靠前的密码被人用得比靠后的多出几十倍。', 'good'),
    );
    return r;
  },
};
