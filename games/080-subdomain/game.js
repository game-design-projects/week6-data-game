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
    tagline: 'Subdomains from a hidden company\'s newest TLS certificates: vpn, sso, jira\u2026 Name the company.',
    category: 'tech',
    data: 'live',
    howTo: [
      'When a company requests an HTTPS certificate, its subdomains are recorded publicly in Certificate Transparency (CT) logs. Today\'s company and its subdomains come from certificates on crt.sh that were still valid as of yesterday.',
      'You start with the most common subdomains (api, status, admin\u2026) and guess the company from the list, up to 6 times. The company name is blacked out.',
      'Every miss unlocks a batch of more distinctive subdomains, and the later ones give the company away.',
      'Each guess tells you whether the industry matches and how many subdomains your guess shares with the answer.',
      'Scoring: 100 points for a first-try hit, then 83, 67, 50, 33 and 17; 0 if you miss all six.',
    ],
    scoring: 'A hit on guess n scores 100 \u00d7 (7 \u2212 n) / 6; 0 if you miss all six.',
    sources: [
      { name: 'crt.sh Certificate Transparency log search', url: 'https://crt.sh/' },
      { name: 'Certificate Transparency (RFC 9162)', url: 'https://certificate.transparency.dev/' },
    ],
    dataNote: 'Each day\'s company is picked from a fixed set of 93. When you open the page, your browser queries crt.sh live for certificates under that company\'s main domain that were issued yesterday (UTC) or earlier and are still valid today, keeping only the label directly under the domain. crt.sh sometimes times out or returns a 502; then the game automatically falls back to the Oct 14, 2026 snapshot (data.json). Both sources drop subdomains containing the brand name (including prefixes) or random hashes. \u201cGeneric\u201d vs. \u201cunique\u201d is based on how often a label appears across the snapshot of these 93 companies.',
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
    const { ui, core } = ctx;
    const cs = ctx.data.companies;
    const byId = new Map(cs.map((c) => [c.id, c]));
    const base = byId.get(p.id);
    const ans = p.live ? { ...base, ...p.live } : base;
    ctx.log('answer', ans.id, 'labels', ans.labels.length, p.live ? 'live' : 'snapshot');
    const bs = batches(ans.labels);
    const cloud = (xs) => ui.h('div', { class: 'ds-row', style: { flexWrap: 'wrap', gap: '6px' } },
      xs.map((l) => ui.h('span', { class: 'mono' }, `${l}.▇▇▇▇▇▇`)));
    const clues = bs.map((b, i) => ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'small muted' }, i === 0 ? 'Most common subdomains (many companies have these):' : `Batch ${i + 1}:`),
      cloud(b)));
    clues[bs.length - 1] = ui.h('div', { class: 'ds-stack' }, clues[bs.length - 1], ui.h('div', { class: 'small' }, `Industry: ${ans.cat}. The name starts with \u201c${ans.name[0]}\u201d.`));

    const shared = (a, b) => a.labels.filter((l) => b.labels.includes(l)).length;
    const options = cs.map((c) => ({ id: c.id, label: c.name, hint: c.cat, aliases: [c.domain, c.id] }));
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: 6,
      title: 'Which company is this?', placeholder: 'Type a company, e.g. Stripe\u2026',
      clues, cluesTitle: 'Subdomains in its certificates',
      columns: ['Industry', 'Shared'],
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
      ? `In batch ${batchOf(first)}, \u201c${first}\u201d is a subdomain only ${ans.name} has among these 93 companies, the earliest clue that could pin it down. Other unique ones: ${uniq.slice(1, 8).join(', ') || '(none)'}.`
      : `This company has no unique subdomains, so you had to combine several clues to rule out the others.`;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Answer', `${ans.name} (${ans.domain})`], ['Industry', ans.cat], ['Subdomains', `${core.fmtNum(ans.total)} single-level names in valid certificates`], ['Latest cert', ans.latest || '\u2014'], ['Data', p.live ? 'Live crt.sh query today' : 'Oct 14, 2026 snapshot']]),
      ui.h('div', { class: 'ink2' }, why),
      ui.h('div', { class: 'ink2' }, `Names like ${generic.join(', ')} are shared by many companies and only hint at size and tech stack; product lines, internal systems and partner projects are what give an identity away.`));
    return res;
  },
};
