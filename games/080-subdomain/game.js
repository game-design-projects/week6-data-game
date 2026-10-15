import { toLive } from './shape.js';

// #80 Subdomain — guess the company from the subdomains in its newest TLS certificates.
export const CLUE_SIZES = [8, 6, 6, 6, 5, 5];

/** Split a company's label list into the 6 clue batches (generic labels first). */
export function batches(labels) {
  const total = CLUE_SIZES.reduce((x, y) => x + y, 0);
  const out = [];
  let acc = 0, prev = 0;
  for (const n of CLUE_SIZES) {
    acc += n;
    const end = Math.round((acc / total) * labels.length);
    out.push(labels.slice(prev, end));
    prev = end;
  }
  return out;
}

export default {
  meta: {
    num: 80,
    slug: 'subdomain',
    title: 'Subdomain',
    tagline: '一家公司（名字隐藏）最近签发的 TLS 证书里出现的子域名：vpn-、sso-、jira-……猜是哪家公司。',
    category: 'tech',
    data: 'live',
    howTo: [
      '每家公司申请 HTTPS 证书时，子域名会被公开记录在证书透明度（CT）日志里。今天的公司是谁、它的子域名，都来自昨天为止 crt.sh 上仍有效的证书。',
      '先看到最常见的几个子域名（api、status、admin……），从列表中猜公司，最多 6 次。公司名已涂黑。',
      '每猜错一次，解锁一批更独特的子域名，越往后越能暴露身份。',
      '每次猜测会告诉你：行业是否相同，以及你猜的公司和答案共有几个相同的子域名。',
      '计分：第 1 次猜中 100 分，第 2 次 83，第 3 次 67，第 4 次 50，第 5 次 33，第 6 次 17，没猜中 0 分。',
    ],
    scoring: '第 n 次猜中得 100 × (7 − n) / 6 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'crt.sh 证书透明度日志检索', url: 'https://crt.sh/' },
      { name: 'Certificate Transparency (RFC 9162)', url: 'https://certificate.transparency.dev/' },
    ],
    dataNote: '每天的公司固定从 93 家里抽取；打开页面时浏览器会实时向 crt.sh 查询该公司主域名下、昨天（UTC）及之前签发且当天仍有效的证书，只取域名下一层的子域名。crt.sh 偶尔超时或返回 502，这时自动改用 2026-10-14 的快照（data.json）。两种来源都已剔除含品牌名（含前缀）和随机哈希的子域名；“通用 / 独有”是按这 93 家公司快照里的出现次数划分的。',
  },

  puzzle({ data, pick }) {
    const id = pick(data.companies).id;
    const live = data.live && data.live.id === id ? data.live : null;
    return live ? { id, live } : { id };
  },

  async load(ctx) {
    const cs = ctx.data.companies;
    const c = ctx.pick(cs);
    const url = `https://crt.sh/?q=${encodeURIComponent('%.' + c.domain)}&output=json&exclude=expired`;
    ctx.log('live: fetching crt.sh for', c.domain, 'anchored before', ctx.date);
    const rows = await ctx.fetchJSON(url, { timeout: 8000 });
    const live = toLive(rows, c, ctx.data.freq || {}, ctx.date);
    if (!live) { ctx.log.warn('live: too few labels for', c.domain, '- using snapshot'); return null; }
    ctx.log('live: ok', live.labels.length, 'labels of', live.total);
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const cs = ctx.data.companies;
    const byId = new Map(cs.map((c) => [c.id, c]));
    const base = byId.get(p.id);
    const ans = p.live ? { ...base, ...p.live } : base;
    ctx.log('answer', ans.id, 'labels', ans.labels.length, p.live ? 'live' : 'snapshot');
    const bs = batches(ans.labels);
    const cloud = (xs) => ui.h('div', { class: 'ds-row', style: { flexWrap: 'wrap', gap: '6px' } },
      xs.map((l) => ui.h('span', { class: 'mono' }, `${l}.▇▇▇▇▇▇`)));
    const clues = bs.map((b, i) => ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'small muted' }, i === 0 ? '最常见的子域名（很多公司都有）：' : `第 ${i + 1} 批：`),
      cloud(b)));
    clues[bs.length - 1] = ui.h('div', { class: 'ds-stack' }, clues[bs.length - 1], ui.h('div', { class: 'small' }, `行业：${ans.cat}；名字首字母 “${ans.name[0]}”。`));

    const shared = (a, b) => a.labels.filter((l) => b.labels.includes(l)).length;
    const options = cs.map((c) => ({ id: c.id, label: c.name, hint: c.cat, aliases: [c.domain, c.id] }));
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: 6,
      title: '这是哪家公司？', placeholder: '输入公司名…',
      clues, cluesTitle: '证书里的子域名',
      columns: ['行业', '共同子域名'],
      near: (g) => byId.get(g.id).cat === ans.cat,
      feedback: (g) => {
        const gc = byId.get(g.id);
        if (gc.id === ans.id) return [{ text: gc.cat, state: 'hit' }, { text: `${ans.labels.length}/${ans.labels.length}`, state: 'hit', num: true }];
        const s = shared(gc, ans);
        return [{ text: gc.cat, state: gc.cat === ans.cat ? 'near' : undefined }, { text: `${s}/${ans.labels.length}`, num: true, state: s >= 8 ? 'near' : undefined }];
      },
    });
    const freq = ctx.data.freq || {};
    const isUniq = (l) => !freq[l];
    const batchOf = (l) => bs.findIndex((b) => b.includes(l)) + 1;
    const uniq = ans.labels.filter(isUniq);
    const first = uniq[0];
    const generic = ans.labels.slice(0, 4);
    const why = first
      ? `第 ${batchOf(first)} 批里的 ${first} 是这批 93 家公司里只有 ${ans.name} 才有的子域名，是最早能锁定它的线索；其余独有的还有 ${uniq.slice(1, 8).join('、') || '（无）'}。`
      : `这家公司没有独有的子域名，要靠多个线索组合才能排除其他公司。`;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['答案', `${ans.name}（${ans.domain}）`], ['行业', ans.cat], ['有效证书里的单层子域名', `${ans.total} 个`], ['最近一张证书签发', ans.latest || '—'], ['数据', p.live ? '今天实时查询 crt.sh' : '2026-10-14 快照']]),
      ui.h('div', { class: 'ink2' }, why),
      ui.h('div', { class: 'ink2' }, `${generic.join('、')} 这类很多公司都有的名字，只能说明规模和技术栈；产品线、内部系统和合作项目的名字才暴露身份。`));
    return res;
  },
};
