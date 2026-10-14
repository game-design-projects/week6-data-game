// #80 Subdomain — guess the company from the subdomains in its newest TLS certificates.
export const CLUE_SIZES = [8, 6, 6, 6, 5, 5];

/** Split a company's label list into the 6 clue batches (generic labels first). */
export function batches(labels) {
  const out = [];
  let i = 0;
  for (const n of CLUE_SIZES) { out.push(labels.slice(i, i + n)); i += n; }
  return out;
}

/** Hide the brand name inside a string. */
export function hideBrand(text, c) {
  const words = [c.id, c.name.toLowerCase().replace(/[^a-z0-9]/g, '')].filter((w) => w.length >= 3);
  let out = text;
  for (const w of words) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▇▇▇');
  return out;
}

export default {
  meta: {
    num: 80,
    slug: 'subdomain',
    title: 'Subdomain',
    tagline: '一家公司（名字隐藏）最近签发的 TLS 证书里出现的子域名：vpn-、sso-、jira-……猜是哪家公司。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '每家公司申请 HTTPS 证书时，子域名会被公开记录在证书透明度（CT）日志里。',
      '先看到最常见的几个子域名（vpn、sso、api……），从列表中猜公司，最多 6 次。',
      '每猜错一次，解锁一批更独特的子域名。公司名已涂黑。',
      '每次猜测会告诉你：行业是否相同，以及你猜的公司和答案共有几个相同的子域名。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'crt.sh 证书透明度日志检索', url: 'https://crt.sh/' },
      { name: 'Certificate Transparency (RFC 9162)', url: 'https://certificate.transparency.dev/' },
    ],
    dataNote: '子域名取自 crt.sh 上各公司主域名下尚未过期的证书，快照于构建日；每家公司只保留有辨识度的单层子域名（已剔除含品牌名和随机哈希的）。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.companies).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const cs = ctx.data.companies;
    const byId = new Map(cs.map((c) => [c.id, c]));
    const ans = byId.get(p.id);
    ctx.log('answer', ans.id, 'labels', ans.labels.length);
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
    const uniq = ans.labels.filter((l) => cs.filter((c) => c.labels.includes(l)).length === 1);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['答案', `${ans.name}（${ans.domain}）`], ['行业', ans.cat], ['未过期证书里的单层子域名', `${ans.total} 个`], ['最近一张证书签发', ans.latest]]),
      ui.h('div', { class: 'ink2' }, `只有 ${ans.name} 出现的子域名（最有区分度）：${uniq.slice(0, 10).join('、') || '无'}。vpn、sso、api 这类通用名几乎每家公司都有，只能说明规模和技术栈；产品线名和内部系统名才暴露身份。`));
    return res;
  },
};
