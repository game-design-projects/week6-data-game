// Pure helpers for #76 Tagged (shared by game.js and build/build.mjs).
export const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
};

// words in a title that betray a tag
const ALIAS = {
  reactjs: ['react'], 'node.js': ['node', 'nodejs'], javascript: ['javascript', 'js'], 'python-3.x': ['python'], 'ecmascript-6': ['es6', 'ecmascript'],
  'c#': ['c#'], 'c++': ['c++'], '.net': ['.net', 'dotnet'], 'asp.net': ['asp.net'], postgresql: ['postgres', 'postgresql'], 'vue.js': ['vue'],
  'next.js': ['next.js', 'nextjs'], 'angularjs': ['angularjs', 'angular'], 'vs-code': ['vs code', 'vscode', 'visual studio code'], 'github-actions': ['github actions'],
  'sql-server': ['sql server'], 'react-native': ['react native'], 'react-hooks': ['hook', 'usestate', 'useeffect'], 'android-studio': ['android studio'],
  'java-8': ['java 8'], 'windows-10': ['windows 10'], 'create-react-app': ['create-react-app', 'create react app'], 'python-typing': ['typing', 'type hint'],
  arrays: ['array'], dictionary: ['dictionary', 'dict'], loops: ['loop'], string: ['string'], list: ['list'], 'environment-variables': ['environment variable'],
};
const norm = (s) => ` ${s.toLowerCase().replace(/[^a-z0-9#+.]+/g, ' ')} `;
export function titleHits(title, tags) {
  const T = norm(title);
  return tags.filter((tag) => {
    const forms = new Set([tag.replace(/-/g, ' '), tag.replace(/[-.]js$/, ''), ...(ALIAS[tag] || [])].map((s) => s.toLowerCase()));
    for (const w of forms) {
      const k = norm(w).trim();
      if (!k) continue;
      const hit = /[#+]/.test(k) ? T.includes(k) : new RegExp(`(^|[^a-z0-9])${k.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&')}(s|es)?($|[^a-z0-9])`).test(T);
      if (hit) return true;
    }
    return false;
  });
}
