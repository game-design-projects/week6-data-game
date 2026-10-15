// id, display name, domain, extra words to redact
export const SITES = [
  ['google','Google','google.com',[]],['yahoo','Yahoo!','yahoo.com',['yahoo']],['amazon','Amazon','amazon.com',[]],
  ['ebay','eBay','ebay.com',[]],['cnn','CNN','cnn.com',['cable news network']],['bbc','BBC','bbc.co.uk',['bbc']],
  ['nytimes','New York Times','nytimes.com',['new york times','nyt','times']],['washingtonpost','Washington Post','washingtonpost.com',['washington post','washpost','washington','post','imwashington','kidspost','postglobal']],
  ['wikipedia','Wikipedia','wikipedia.org',['wikipedia']],['apple','Apple','apple.com',[]],['microsoft','Microsoft','microsoft.com',[]],
  ['ibm','IBM','ibm.com',[]],['nasa','NASA','nasa.gov',['national aeronautics']],['whitehouse','White House','whitehouse.gov',['white house']],
  ['mit','MIT','mit.edu',['massachusetts institute of technology','massachusetts institute']],['stanford','Stanford','stanford.edu',[]],['harvard','Harvard','harvard.edu',[]],
  ['nyu','NYU','nyu.edu',['new york university']],['craigslist','Craigslist','craigslist.org',[]],['imdb','IMDb','imdb.com',['internet movie database']],
  ['espn','ESPN','espn.com',['espn']],['weather','Weather.com','weather.com',['weather channel']],['mozilla','Mozilla','mozilla.org',['firefox']],
  ['github','GitHub','github.com',[]],['twitter','Twitter / X','twitter.com',['twitter','tweet']],['facebook','Facebook','facebook.com',[]],
  ['youtube','YouTube','youtube.com',[]],['netflix','Netflix','netflix.com',[]],['spotify','Spotify','spotify.com',[]],
  ['reddit','Reddit','reddit.com',[]],['nike','Nike','nike.com',[]],['mcdonalds','McDonald\'s','mcdonalds.com',["mcdonald"]],
  ['cocacola','Coca-Cola','coca-cola.com',['coke']],['disney','Disney','disney.com',[]],['ford','Ford','ford.com',[]],
  ['nba','NBA','nba.com',[]],['adobe','Adobe','adobe.com',[]],['oracle','Oracle','oracle.com',[]],['intel','Intel','intel.com',[]],
  ['wired','Wired','wired.com',[]],['guardian','The Guardian','theguardian.com',['guardian']],['usps','USPS','usps.com',['postal service']],
  ['walmart','Walmart','walmart.com',[]],['target','Target','target.com',[]],['bestbuy','Best Buy','bestbuy.com',['best buy']],
  ['slashdot','Slashdot','slashdot.org',[]],['npr','NPR','npr.org',['national public radio']],['cdc','CDC','cdc.gov',['centers for disease control']],
  ['ups','UPS','ups.com',[]],['paypal','PayPal','paypal.com',[]],['linkedin','LinkedIn','linkedin.com',[]],
];
export const YEARS = [1997,1999,2001,2003,2005,2007,2009,2011,2013,2015,2017,2019,2021,2023];

// one-line Chinese context shown after the guess (what the site is) — hand written
export const ABOUT = {
  google:'全球最大的搜索引擎，1998 年成立。', yahoo:'90 年代最大的门户网站与目录。', amazon:'美国电商与云计算巨头，1995 年上线。', ebay:'美国在线拍卖/二手交易平台，1995 年上线。',
  cnn:'美国有线电视新闻网的网站。', bbc:'英国广播公司，英国国家公共媒体。', nytimes:'《纽约时报》，美国报纸。', washingtonpost:'《华盛顿邮报》，美国报纸。',
  wikipedia:'维基百科，志愿者编写的在线百科全书。', apple:'苹果公司官网。', microsoft:'微软官网。', ibm:'IBM 官网，老牌计算机公司。', nasa:'美国国家航空航天局官网。',
  whitehouse:'美国总统府官网。', mit:'麻省理工学院官网。', stanford:'斯坦福大学官网。', harvard:'哈佛大学官网。', nyu:'纽约大学官网。', craigslist:'分类广告网站，几十年来页面几乎不变。',
  imdb:'互联网电影数据库。', espn:'美国体育电视网官网。', weather:'美国 The Weather Channel 的天气网站。', mozilla:'Firefox 浏览器背后的 Mozilla 基金会。', github:'代码托管平台。',
  twitter:'推特（现 X）。', facebook:'脸书。', youtube:'视频网站。', netflix:'流媒体/DVD 租赁。', spotify:'音乐流媒体。', reddit:'论坛聚合社区。', nike:'运动品牌。',
  mcdonalds:'麦当劳官网。', cocacola:'可口可乐官网。', disney:'迪士尼官网。', ford:'福特汽车官网。', nba:'美国职业篮球联赛官网。', adobe:'Photoshop 与 Flash 的出品公司。',
  oracle:'数据库软件公司。', intel:'芯片公司。', wired:'《连线》杂志。', guardian:'英国《卫报》。', usps:'美国邮政署。', walmart:'美国最大零售商。', target:'美国连锁零售商。',
  bestbuy:'美国电器连锁店。', slashdot:'极客新闻网站，“News for Nerds”。', npr:'美国国家公共广播电台。', cdc:'美国疾病控制与预防中心。', ups:'联合包裹快递。',
  paypal:'在线支付。', linkedin:'职场社交网络。',
};
