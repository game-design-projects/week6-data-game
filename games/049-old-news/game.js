// #49 Old News — real OCR text from a century-old US newspaper front page; guess the year.

/** Words/phrases that date a text: [regex, note about the period]. */
export const LEXICON = [
  [/\btelegraph/i, 'telegraph (in newspapers from 1844)'], [/\brailroad|\brail-road/i, 'railroad (from the 1830s)'],
  [/\bslave|\bnegro/i, 'slavery / race: the central issue around the Civil War'], [/\bsecession|\bsecede/i, 'secession: around 1860-61'],
  [/\brebel/i, '"rebel": Civil War (1861-65) language'], [/\bconfederate/i, 'the Confederacy (1861-65, and postwar memory)'],
  [/\breconstruction/i, 'Reconstruction (1865-77)'], [/\btelephone/i, 'telephone (invented 1876)'], [/\belectric/i, 'electricity (common from the 1880s)'],
  [/\bbicycle/i, 'the bicycle craze (1880s-90s)'], [/\bautomobile|\bmotor ?car/i, 'automobile (common after 1900)'],
  [/\baeroplane|\baviator/i, 'aeroplane (around 1908)'], [/\bairplane/i, 'airplane (after 1912)'], [/\bkaiser/i, 'the Kaiser: World War I (1914-18)'],
  [/\barmistice/i, 'the WWI armistice (1918)'], [/\bprohibition|\bbootleg/i, 'Prohibition (1920-33)'], [/\bradio/i, 'radio (from the 1920s)'],
  [/\bdepression/i, 'the Great Depression (1930s)'], [/\bnazi/i, 'the Nazis (after 1933)'], [/\brationing|\bration board/i, 'WWII rationing (1942-45)'],
  [/\batomic|\bnuclear/i, 'atomic energy: after 1945'], [/\btelevision/i, 'television (widespread in the 1950s)'], [/\bcommunis/i, 'communism: the Cold War (after 1947) or the Red Scare'],
  [/\bpresident (lincoln|johnson|grant|hayes|garfield|cleveland|harrison|mckinley|roosevelt|taft|wilson|harding|coolidge|hoover|truman|eisenhower)/i, 'the president named dates the text to his term'],
  [/\bto-(day|morrow|night)\b/i, 'hyphenated to-day / to-morrow: old spelling from before 1920'], [/\btho\b|\bthru\b|\bthro\b/i, 'tho / thru: the "simplified spelling" movement of the 1900s'],
  [/&c\b/, '&c. (old form of etc.): mostly 19th century'], [/\bcents?\b.*\bper (pound|bushel|yard)/i, 'goods priced per pound / bushel: a typical 19th-century ad'],
];

/** Historical backdrop by year range, shown after each guess to teach what to look for. */
export const ERAS = [
  [1840, 1849, '1840s: small four-column type, Whigs vs. Democrats, Texas and the Mexican War, the telegraph just arriving.'],
  [1850, 1860, '1850s: the Fugitive Slave Act, the Kansas-Nebraska fight, railroads expanding fast; dense text with almost no headline hierarchy.'],
  [1861, 1865, '1861-65: the Civil War. Look for rebel, Union, army and casualties in battle reports.'],
  [1866, 1877, '1866-77: Reconstruction. Freedmen, suffrage, the public debt and railroad charters are common topics.'],
  [1878, 1899, '1878-99: the Gilded Age. Telephones, electric light, trusts, tariffs and patent-medicine ads fill the page.'],
  [1900, 1913, '1900-13: the Progressive Era. Automobiles, telephones, trust suits; big headlines appear, and so does simplified spelling.'],
  [1914, 1919, '1914-19: World War I. War bonds, the draft, the Kaiser, front-line cables and the flu epidemic.'],
  [1920, 1929, '1920s: Prohibition, radio, the Jazz Age and a stock-market boom.'],
  [1930, 1939, '1930s: the Depression and New Deal acronyms (WPA, NRA), fascism in Europe.'],
  [1940, 1945, '1940-45: World War II. Rationing, war production, front-line reports.'],
  [1946, 1963, '1946-63: postwar and Cold War. Television, suburbs, the civil rights movement, nuclear deterrence.'],
];
export const eraNote = (year) => (ERAS.find(([a, b]) => year >= a && year <= b) ?? [0, 0, ''])[2];

