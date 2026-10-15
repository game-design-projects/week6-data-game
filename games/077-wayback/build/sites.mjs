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

// one-line context shown after the guess (what the site is), hand written
export const ABOUT = {
  google:'The world\'s biggest search engine, founded in 1998.', yahoo:'The biggest portal and web directory of the 1990s.', amazon:'US e-commerce and cloud giant, online since 1995.', ebay:'US online auction and resale marketplace, online since 1995.',
  cnn:'The website of the US cable news network.', bbc:'The British Broadcasting Corporation, the UK\'s public broadcaster.', nytimes:'The New York Times, a US newspaper.', washingtonpost:'The Washington Post, a US newspaper.',
  wikipedia:'Wikipedia, the online encyclopedia written by volunteers.', apple:'Apple\'s corporate site.', microsoft:'Microsoft\'s corporate site.', ibm:'IBM\'s site, the veteran computer company.', nasa:'The US space agency\'s site.',
  whitehouse:'The official site of the US presidency.', mit:'The Massachusetts Institute of Technology\'s site.', stanford:'Stanford University\'s site.', harvard:'Harvard University\'s site.', nyu:'New York University\'s site.', craigslist:'Classified ads, with a page that has barely changed in decades.',
  imdb:'The Internet Movie Database.', espn:'The US sports network\'s site.', weather:'The Weather Channel\'s weather site.', mozilla:'The Mozilla foundation behind the Firefox browser.', github:'A code-hosting platform.',
  twitter:'The microblogging service, now X.', facebook:'The social network.', youtube:'The video site.', netflix:'Streaming and DVD rental.', spotify:'Music streaming.', reddit:'A forum-style community aggregator.', nike:'The sportswear brand.',
  mcdonalds:'McDonald\'s corporate site.', cocacola:'Coca-Cola\'s corporate site.', disney:'Disney\'s corporate site.', ford:'Ford Motor Company\'s site.', nba:'The National Basketball Association\'s site.', adobe:'The company behind Photoshop and Flash.',
  oracle:'The database software company.', intel:'The chip company.', wired:'Wired magazine.', guardian:'The Guardian, a British newspaper.', usps:'The US Postal Service.', walmart:'The largest US retailer.', target:'A US retail chain.',
  bestbuy:'A US electronics retail chain.', slashdot:'The geek news site, \u201cNews for Nerds\u201d.', npr:'National Public Radio in the US.', cdc:'The US Centers for Disease Control and Prevention.', ups:'United Parcel Service.',
  paypal:'Online payments.', linkedin:'The professional social network.',
};
