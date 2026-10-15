// Fetch tour events from MusicBrainz (CC0 data). Cached in raw/. 1 req/s, identifies itself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(here, 'raw');
fs.mkdirSync(raw, { recursive: true });
const UA = 'daily-data-games/1.0 (NYU class project; lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mb(url, cacheFile) {
  const f = path.join(raw, cacheFile);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; i < 6; i++) {
    await sleep(1100);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
      const t = await r.text();
      if (r.ok && !t.includes('"error"')) { fs.writeFileSync(f, t); return JSON.parse(t); }
      console.error('retry', r.status, t.slice(0, 80));
    } catch (e) { console.error('retry', e.message); }
    await sleep(4000 * (i + 1));
  }
  return null;
}

export const NAMES = ['Taylor Swift','Beyoncé','Coldplay','Ed Sheeran','Adele','Bruce Springsteen','U2','The Rolling Stones','Metallica','Madonna','Lady Gaga','Bruno Mars','Billie Eilish','Harry Styles','Dua Lipa','The Weeknd','Ariana Grande','Rihanna','Kendrick Lamar','Drake','Radiohead','Foo Fighters','Green Day','Roger Waters','Paul McCartney','Elton John','Billy Joel','Eminem','Jay-Z','Kanye West','Muse','Arctic Monkeys','Imagine Dragons','Maroon 5','Shawn Mendes','Justin Bieber','Katy Perry','P!nk','Lorde','Olivia Rodrigo','Sabrina Carpenter','Post Malone','Travis Scott','Bad Bunny','BTS','BLACKPINK','TWICE','Red Hot Chili Peppers','Pearl Jam','Guns N\' Roses','AC/DC','Iron Maiden','Ozzy Osbourne','Queen','Fleetwood Mac','Eagles','Bob Dylan','Neil Young','Tool','System of a Down','Linkin Park','Nine Inch Nails','Depeche Mode','The Cure','Pet Shop Boys','Kylie Minogue','Robbie Williams','Oasis','Blur','The 1975','Florence + the Machine','Lana Del Rey','Tame Impala','Gorillaz','Kraftwerk','Phish','Dave Matthews Band','Kenny Chesney','Luke Combs','Morgan Wallen','Shakira','Enrique Iglesias','Céline Dion','Mariah Carey','Alicia Keys','Sam Smith','Lizzo','Doja Cat','SZA','Tyler, the Creator','Stray Kids','SEVENTEEN','EXO','BIGBANG','Ghost','Slipknot','Rammstein','Scorpions','Sting','Phil Collins','Genesis','Duran Duran','Nicki Minaj','Cardi B','Lil Wayne','Pitbull','Selena Gomez','Miley Cyrus','Demi Lovato','Shania Twain','Keith Urban','Carrie Underwood','Jason Aldean','Zac Brown Band','Twenty One Pilots','Panic! at the Disco','My Chemical Romance','Fall Out Boy','Paramore','Blink-182','Sum 41','The Killers','Kings of Leon','Arcade Fire','Vampire Weekend','The National','Pixies','Foals','Bastille','Mumford & Sons','Hozier','Lewis Capaldi','Dermot Kennedy','Zayn','Niall Horan','Louis Tomlinson','One Direction','Little Mix','Backstreet Boys','NSYNC','Jonas Brothers','Aerosmith','Kiss','Mötley Crüe','Def Leppard','Bon Jovi','Journey','Santana','Eric Clapton','Rod Stewart','Tina Turner','Stevie Wonder','Prince','Paul Simon','Neil Diamond','Barry Manilow','Cher','Diana Ross','Janet Jackson','Usher','Chris Brown','Ne-Yo','Pharrell Williams','Calvin Harris','David Guetta','Avicii','Swedish House Mafia','Martin Garrix','Tiësto','Skrillex','Deadmau5','The Chemical Brothers','Underworld','Massive Attack','Björk','Sigur Rós','Thom Yorke','Nick Cave and the Bad Seeds','Leonard Cohen','Patti Smith','Willie Nelson','Johnny Cash','Dolly Parton','Garth Brooks','George Strait','Alan Jackson','Tim McGraw','Blake Shelton','Eric Church','Chris Stapleton'];

const out = [];
for (const name of NAMES) {
  const s = await mb(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent('artist:"' + name + '"')}&limit=3&fmt=json`, `search-${name.replace(/[^\w]/g, '_')}-${[...name].length}.json`);
  const a = s?.artists?.[0];
  if (!a) { console.error('NO ARTIST', name); continue; }
  console.log(name, '->', a.name, a.id, a.country || '', a.score);
  let events = [];
  for (let off = 0; off < 500; off += 100) {
    const d = await mb(`https://musicbrainz.org/ws/2/event?artist=${a.id}&inc=place-rels+series-rels&limit=100&offset=${off}&fmt=json`, `ev-${a.id}-${off}.json`);
    if (!d) break;
    events.push(...d.events);
    if (off + 100 >= d['event-count']) break;
  }
  out.push({ query: name, id: a.id, name: a.name, country: a.country || null, events: events.length });
  fs.writeFileSync(path.join(raw, 'artists.json'), JSON.stringify(out, null, 1));
}
fs.writeFileSync(path.join(raw, 'artists.json'), JSON.stringify(out, null, 1));
