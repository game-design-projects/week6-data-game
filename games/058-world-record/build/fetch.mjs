// Fetch speedrun.com game metadata + all verified runs of the main category (cached in raw/).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const RAW = new URL('./raw/', import.meta.url).pathname;
const UA = 'daily-data-games/0.1 (NYU class project; lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = ["Super Mario 64", "Super Mario Bros.", "Super Mario Bros. 3", "Super Mario World", "Super Metroid", "The Legend of Zelda: Ocarina of Time", "The Legend of Zelda: A Link to the Past", "The Legend of Zelda: Breath of the Wild", "The Legend of Zelda: Majora's Mask", "Minecraft: Java Edition", "Portal", "Portal 2", "Half-Life 2", "Half-Life", "Celeste", "Hollow Knight", "Cuphead", "Undertale", "Terraria", "Sonic the Hedgehog", "Sonic the Hedgehog 2", "Sonic the Hedgehog 3", "Mario Kart 64", "Mario Kart Wii", "Mario Kart 8 Deluxe", "Metroid Prime", "Mega Man 2", "Pokémon Red/Blue", "Pokémon Crystal", "Pokémon Emerald", "Donkey Kong Country", "Donkey Kong 64", "Banjo-Kazooie", "Grand Theft Auto: San Andreas", "Grand Theft Auto III", "Doom", "Doom II", "Hades", "Elden Ring", "Sekiro: Shadows Die Twice", "Super Mario Sunshine", "Super Mario Galaxy", "Super Mario Galaxy 2", "F-Zero", "F-Zero GX", "Super Smash Bros.", "Ori and the Will of the Wisps", "Shovel Knight", "Stanley Parable", "SUPERHOT", "ULTRAKILL", "Duke Nukem 3D", "Cave Story", "The Binding of Isaac: Rebirth", "Stardew Valley", "Super Meat Boy", "Super Mario Land", "Yoshi's Island", "Paper Mario", "Luigi's Mansion", "Pikmin", "Pikmin 2", "Animal Crossing", "The Legend of Zelda: Twilight Princess", "The Legend of Zelda", "Zelda II: The Adventure of Link", "Sonic Mania", "Resident Evil 2", "Resident Evil 4", "Metal Gear Solid", "Final Fantasy VII", "Final Fantasy X", "Persona 5", "Chrono Trigger", "Tetris", "Donkey Kong", "Kirby Super Star", "Kirby's Dream Land 3", "Mega Man X", "Mega Man 3", "Mega Man 9", "Castlevania: Symphony of the Night", "Castlevania", "Contra", "Punch-Out!!", "Metroid", "Metroid Fusion", "Metroid Zero Mission", "Star Fox 64", "Banjo-Tooie", "Goldeneye 007", "Perfect Dark", "Gran Turismo", "Tony Hawk's Pro Skater 2", "Spyro the Dragon", "Crash Bandicoot", "Half-Life 2: Episode One", "Left 4 Dead 2", "Counter-Strike: Global Offensive", "Dark Souls", "Bloodborne", "Dead Cells", "Hades II", "Getting Over It with Bennett Foddy", "A Hat in Time", "Portal: Still Alive", "Super Mario Odyssey", "Super Mario 3D World", "New Super Mario Bros.", "Wario Land 4", "Kingdom Hearts", "Bayonetta", "Silent Hill 2", "Fallout: New Vegas", "Skyrim", "The Elder Scrolls V: Skyrim", "Oblivion", "Morrowind", "Mirror's Edge", "Battletoads", "Ghosts 'n Goblins", "Sonic Adventure 2", "Sonic CD", "Kirby's Adventure", "Mario Kart: Double Dash!!", "Mario Kart DS", "Pac-Man", "Space Invaders", "Galaga", "Zelda: Link's Awakening", "Final Fantasy", "Dragon Quest", "EarthBound", "Super Mario Bros. 2", "Super Mario Bros.: The Lost Levels", "Yoshi's Island", "Rayman", "Shadow of the Colossus", "Ico", "God of War", "Devil May Cry", "Hotline Miami", "Spelunky", "Spelunky 2", "Cave Story+", "Limbo", "Inside", "Braid", "FEZ", "Ori and the Blind Forest", "Subnautica", "Valheim", "Factorio", "Slay the Spire", "Hollow Knight: Silksong"];
const uniq = [...new Set(NAMES)];
async function get(url) {
  const f = path.join(RAW, crypto.createHash('sha1').update(url).digest('hex') + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let t = 0; t < 4; t++) {
    await sleep(650);
    let r; try { r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); } catch (e) { console.error('err', e.message); await sleep(3000); continue; }
    if (r.status === 404) return null;
    if (r.ok) { const txt = await r.text(); fs.writeFileSync(f, txt); return JSON.parse(txt); }
    console.error('retry', r.status, url); await sleep(3000);
  }
  return null;
}
const B = 'https://www.speedrun.com/api/v1';
const out = [];
for (const ab of uniq) {
  const g = await get(`${B}/games?name=${encodeURIComponent(ab)}&max=5&embed=categories.variables,platforms`);
  if (!g || !g.data.length) { console.error('skip', ab); continue; }
  const d = g.data.find((x) => x.names.international.toLowerCase() === ab.toLowerCase()) || g.data[0];
  if (out.some((o) => o.id === d.id)) continue;
  const cats = d.categories.data.filter((c) => c.type === 'per-game' && !c.miscellaneous);
  if (!cats.length) { console.error('no cat', ab); continue; }
  const cat = cats.find((c) => /^any ?%/i.test(c.name)) || cats[0];
  const subs = cat.variables.data.filter((v) => v['is-subcategory']).map((v) => [v.id, v.values.default || Object.keys(v.values.values)[0]]);
  const subLabel = cat.variables.data.filter((v) => v['is-subcategory']).map((v) => v.values.values[v.values.default || Object.keys(v.values.values)[0]].label).join(', ');
  const runs = [];
  for (let off = 0; off < 6000; off += 200) {
    const r = await get(`${B}/runs?game=${d.id}&category=${cat.id}&status=verified&orderby=date&direction=asc&max=200&offset=${off}`);
    if (!r) break;
    runs.push(...r.data.filter((x) => subs.every(([id, val]) => x.values[id] === val)).map((x) => ({ date: x.date, t: x.times.primary_t })));
    if (r.data.length < 200) break;
  }
  out.push({ id: d.id, ab: d.abbreviation, name: d.names.international, released: d.released, cat: cat.name + (subLabel ? ' · ' + subLabel : ''), platforms: d.platforms.data.map((p) => p.name), runs });
  console.error(ab, d.names.international, cat.name, runs.length);
}
fs.writeFileSync(RAW + 'all.json', JSON.stringify(out));
console.error('DONE');
