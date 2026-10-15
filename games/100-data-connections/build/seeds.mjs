// [kind, English name (used to resolve the QID on Wikidata)]
// kinds: film (P57 director) · actor (P161) · book (P50 author) · art (P170 creator) · music (P175 performer) · game (P178 developer) · border (P47)
export const SEEDS = [
  ['film', 'Christopher Nolan'], ['film', 'Stanley Kubrick'], ['film', 'Alfred Hitchcock'],
  ['film', 'Steven Spielberg'], ['film', 'Quentin Tarantino'], ['film', 'Hayao Miyazaki'],
  ['film', 'Martin Scorsese'], ['film', 'James Cameron'], ['film', 'Tim Burton'],
  ['film', 'Ridley Scott'], ['film', 'David Fincher'], ['film', 'Wes Anderson'],
  ['film', 'Akira Kurosawa'], ['film', 'Zhang Yimou'], ['film', 'Ang Lee'],
  ['film', 'Wong Kar-wai'], ['film', 'Peter Jackson'], ['film', 'Francis Ford Coppola'],
  ['film', 'Woody Allen'], ['film', 'Clint Eastwood'], ['film', 'Stephen Chow'],
  ['film', 'Robert Zemeckis'], ['film', 'Guy Ritchie'], ['film', 'Denis Villeneuve'],
  ['actor', 'Tom Hanks'], ['actor', 'Leonardo DiCaprio'], ['actor', 'Brad Pitt'],
  ['actor', 'Tom Cruise'], ['actor', 'Johnny Depp'], ['actor', 'Will Smith'],
  ['actor', 'Jackie Chan'], ['actor', 'Robert De Niro'], ['actor', 'Keanu Reeves'],
  ['actor', 'Morgan Freeman'], ['actor', 'Meryl Streep'], ['actor', 'Jet Li'],
  ['actor', 'Tony Leung Chiu-wai'], ['actor', 'Bruce Willis'], ['actor', 'Matt Damon'],
  ['book', 'Charles Dickens'], ['book', 'Agatha Christie'], ['book', 'J. R. R. Tolkien'],
  ['book', 'J. K. Rowling'], ['book', 'Stephen King'], ['book', 'George Orwell'],
  ['book', 'Ernest Hemingway'], ['book', 'Jane Austen'], ['book', 'Jin Yong'],
  ['book', 'Haruki Murakami'], ['book', 'Dan Brown'], ['book', 'Mark Twain'],
  ['book', 'William Shakespeare'], ['book', 'Lu Xun'], ['book', 'Jules Verne'],
  ['book', 'Keigo Higashino'], ['book', 'Liu Cixin'], ['book', 'Victor Hugo'],
  ['book', 'Leo Tolstoy'], ['book', 'Isaac Asimov'], ['book', 'Arthur Conan Doyle'],
  ['music', 'The Beatles'], ['music', 'Taylor Swift'], ['music', 'Bob Dylan'],
  ['music', 'Michael Jackson'], ['music', 'Pink Floyd'], ['music', 'Queen'],
  ['music', 'Jay Chou'], ['music', 'Madonna'], ['music', 'Adele'],
  ['music', 'Coldplay'], ['music', 'Eason Chan'], ['music', 'Nirvana'],
  ['music', 'Eminem'], ['music', 'The Rolling Stones'], ['music', 'David Bowie'],
  ['music', 'Beyoncé'], ['music', 'Radiohead'], ['music', 'Elvis Presley'],
  ['music', 'Lady Gaga'], ['music', 'Faye Wong'], ['music', 'Teresa Teng'],
  ['game', 'Nintendo'], ['game', 'Sega'], ['game', 'Capcom'], ['game', 'Square Enix'],
  ['game', 'Valve Corporation'], ['game', 'Blizzard Entertainment'], ['game', 'Rockstar Games'],
  ['game', 'Konami'], ['game', 'Bethesda Game Studios'], ['game', 'Electronic Arts'],
  ['border', 'France'], ['border', 'Germany'], ['border', "People's Republic of China"],
  ['border', 'Brazil'], ['border', 'Russia'], ['border', 'Turkey'],
  ['border', 'Poland'], ['border', 'Argentina'], ['border', 'Italy'],
  ['border', 'Austria'], ['border', 'Kazakhstan'], ['border', 'Iran'], ['border', 'Ukraine'],
];
// Wikidata's "shares border with" (P47) also lists sea borders and overseas territories, so for countries we keep only
// the neighbours that really touch by land (checked by hand against an atlas). Keys = English label of the subject.
export const LAND = {
  France: ['Belgium', 'Luxembourg', 'Germany', 'Switzerland', 'Italy', 'Monaco', 'Spain', 'Andorra', 'Brazil', 'Suriname'],
  Germany: ['Denmark', 'Poland', 'Czech Republic', 'Czechia', 'Austria', 'Switzerland', 'France', 'Luxembourg', 'Belgium', 'Netherlands'],
  "People's Republic of China": ['Russia', 'Mongolia', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bhutan', 'Myanmar', 'Laos', 'Vietnam', 'North Korea'],
  Brazil: ['Uruguay', 'Argentina', 'Paraguay', 'Bolivia', 'Peru', 'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'France'],
  Russia: ['Norway', 'Finland', 'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Belarus', 'Ukraine', 'Georgia', 'Azerbaijan', 'Kazakhstan', "People's Republic of China", 'Mongolia', 'North Korea'],
  Turkey: ['Greece', 'Bulgaria', 'Georgia', 'Armenia', 'Azerbaijan', 'Iran', 'Iraq', 'Syria'],
  Poland: ['Germany', 'Czech Republic', 'Czechia', 'Slovakia', 'Ukraine', 'Belarus', 'Lithuania', 'Russia'],
  Argentina: ['Chile', 'Bolivia', 'Paraguay', 'Brazil', 'Uruguay'],
  Italy: ['France', 'Switzerland', 'Austria', 'Slovenia', 'San Marino', 'Vatican City'],
  Austria: ['Germany', 'Czech Republic', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Italy', 'Switzerland', 'Liechtenstein'],
  Kazakhstan: ['Russia', "People's Republic of China", 'Kyrgyzstan', 'Uzbekistan', 'Turkmenistan'],
  Iran: ['Iraq', 'Turkey', 'Armenia', 'Azerbaijan', 'Turkmenistan', 'Afghanistan', 'Pakistan'],
  Ukraine: ['Poland', 'Slovakia', 'Hungary', 'Romania', 'Moldova', 'Belarus', 'Russia'],
};
export const KINDS = {
  film: { prop: 'P57', tpl: 'Films directed by {}', unit: 'film', type: 'wd:Q11424' },
  actor: { prop: 'P161', tpl: 'Films starring {}', unit: 'film', type: 'wd:Q11424' },
  book: { prop: 'P50', tpl: 'Works by {}', unit: 'literary work', type: 'wd:Q8261 wd:Q7725634 wd:Q47461344 wd:Q149537 wd:Q25379 wd:Q49084', direct: true },
  // art: { prop: 'P170', tpl: 'Paintings by {}', unit: 'painting', type: 'wd:Q3305213' },
  music: { prop: 'P175', tpl: 'Albums and songs by {}', unit: 'album or song', type: 'wd:Q482994 wd:Q7366 wd:Q134556 wd:Q169930' },
  game: { prop: 'P178', tpl: 'Games developed by {}', unit: 'game', type: 'wd:Q7889' },
  border: { prop: 'P47', tpl: 'Countries sharing a land border with {}', unit: 'country', type: 'wd:Q6256' },
};

// Short display names for the subjects whose Wikidata English label is long.
export const SHORT = {
  "People's Republic of China": 'China', 'Valve Corporation': 'Valve', 'Blizzard Entertainment': 'Blizzard',
  'Bethesda Game Studios': 'Bethesda', 'Tony Leung Chiu-wai': 'Tony Leung', 'Electronic Arts': 'EA',
};
