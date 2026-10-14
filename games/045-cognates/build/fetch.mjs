// Fetch Wikidata labels for common concepts (by enwiki title) in many languages.
import fs from 'node:fs';
const titles = `Water,Fire,Earth,Moon,Sun,Star,Night,Day,Tree,Flower,Fish,Bird,Dog,Cat,Horse,Cow,Pig,Sheep,Goat,Mouse,Wolf,Bear,Fox,Snake,Egg,Milk,Bread,Salt,Sugar,Tea,Coffee,Apple,Wine,Beer,Meat,Rice,Honey,Butter,Cheese,Mother,Father,Brother,Sister,Son,Daughter,Man,Woman,Child,King,Queen,Name,Heart,Hand,Foot,Head,Eye,Ear,Nose,Mouth,Tooth,Tongue,Blood,Bone,Skin,Hair,House,Door,Window,Table,Chair,Bed,Book,Paper,Pen,Road,Bridge,City,Village,Mountain,River,Sea,Lake,Island,Forest,Field,Stone,Gold,Silver,Iron,Copper,Glass,Wind,Rain,Snow,Ice,Cloud,Winter,Summer,Spring,Year,Month,Week,Hour,Music,Song,Dance,School,Church,Ship,Boat,Car,Train,Wheel,Knife,Sword,Bow,Hat,Shoe,Coat,Ring,Mirror,Lamp,Clock,Key,Bell,Drum,Flag,Money,Tax,Doctor,Medicine,Poison,Cheese,Garden,Wall,Roof,Floor,Kitchen,Soup,Fruit,Grape,Lemon,Orange (fruit),Banana,Potato,Tomato,Onion,Garlic,Pepper,Nut,Bean,Wheat,Corn,Oil,Smoke,Ash,Wood,Leaf,Root,Grass,Seed,Air,Light,Shadow,Fear,Love,Peace,War,Death,Life,Dream,Sleep,Game,Friend,Enemy,God,Devil,Angel,Soul,Story,Word,Letter,Number,Color,Red,Blue,Green,Yellow,White,Black`.split(',').map(s=>s.trim());
const uniq=[...new Set(titles)];
const langs='de,nl,sv,da,fr,es,it,pt,ro,ru,pl,cs,el,hi,fa,ar,tr,fi,hu,sw,id,ja,zh,ko,he,vi,en'.split(',');
const out={};
for (let i=0;i<uniq.length;i+=40){
  const t=uniq.slice(i,i+40);
  const url='https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&format=json&props=labels|sitelinks&languages='+langs.join('|')+'&titles='+encodeURIComponent(t.join('|'));
  const r=await fetch(url,{headers:{'User-Agent':'daily-data-games/1.0 (class project)'}});
  const j=await r.json();
  fs.writeFileSync(`raw/wd-${i}.json`,JSON.stringify(j));
  await new Promise(r=>setTimeout(r,1500));
}
console.log('done');
