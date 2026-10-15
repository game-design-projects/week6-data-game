// #28 Contract — read a real federal contract description, guess the dollar amount on a log scale.
export const BUCKETS = 8;

/** Pick `n` awards from distinct magnitude buckets so every day spans small and huge contracts. */
export function pickSet(awards, rng, n = 3) {
  const byB = Array.from({ length: BUCKETS }, () => []);
  awards.forEach((a, i) => byB[a.b].push(i));
  const bs = rng.sample([...Array(BUCKETS).keys()].filter((b) => byB[b].length), n);
  return bs.sort((x, y) => x - y).map((b) => rng.pick(byB[b]));
}

/** Within what factor was the guess? (symmetric, >= 1) */
export const factorOff = (guess, answer) => Math.exp(Math.abs(Math.log(guess / answer)));

const title = (s) => s.toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());


const RULES = [
  [/MINIMUM GUARANTEE|\bBPA\b|IDIQ|BLANKET PURCHASE|INDEFINITE/i, '“保底 / BPA / IDIQ”字样：这类合同的授予额常常只是最低保证金额或框架里的第一笔，和“规模感”脱节。'],
  [/TASK ORDER|DELIVERY ORDER|\bTO\b \d|CALL (NO|ORDER)/i, '“任务单 / 交付订单”是挂在大框架合同下的单笔订单，金额通常比整个框架小一到两个数量级。'],
  [/CONSTRUCTION|REPAIR|RENOVAT|REPLACE|DESIGN[- ]BUILD|ROOF|HVAC|PAVEMENT|DREDG/i, '工程 / 维修类：小修小补几万到几十万美元，整栋建筑或大型基础设施才到千万以上。'],
  [/SOFTWARE|LICENSE|SUBSCRIPTION|MAINTENANCE|SUPPORT|RENEWAL/i, '软件 / 维保 / 订阅类：多为按年续约，金额以十万到百万美元居多。'],
  [/AIRCRAFT|MISSILE|F-35|SHIP\b|SUBMARINE|ENGINE|RADAR|SATELLITE|SPACE|WEAPON|SYSTEM DEVELOPMENT/i, '飞机 / 导弹 / 舰船 / 航天装备：主力装备合同动辄上亿美元，只有零部件或保修订单才小。'],
  [/RESEARCH|STUDY|ANALYSIS|R&D|DEVELOPMENT/i, '研究 / 分析类：政府智库与科研合同多在百万到千万美元之间。'],
  [/MEDICAL|LABORATORY|HEALTH|CLINIC|PHARMA|DRUG|HOSPITAL/i, '医疗 / 检验类：退伍军人事务部、卫生部门的订单多是年度服务，几十万到几百万美元。'],
  [/FUEL|FOOD|MEAL|JANITORIAL|CUSTODIAL|LAUNDRY|SECURITY GUARD|CATERING/i, '日常后勤（燃油、餐饮、保洁、保安）：单份订单多为几万到几十万美元，按期重复招标。'],
  [/TELECOM|ETHERNET|CIRCUIT|BANDWIDTH|NETWORK|CABLE/i, '通信线路 / 网络服务：单条线路是月租式小额合同，通常在几万美元以内。'],
];
const MAGNITUDE = ['5 千到 2 万美元的小额采购', '2 万到 10 万美元的小额订单', '10 万到 50 万美元的常规合同', '50 万到 200 万美元的中型合同', '200 万到 1000 万美元的大型合同', '1000 万到 5000 万美元的重点项目', '5000 万到 3 亿美元的旗舰合同', '3 亿美元以上的超大型合同'];

/** Puzzle-specific teaching note: which description pattern fits this amount. Pure. */
export function lesson(a, guess) {
  const hits = RULES.filter(([re]) => re.test(a.desc)).slice(0, 2).map(([, t]) => t);
  const dir = guess > a.amt ? '你猜高了' : guess < a.amt ? '你猜低了' : '分毫不差';
  const parts = [`金额属于“${MAGNITUDE[a.b]}”这一档，${dir}。线索：`];
  if (hits.length) parts.push(...hits);
  else parts.push('描述本身没有量级线索，要靠机构 + 商品类别推断：' + (a.ag === 'Department of Defense' ? '国防部的合同跨度极大，零部件与主力装备可差 1000 倍以上。' : '非国防机构的单份合同多数不超过几百万美元。'));
  return parts.join(' ');
}

