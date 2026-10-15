// #78 Pwned — which password has leaked more often? Counts from Have I Been Pwned (k-anonymity range API).
export const ROUNDS = 8;

/** Min count ratio per round: easy first, close pairs last. */
export const TARGETS = [8, 6, 5, 4, 3, 2.2, 1.6, 1.3];
const ratio = (a, b) => Math.max(a.n, b.n) / Math.min(a.n, b.n);

/** Pick `n` disjoint pairs; round i has a count ratio in [TARGETS[i], ~2x that]. */
export function makePairs(items, rng, n = ROUNDS) {
  const pool = rng.shuffle(items.slice());
  const used = new Set();
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const lo = TARGETS[Math.min(i, TARGETS.length - 1)];
    const hi = i === n - 1 ? 2.2 : lo * 2.2;
    let found = null;
    for (const a of pool) {
      if (used.has(a.p)) continue;
      const b = pool.find((x) => x.p !== a.p && !used.has(x.p) && ratio(a, x) >= lo && ratio(a, x) <= hi);
      if (b) { found = [a, b]; break; }
    }
    if (!found) continue;
    used.add(found[0].p); used.add(found[1].p);
    pairs.push(rng.chance(0.5) ? found : [found[1], found[0]]);
  }
  return pairs;
}

const kind = (p) => (/^\d+$/.test(p) ? '纯数字' : /\d/.test(p) ? '字母+数字' : '纯字母');

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
      '点选你认为在历史泄露数据中出现次数更多的那个，共 8 轮，越往后两者越接近（从相差 8 倍以上到只差 1.3 倍）。',
      '每轮答完立即显示双方的真实泄露次数；全部答完后还会统计今天这 8 组里“更短 / 更常见”能解释多少结果。',
    ],
    scoring: '每答对一轮得 1 分，满分 8 分。',
    sources: [
      { name: 'Have I Been Pwned: Pwned Passwords range API', url: 'https://haveibeenpwned.com/API/v3#PwnedPasswords', note: '只发送 SHA-1 前 5 位（k-匿名），返回该前缀下所有哈希的出现次数' },
      { name: 'SecLists 10k-most-common.txt', url: 'https://github.com/danielmiessler/SecLists/tree/master/Passwords/Common-Credentials', note: '候选密码列表' },
    ],
    dataNote: '次数为 2026-10-14 从 HIBP 抓取的快照，候选词取自 SecLists 前 1 万常用密码的抽样（447 个），已过滤不雅词汇。HIBP 虽允许浏览器直接访问，但没有按日期固定的版本、新泄露会让次数持续变动，会让不同玩家的“正确答案”不一致，因此不做实时抓取。',
  },

  puzzle({ data, rng }) {
    return { pairs: makePairs(data.items, rng).map((pr) => pr.map((x) => ({ p: x.p, n: x.n, r: x.r }))) };
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
    const winners = p.pairs.map(([a, b]) => (a.n >= b.n ? [a, b] : [b, a]));
    const cnt = (f) => winners.filter(([w, l]) => f(w, l)).length;
    const shorter = cnt((w, l) => w.p.length < l.p.length), longer = cnt((w, l) => w.p.length > l.p.length);
    const higher = cnt((w, l) => w.r < l.r);
    const all = p.pairs.flat().sort((x, y) => y.n - x.n);
    const top = all[0], bot = all[all.length - 1];
    r.detail = ui.stack(
      ui.table({ columns: [
        { key: 'p', label: '密码' },
        { key: 'n', label: '泄露次数', num: true, fmt: (v) => core.fmtNum(v) },
        { key: 'r', label: '常用榜名次', num: true, fmt: (v) => `#${core.fmtNum(v)}` },
        { key: 'p', label: '类型', fmt: (v) => `${v.length} 位${kind(v)}` },
      ], rows: all }),
      ui.callout(`今天的规律：8 组里，泄露更多的一方有 ${higher} 次在 SecLists 常用榜里排名更靠前，${shorter} 次更短、${longer} 次更长。最高的 ${top.p} 出现 ${core.fmtNum(top.n)} 次，最低的 ${bot.p} 只有 ${core.fmtNum(bot.n)} 次，相差 ${core.fmtNum(Math.round(top.n / bot.n))} 倍。泄露次数大致服从齐普夫分布：越短、越“人人都会想到”的词（纯数字序列、键盘走位）次数越高；人名、地名和冷门单词则低得多。`, 'good'),
    );
    return r;
  },
};
