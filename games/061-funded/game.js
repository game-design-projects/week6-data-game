// #61 Funded — a Kickstarter pitch; guess what % of its goal it raised.
export const pctOf = (pledged, goal) => (goal > 0 ? (pledged / goal) * 100 : 0);
export const impliedPct = (backers, goal, avgPledge = 98) => pctOf(backers * avgPledge, goal);
export const FALLBACK_AVG = 98;
export const avgFor = (data, it) => data.parAvg?.[it.par] ?? FALLBACK_AVG;

export default {
  meta: {
    num: 61,
    slug: 'funded',
    title: 'Funded',
    tagline: '一份 Kickstarter 众筹提案：目标金额、支持者人数、介绍文案都摆在这里。猜它最终筹到了目标的百分之多少。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '读提案的介绍、类别、目标金额（已换算成美元）和筹款天数。',
      '线索里有支持者人数。每位支持者平均出资约 $50–120（科技、影视类更高，漫画、游戏类更低），所以「人数 × 人均出资 ÷ 目标」就是个不错的起点。',
      '在对数滑块上选一个百分比：100% 刚好达标，低于 100% 说明失败，几千 % 的是爆款。',
      '按倍数误差计分：差 2 倍约得 42 分，差 10 倍约得 6 分，猜中得 100 分。',
    ],
    scoring: '对数误差：100 × e^(−|log10(猜/真)| / 0.35)。',
    sources: [
      { name: 'Kickstarter 数据集（Web Robots 每月抓取）', url: 'https://webrobots.io/kickstarter-datasets/', note: '2026-10-12 版 CSV' },
    ],
    dataNote: '从 4.9 万多个已结束（成功或失败）的项目中，按达成率分层抽取 146 个。只保留英文文案、至少有 1 位支持者的项目，并剔除文案里直接提到金额、达成情况的项目和成人内容。目标金额按项目的 static_usd_rate 换算为美元。Kickstarter 没有开放的跨域接口（官方站点拒绝脚本访问），所以这是 2026-10-12 的快照，不是实时数据。',
  },

  puzzle({ data, pick }) {
    return { i: data.items.indexOf(pick(data.items)) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const it = ctx.data.items[p.i];
    ctx.log('project', it.n, 'pct', it.pct);
    const avgP = avgFor(ctx.data, it);
    const hint = impliedPct(it.backers, it.goal, avgP);
    ctx.stage.append(ui.panel({ kicker: it.par + ' · ' + it.cat, title: it.n },
      ui.stack(ui.quote(it.b),
      ui.grid(120,
        ui.stat({ label: '目标金额', value: core.fmtMoney(it.goal) }),
        ui.stat({ label: '支持者', value: core.fmtNum(it.backers) + ' 人' }),
        ui.stat({ label: '筹款天数', value: it.days + ' 天' }),
        ui.stat({ label: '来自', value: it.loc || it.cc, sub: it.year + ' 年发起' }),
      ),
      ui.row(ui.badge(it.staff ? 'Staff Pick 官方推荐' : '非官方推荐', it.staff ? 'good' : undefined)))));
    const res = await ctx.estimate({
      title: '它筹到了目标的百分之几？',
      answer: it.pct, min: 1, max: 20000, log: true, step: 1, initial: 100,
      format: (v) => core.fmtNum(Math.round(v)) + '%',
      scoring: 'log', scale: 0.35,
    });
    const avg = it.pledged / it.backers;
    res.detail = ui.kv([
      ['答案', `${core.fmtNum(it.pct)}%（${it.pct >= 100 ? '达标成功' : '未达标，失败'}）`],
      ['实际筹款', `${core.fmtMoney(it.pledged)} / 目标 ${core.fmtMoney(it.goal)}`],
      ['人均出资', `${core.fmtMoney(avg)}（${it.par} 类中位数约 ${core.fmtMoney(avgP)}）`],
      ['怎么推', `${core.fmtNum(it.backers)} 人 × ${core.fmtMoney(avgP)} ÷ 目标 ≈ ${core.fmtNum(Math.round(hint))}%，与真实值相差 ${(Math.max(hint, it.pct) / Math.min(hint, it.pct)).toFixed(1)} 倍。`],
      ['规律', avg >= avgP * 1.5 ? `这个项目的人均出资（${core.fmtMoney(avg)}）明显高于 ${it.par} 类的中位数，所以按中位数估会偏低。` : avg <= avgP / 1.5 ? `这个项目的人均出资（${core.fmtMoney(avg)}）明显低于 ${it.par} 类的中位数，所以按中位数估会偏高。` : `人均出资接近 ${it.par} 类的中位数，「人数 × 人均 ÷ 目标」直接就能估准。`],
      ['结局', it.pct >= 100 ? (it.staff ? 'Staff Pick 项目大多成功；目标越低越容易被超额。' : '达标后继续累积，目标金额小的项目更容易冲到几百 %。') : 'Kickstarter 是全有或全无，没达标一分钱也拿不到；失败项目多半卡在支持者太少。'],
      ['链接', it.url ? ui.h('a', { href: it.url, target: '_blank', rel: 'noopener' }, it.url) : '—'],
    ]);
    return res;
  },
};