/** Score for a year guess: 100 at 0 off, ~37 at `scale` years off. */
export const yearScore = (guess, answer, scale = 10) => 100 * Math.exp(-Math.abs(guess - answer) / scale);

export function findHints(text) {
  return LEXICON.filter(([re]) => re.test(text)).map(([re, note]) => ({ w: (text.match(re) || [''])[0].trim(), note }));
}

export default {
  meta: {
    num: 49,
    slug: 'old-news',
    title: 'Old News',
    tagline: 'A snippet of real old-newspaper OCR text with no date and no masthead. Read the language and the news, then guess the year it was printed.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'Each day, three real passages from the front pages of old US newspapers (1840-1962), machine-read by OCR, so expect typos. Four-digit years have been blanked out as ____.',
      'Read the vocabulary and topics: telegraphs, railroads, cars, radio, names of wars, old spellings like to-day, and the goods in ads all give the era away.',
      'Drag the slider or type a year. After each answer you see the paper, date and place, plus the clues in the text that pin down the era. Each passage is one round.',
      'Scoring: each round is 100 × e^(−years off / 10): 100 for the exact year, about 37 for 10 years off. Your total is the average of the three rounds.',
    ],
    scoring: 'Each round: 100 × e^(−|guess − actual| / 10); the three rounds are averaged.',
    sources: [
      { name: 'Library of Congress · Chronicling America', url: 'https://chroniclingamerica.loc.gov/', note: 'front-page OCR (ALTO XML) via the loc.gov API, public domain' },
      { name: 'loc.gov API', url: 'https://www.loc.gov/apis/' },
    ],
    dataNote: 'The text is uncorrected machine OCR; typos are kept as they are (only line-break hyphens were rejoined using ALTO\'s word-break markers). From each front page we keep only the passage with the highest OCR confidence. Four-digit years are replaced by ____, and passages that give the date away directly (such as "\'62", weekday plus date, volume numbers, paper names) were removed. Snapshot data: front pages sampled at random from each year 1840-1962. There is no reliable keyless, CORS-friendly live source, and the puzzle does not need "today\'s" data anyway.',
  },

  puzzle({ data, pick, rng }) {
    const first = pick(data.items);
    const chosen = [first];
    for (const x of rng.shuffle(data.items.slice())) {
      if (chosen.length === 3) break;
      if (chosen.every((c) => Math.abs(c.year - x.year) >= 12)) chosen.push(x);
    }
    return { ids: chosen.map((x) => x.id) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.items.map((x) => [x.id, x]));
    const items = p.ids.map((id) => byId.get(id));
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      ctx.log(`round ${i + 1}`, it.id, it.year);
      const holder = ui.h('div', { class: 'ds-stack' });
      ctx.stage.append(holder);
      holder.append(ui.panel({ kicker: `Passage ${i + 1} of ${items.length} · ${it.text.length} characters`, title: 'What year is this newspaper from?' },
        ui.quote(it.text)));
      const r = await ctx.estimate({
        container: holder, title: 'Your guess', answer: it.year, min: 1840, max: 1963, step: 1, initial: 1900,
        format: (v) => `${Math.round(v)}`, scoring: (g, a) => yearScore(g, a) / 100,
      });
      const hints = findHints(it.text);
      r.hints = hints;
      holder.append(ui.panel({ plain: true },
        ui.kv([
          ['Actual year', `${it.year} (${it.date})`],
          ['Newspaper', `${it.paper}${it.place ? ' · ' + it.place : ''}`],
          ['Off by', `${Math.abs(Math.round(r.guess) - it.year)} ${Math.abs(Math.round(r.guess) - it.year) === 1 ? 'year' : 'years'}`],
          ['Dating clues in the text', hints.length ? hints.map((h) => `"${h.w}": ${h.note}`).join('; ') : 'No hard period words here; you have to go by spelling, topics and typography'],
          ['The era', eraNote(it.year)],
        ]),
        ui.h('a', { href: it.url, target: '_blank', rel: 'noopener', class: 'small' }, 'View the original page on Chronicling America →')));
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.kv(items.map((it, i) => [`Passage ${i + 1} · ${it.year}`,
      `${it.paper} (${it.date}) · you guessed ${Math.round(results[i].guess)}, off by ${Math.abs(Math.round(results[i].guess) - it.year)}. ${results[i].hints.length ? 'Clues: ' + results[i].hints.map((h) => h.note).join('; ') : eraNote(it.year)}`]));
    return res;
  },
};