export default {
  meta: {
    num: 28,
    slug: 'contract',
    title: 'Contract',
    tagline: '一份真实的美国联邦采购合同描述，猜它值多少钱——按对数刻度计分。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天 3 份真实的联邦合同（USAspending 公开数据），金额从几千美元到几十亿美元不等。',
      '读合同描述、采购机构、商品/服务类别和承包商，拖动滑块（对数刻度）或直接输入金额。',
      '差几倍比差多少美元重要：猜 2 倍以内得高分，差 10 倍以上基本拿不到分。',
      '线索：“MINIMUM GUARANTEE / BPA / IDIQ” 常是保底或框架合同；“TASK ORDER” 是大框架下的单笔订单；装备、研发类才容易上亿。',
      '三份合同分别来自三个不同的金额档位，所以每天都有“小、中、大”的搭配。',
    ],
    scoring: '每份合同 100 分：按猜测与真实金额之比的对数衰减（差 4 倍 ≈ 37 分），满分 300（3 份相加）。',
    sources: [
      { name: 'USAspending.gov API — spending_by_award', url: 'https://api.usaspending.gov/', note: '2025 财年（2024-10 至 2025-09）的合同类授予（award type A–D）' },
    ],
    dataNote: '金额为该合同的 Award Amount（截至抓取时的累计授予额，可能随后续修订变动）。数据是快照：按 8 个对数金额档位抽样，每档约 55 份，因此不代表联邦合同的真实分布（真实世界里小额合同要多得多）。已剔除描述中直接写出金额的合同，并尽量多取非国防部机构。USAspending API 虽然支持跨域，但“今天的合同”无法公平地让所有玩家得到同一题，因此不做实时抓取。',
  },

  puzzle({ data, rng }) {
    return { ids: pickSet(data.awards, rng, 3) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const results = [];
    const awards = p.ids.map((i) => ctx.data.awards[i]);
    ctx.log('contracts', awards.map((a) => a.id));
    for (const [i, a] of awards.entries()) {
      const box = ui.h('div', { class: 'ds-stack' });
      ctx.stage.append(ui.panel({ kicker: `合同 ${i + 1} / ${awards.length}`, title: a.ag },
        ui.quote(a.desc),
        ui.kv([
          ['承包商', a.rec],
          ['商品/服务', a.psc ? title(a.psc) : '—'],
          ['行业 (NAICS)', a.naics ? title(a.naics) : '—'],
          ['履约地', a.st || '—'],
        ]), box));
      const r = await ctx.estimate({
        title: '这份合同值多少美元？',
        answer: a.amt, min: 1000, max: 5e9, log: true, initial: 1e5, step: 1,
        unit: '', format: (v) => core.fmtMoney(v), scoring: 'log', scale: 0.6, container: box,
      });
      const f = factorOff(r.guess, a.amt);
      ctx.log('guess', { id: a.id, guess: r.guess, answer: a.amt, factor: f });
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'rec', label: '承包商' }, { key: 'amt', label: '真实金额', num: true }, { key: 'guess', label: '你猜', num: true }, { key: 'x', label: '差距', num: true }],
        rows: awards.map((a, i) => ({ rec: a.rec, amt: core.fmtMoney(a.amt), guess: core.fmtMoney(results[i].guess), x: `${factorOff(results[i].guess, a.amt).toFixed(1)}×` })),
      }),
      ...awards.map((a, i) => ui.h('div', { class: 'small' }, ui.h('b', {}, `合同 ${i + 1}：`), lesson(a, results[i].guess))),
      ui.h('div', { class: 'small muted' }, '计分按“差几倍”而非差多少美元：每差约 4 倍扣到 37 分，差 10 倍以上基本为 0。'));
    return res;
  },
};
