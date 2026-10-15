// Open Food Facts English taxonomy id -> Simplified Chinese name. "id=中文" per entry; E-numbers are shown as "中文 + E编号".
// Anything missing here makes build.mjs skip the products that contain it (and prints the missing ids).
const T = `
sugar=糖|salt=盐|flavouring=香精|natural-flavouring=天然香精|artificial-flavouring=人工香精|natural-and-artificial-flavouring=天然及人工香精|wheat-flour=小麦粉|flour=面粉
water=水|carbonated-water=碳酸水|spring-water=泉水|vegetable-oil=植物油|vitamins=维生素|cocoa-butter=可可脂|soya-lecithin=大豆卵磷脂|cocoa-paste=可可浆|emulsifier=乳化剂
skimmed-milk-powder=脱脂奶粉|skimmed-milk=脱脂乳|colour=色素|palm-oil=棕榈油|glucose-syrup=葡萄糖浆|lactose=乳糖|dextrose=葡萄糖|corn-syrup=玉米糖浆|acid=酸味剂|minerals=矿物质
milk=牛奶|folic-acid=叶酸|raising-agent=膨松剂|butterfat=乳脂|maltodextrin=麦芽糊精|sweetener=甜味剂|thiamin=维生素B1|barley-malt-extract=大麦麦芽提取物|milkfat=乳脂肪
milk-chocolate=牛奶巧克力|acidity-regulator=酸度调节剂|natural-and-artificial-flavouring=天然及人工香精|caffeine=咖啡因|cocoa=可可|onion=洋葱|vitamin-c=维生素C|chocolate=巧克力
whole-milk-powder=全脂奶粉|canola-oil=菜籽油|vegetable-fat=植物脂肪|yeast=酵母|whey-powder=乳清粉|sodium-citrate=柠檬酸钠|high-fructose-corn-syrup=高果糖玉米糖浆|stabiliser=稳定剂
spice=香辛料|antioxidant=抗氧化剂|corn-starch=玉米淀粉|iron=铁|reduced-iron=还原铁|wheat-starch=小麦淀粉|potato=土豆|cocoa-powder=可可粉|rapeseed-oil=菜籽油|molasses=糖蜜
strawberry=草莓|corn=玉米|palm-fat=棕榈脂|fortified-wheat-flour=强化小麦粉|glazing-agent=上光剂|sunflower-oil=葵花籽油|fat-reduced-cocoa-powder=低脂可可粉|modified-corn-starch=变性玉米淀粉
whey=乳清|preservative=防腐剂|modified-starch=变性淀粉|wheat=小麦|egg-white=蛋清|glucose-fructose=葡萄糖果糖|garlic=大蒜|hazelnut=榛子|pyridoxine-hydrochloride=盐酸吡哆醇|egg=鸡蛋
oat=燕麦|soya=大豆|thickener=增稠剂|peanut=花生|glucose-fructose-syrup=葡萄糖果糖糖浆|sea-salt=海盐|concentrated-lemon-juice=浓缩柠檬汁|yeast-extract=酵母提取物|thiamin-mononitrate=硝酸硫胺素
vanilla-extract=香草提取物|tapioca=木薯|vitamin-e=维生素E|vitamin-a=维生素A|cholecalciferol=维生素D3|cheddar=切达奶酪|malt-extract=麦芽提取物|apple=苹果|vitamin-d=维生素D|tomato=番茄
cereal=谷物|honey=蜂蜜|coconut-oil=椰子油|cream=奶油|zinc=锌|milk-powder=奶粉|milk-proteins=乳蛋白|natural-vanilla-extract=天然香草提取物|starch=淀粉|carrot=胡萝卜|vanillin=香兰素
vitamin-b12=维生素B12|vitamin-b6=维生素B6|colza-oil=菜籽油|tomato-concentrate=浓缩番茄酱|liquid-sugar=液体糖|semi-sweet-chocolate=半甜巧克力|barley-malt-flour=大麦麦芽粉|pantothenic-acid=泛酸
e150a=普通焦糖色|e150d=亚硫酸铵焦糖色|e150=焦糖色|e150c=氨法焦糖色|e150b=亚硫酸法焦糖色|fully-hydrogenated-vegetable-oil=全氢化植物油|free-range-eggs=散养鸡蛋|chili-pepper=辣椒|distilled-vinegar=蒸馏醋
flavour-enhancer=增味剂|potato-starch=马铃薯淀粉|chicken=鸡肉|herb=香草|chicken-fat=鸡油|turmeric=姜黄|red-bell-pepper=红甜椒|pepper=胡椒|nutmeg=肉豆蔻|lovage-root=欧当归根
pasteurized-milk-and-cream=巴氏杀菌乳和奶油|vinegar=醋|chives=细香葱|cider-vinegar=苹果醋|microbial-coagulating-enzyme=微生物凝乳酶|tomato-pulp=番茄果肉|basil=罗勒|brown-sugar=红糖|butter=黄油
soya-oil=大豆油|coconut-fat=椰子脂|exhausted-vanilla-pod=脱脂香草荚|natural-vanilla-flavouring=天然香草香精|cherry-juice=樱桃汁|lemon-juice=柠檬汁|lime-juice=青柠汁|fructose=果糖|rice-starch=米淀粉
anti-caking-agent=抗结剂|peppermint-oil=薄荷油|fat=脂肪|dark-chocolate=黑巧克力|vegetable-juice=蔬菜汁|folate=叶酸盐|wheat-germ=小麦胚芽|modified-palm-oil=改性棕榈油|hydrogenated-palm-kernel-oil=氢化棕榈仁油
gum-base=胶基|humectant=保湿剂|soy-base=大豆基料|concentrated-orange-juice=浓缩橙汁|citrus-pectin=柑橘果胶|natural-lemon-flavouring=天然柠檬香精|lime-flavouring=青柠香精|ham=火腿
modified-potato-starch=变性马铃薯淀粉|beans=豆子|modified-corn-flour=变性玉米粉|spice-extract=香辛料提取物|herb-extract=香草提取物|fruit-pectin=果胶|rice=大米|whole-wheat=全麦
barley=大麦|barley-malt-flavouring=大麦麦芽香精|thiamin-hydrochloride=盐酸硫胺素|calcium-d-pantothenate=D-泛酸钙|flour-blend=混合面粉|zinc-oxide=氧化锌|natural-colours=天然色素|cyanocobalamin=氰钴胺
coating=涂层|cocoa-processed-with-alkali=碱化可可|whey-product=乳清制品|spirulina-concentrate=螺旋藻浓缩物|vegetable-concentrate=蔬菜浓缩物|fruit-and-vegetable-concentrates=果蔬浓缩物|coconut=椰子
oil=油|whey-permeate=乳清渗透物|extract=提取物|retinyl-palmitate=棕榈酸视黄酯|lactic-ferments=乳酸菌|peanut-butter=花生酱|whey-protein=乳清蛋白|spirit-vinegar=酒精醋|hazelnut-paste=榛子酱
egg-yolk=蛋黄|ergocalciferol=维生素D2|roasted-peanut=烘焙花生|oat-flakes=燕麦片|powdered-egg-white=蛋清粉|white-vinegar=白醋|corn-flour=玉米粉|rice-flour=米粉|sucrose=蔗糖|glucose=葡萄糖
taurine=牛磺酸|almond=杏仁|desiccated-coconut=椰蓉|milk-solids=乳固体|apple-juice=苹果汁|orange-juice=橙汁|brown-cane-sugar=红蔗糖|invert-sugar=转化糖|invert-sugar-syrup=转化糖浆
e101=核黄素|e102=柠檬黄|e129=诱惑红|e133=亮蓝|e160a=胡萝卜素|e160b=胭脂树红|e160c=辣椒红|e170i=碳酸钙|e200=山梨酸|e202=山梨酸钾|e211=苯甲酸钠|e212=苯甲酸钾|e222=亚硫酸氢钠|e250=亚硝酸钠
e296=苹果酸|e322=卵磷脂|e322i=卵磷脂|e330=柠檬酸|e338=磷酸|e340=磷酸钾|e341=磷酸钙|e341i=磷酸二氢钙|e375=烟酸|e385=EDTA钙二钠|e407=卡拉胶|e410=刺槐豆胶|e412=瓜尔胶|e414=阿拉伯胶
e415=黄原胶|e418=结冷胶|e428=明胶|e471=单双甘油脂肪酸酯|e476=聚甘油蓖麻醇酸酯|e500=碳酸钠类|e500ii=碳酸氢钠|e501=碳酸钾|e503=碳酸铵|e503ii=碳酸氢铵|e504=碳酸镁|e524=氢氧化钠
e903=巴西棕榈蜡|e901=蜂蜡|e950=安赛蜜|e951=阿斯巴甜|e955=三氯蔗糖|e968=赤藓糖醇|e1200=聚葡萄糖|e1400=糊精|e332ii=柠檬酸钾|e954=糖精|e260=乙酸|e440=果胶|e300=抗坏血酸|e270=乳酸
e282=丙酸钙|e481=硬脂酰乳酸钠|e920=L-半胱氨酸|e492=山梨醇三硬脂酸酯|e450=焦磷酸盐|e472e=DATEM|e162=甜菜红|e100=姜黄素|e120=胭脂红|e171=二氧化钛|e172=氧化铁|e202=山梨酸钾
soya-bean=大豆|malt-vinegar=麦芽醋|anchovy=鳀鱼|tamarind=罗望子|mustard-seed=芥菜籽|hydrolysed-milk-protein=水解乳蛋白|date=枣|tomato-puree=番茄泥|diced-tomatoes-in-tomato-juice=番茄汁浸番茄丁|garlic-extract=大蒜提取物|malt-flavouring=麦芽香精|fruit-juice-from-concentrate=浓缩还原果汁|partially-hydrogenated-soybean-oil=部分氢化大豆油|brown-rice-flour=糙米粉|wholemeal-oat-flour=全麦燕麦粉|buttermilk=酪乳|popcorn=爆米花|torula-yeast=产朊假丝酵母|raisin=葡萄干|wheat-bran=麦麸|brown-sugar-syrup=红糖浆|cinnamon=肉桂|celery=芹菜|blackcurrant-juice-from-concentrate=浓缩还原黑加仑汁|roselle-flower=洛神花|natural-blackcurrant-flavouring=天然黑加仑香精|dried-apple=苹果干|onion-extract=洋葱提取物|rice-vinegar=米醋|mustard-powder=芥末粉|white-wine=白葡萄酒|apple-pieces=苹果块|beef-gelatin=牛明胶|brown-rice-syrup=糙米糖浆|pork=猪肉|iodised-salt=碘盐|alcohol-vinegar=酒精醋|calcium=钙|whole-egg=全蛋|natural-orange-flavouring=天然橙味香精|cereals-containing-gluten=含麸质谷物|juice=果汁|hydrogenated-cottonseed-oil=氢化棉籽油|cocoa-powder-processed-with-alkali=碱化可可粉|pork-gelatin=猪明胶|dehydrated-glucose-syrup=脱水葡萄糖浆|cocoa-solids=可可固形物|whey-permeate-powder=乳清渗透物粉|orange-essential-oil=橙精油|cane-sugar=蔗糖|mint-oil=薄荷油|sunflower=葵花籽|paprika=红辣椒粉|jalapeno-pepper=墨西哥辣椒|autolyzed-yeast-extract=自溶酵母提取物|green-bell-pepper=青甜椒|barley-flour=大麦粉|oat-flour=燕麦粉|corn-maltodextrin=玉米麦芽糊精|wholemeal-oat=全麦燕麦|roasted-peanuts=烘焙花生|cornmeal=玉米粗粉|chicory-fibre=菊苣纤维|palm-kernel-oil=棕榈仁油|carob-bean=角豆|pea-protein=豌豆蛋白|cashew-nuts=腰果|concentrated-juice=浓缩果汁|puree=果泥|fruit-juice=果汁|concentrated-apple-juice=浓缩苹果汁|peach-puree=桃泥|filtered-water=过滤水|beetroot=甜菜根|parsley=欧芹|lettuce=生菜|watercress=豆瓣菜|spinach=菠菜|coconut-water=椰子水|tea=茶|lemon-puree=柠檬泥|lemon=柠檬|with-other-natural-flavouring=其他天然香精|orange-juice-from-concentrate=浓缩还原橙汁|mixed-fruit=什锦水果|yogurt=酸奶|caramelised-sugar-syrup=焦糖糖浆|cheese=奶酪|dehydrated-onion=脱水洋葱|courgette=西葫芦|green-pepper=青椒|vegetable-blend=混合蔬菜|malt=麦芽|eau-de-vie=白兰地|soya-bean-paste=豆酱|sweet-potato=红薯|sesame-paste=芝麻酱|pasteurised-egg-yolk=巴氏杀菌蛋黄|mustard=芥末|white-distilled-vinegar=白蒸馏醋
e110=日落黄|e321=BHT抗氧化剂|e422=甘油|e440a=果胶|e223=焦亚硫酸钠|e442=磷脂酸铵|e445=松香甘油酯|e508=氯化钾|e905a=矿物油|e1103=转化酶|e452i=多聚磷酸钠|e466=羧甲基纤维素|e900a=聚二甲基硅氧烷|e220=二氧化硫|e450i=焦磷酸二钠|e331=柠檬酸钠|e141ii=叶绿素铜钠|e262ii=二乙酸钠|e576=葡萄糖酸钠|e999=皂树提取物|e621=谷氨酸钠|e334=酒石酸
`;
export const ZH = Object.fromEntries(T.split(/[|\n]/).map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
const isE = (id) => /^e\d{3,4}[a-z]*$/.test(id);
const eName = (id) => { const m = id.match(/^e(\d+)([a-z]*)$/); return `E${m[1]}${m[2]}`.replace(/(i+)$/, (x) => x); };
/** [zh, en] display pair for an id, or null if untranslated. */
export function display(id) {
  const zh = ZH[id];
  if (!zh) return null;
  if (isE(id)) return [zh, eName(id).replace(/^E(\d+)([a-z]*)$/, (m, d, s) => `E${d}${s}`)];
  return [zh, id.replace(/-/g, ' ')];
}
