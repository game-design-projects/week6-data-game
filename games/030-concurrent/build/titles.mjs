// Step 1: resolve game article titles in many Wikipedia language editions via langlinks.
import fs from 'node:fs';
const UA = 'daily-data-games/1.0 (class project; lishuyustevenli@gmail.com)';
const EN = ['Minecraft','Fortnite','League of Legends','Dota 2','Counter-Strike 2','Counter-Strike: Global Offensive','Genshin Impact','Valorant','Among Us','Roblox','Apex Legends','Overwatch (video game)','Overwatch 2','PUBG: Battlegrounds','Grand Theft Auto V','Elden Ring','Terraria','Stardew Valley','The Witcher 3: Wild Hunt','Cyberpunk 2077','Rocket League','Team Fortress 2','World of Warcraft','Pokémon Go','Clash of Clans','Candy Crush Saga','Call of Duty: Warzone','Rainbow Six Siege','Hearthstone','Starcraft II: Wings of Liberty','Football Manager 2024','Euro Truck Simulator 2','Genshin Impact','Honkai: Star Rail','Black Myth: Wukong','Palworld','Baldur\'s Gate 3','Hollow Knight','Persona 5','Monster Hunter: World','Final Fantasy XIV','Lost Ark','Mobile Legends: Bang Bang','Free Fire (video game)','Brawl Stars','Animal Crossing: New Horizons','Fall Guys','Helldivers 2','Dead by Daylight','Rust (video game)','ARK: Survival Evolved','Left 4 Dead 2','Age of Empires II','Civilization VI','Cities: Skylines','The Sims 4','Subnautica','Garry\'s Mod','Hades (video game)','Undertale','Dark Souls III','Sekiro: Shadows Die Twice','Tekken 8','Street Fighter 6','Forza Horizon 5','FIFA 23','Ragnarok Online','MapleStory','Lineage II','Tower of Fantasy','Warframe','Destiny 2','Path of Exile','Diablo IV'];
const LANGS = ['en','ja','ko','zh','ru','de','fr','es','pt','it','id','tr','vi','th','pl','ar','nl','sv','uk','fa','cs','hu'];
const out = {};
for (const en of [...new Set(EN)]) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllimit=500&titles=${encodeURIComponent(en)}`;
  const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  const pg = Object.values(j.query.pages)[0];
  if (pg.missing !== undefined) { console.log('missing', en); continue; }
  const t = { en: pg.title };
  for (const l of pg.langlinks || []) if (LANGS.includes(l.lang)) t[l.lang] = l['*'];
  out[pg.title] = t;
  console.log(pg.title, Object.keys(t).length);
  await new Promise((r) => setTimeout(r, 150));
}
fs.writeFileSync('raw/titles.json', JSON.stringify(out, null, 1));
