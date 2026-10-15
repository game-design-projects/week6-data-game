// Pure helpers shared by build.mjs and game.test.mjs: mask vendor/product names (▇▇▇) and the weakness name (◆◆◆).
export const VENDOR_MASK = '▇▇▇';
export const CWE_MASK = '◆◆◆';

// mask = phrases/stems replaced by ◆◆◆; leak = if any of these still match afterwards the entry is dropped.
const R = (s) => new RegExp(s, 'gi');
export const RULES = {
  'CWE-79': { mask: ['cross[- ]?site[- ]?scripting', '\\bXSS\\b', 'web script or HTML', '(HTML|script) injection', 'inject\\w* (arbitrary |malicious )?(java)?script'], leak: ['xss', 'cross[- ]?site script', '(html|script) injection', 'web script'] },
  'CWE-89': { mask: ['\\bSQL\\w*( injection)?'], leak: ['\\bsql'] },
  'CWE-22': { mask: ['(path|directory|dot[- ]dot|zip[- ]?slip) traversal', '\\btraversal\\b', '(\\.\\.[\\\\/])+', 'dot dot'], leak: ['traversal', '\\.\\./', '\\.\\.\\\\'] },
  'CWE-78': { mask: ['(OS |operating system )?command injection', 'shell injection', 'OS commands?'], leak: ['command injection', 'os command'] },
  'CWE-77': { mask: ['(OS |operating system )?command injection', 'shell injection', 'OS commands?'], leak: ['command injection', 'os command'] },
  'CWE-352': { mask: ['cross[- ]?site request forgery', '\\bCSRF\\b', '\\bXSRF\\b', 'request forgery'], leak: ['csrf', 'xsrf', 'request forgery'] },
  'CWE-787': { mask: ['out[- ]of[- ]bounds( write| read)?', '\\bOOB( write| read)?\\b', '(heap|stack)[- ](based )?(buffer )?overflow', 'buffer overflow', 'overflow', 'memory corruption'], leak: ['out[- ]of[- ]bounds', 'overflow', 'oob'] },
  'CWE-125': { mask: ['out[- ]of[- ]bounds( write| read)?', '\\bOOB( write| read)?\\b', '(heap|stack)[- ](based )?(buffer )?over-?read', 'buffer over-?read', 'over-?read'], leak: ['out[- ]of[- ]bounds', 'over-?read', 'oob'] },
  'CWE-416': { mask: ['use[- ]after[- ]free', '\\bUAF\\b', 'dangling pointer', 'double[- ]free', 'freed memory'], leak: ['after[- ]free', 'dangling', 'double[- ]free', 'freed'] },
  'CWE-476': { mask: ['NULL[- ]pointer( dereference)?', 'null dereference', '\\bNPD\\b', '\\bNULL\\w*'], leak: ['\\bnull', 'npd'] },
  'CWE-862': { mask: ['missing authori[sz]ation', 'lack of authori[sz]ation', 'missing capability check', '(broken |missing )?access control'], leak: ['missing authori', 'lack of authori', 'access control', 'capability check'] },
  'CWE-918': { mask: ['server[- ]side request forgery', '\\bSSRF\\b', 'request forgery'], leak: ['ssrf', 'request forgery'] },
  'CWE-434': { mask: ['(unrestricted |arbitrary )?(file )?upload of (a )?(file|dangerous)[\\w ]*type', '(unrestricted|arbitrary) (file )?upload', 'dangerous type'], leak: ['unrestricted', 'arbitrary file upload', 'dangerous type', 'file upload'] },
  'CWE-502': { mask: ['deserializ\\w+', 'unserializ\\w+'], leak: ['deserializ', 'unserializ'] },
  'CWE-287': { mask: ['improper authentication', '(missing|broken) authentication', 'authentication bypass', 'bypass(es|ing)? (of )?authentication'], leak: ['improper authentication', 'authentication bypass', 'missing authentication', 'bypass\\w* (of )?authentication'] },
  'CWE-94': { mask: ['(arbitrary |remote )?code injection', 'improper control of generation of code', 'eval injection'], leak: ['code injection', 'generation of code'] },
  'CWE-200': { mask: ['exposure of sensitive information', 'sensitive information (exposure|disclosure)', 'information (disclosure|exposure|leak\\w*)'], leak: ['information (disclosure|exposure|leak)', 'sensitive information'] },
  'CWE-120': { mask: ['classic buffer overflow', '(heap|stack)[- ](based )?(buffer )?overflow', 'buffer (copy|overflow)', 'overflow'], leak: ['overflow', 'buffer copy'] },
  'CWE-400': { mask: ['uncontrolled resource consumption', 'resource (exhaustion|consumption)'], leak: ['resource consumption', 'resource exhaustion'] },
  'CWE-611': { mask: ['\\bXXE\\b( injection)?', 'XML external entit\\w+( injection)?', 'external entit\\w+'], leak: ['xxe', 'external entit'] },
  'CWE-601': { mask: ['open redirect\\w*', 'redirect\\w*'], leak: ['redirect'] },
  'CWE-798': { mask: ['hard-?coded( \\w+)?', 'embedded credentials'], leak: ['hard-?coded', 'embedded credential'] },
  'CWE-190': { mask: ['integer (overflow|underflow|wraparound)', 'wrap[- ]?around', 'overflow', 'underflow'], leak: ['overflow', 'underflow', 'wrap'] },
  'CWE-639': { mask: ['insecure direct object reference', '\\bIDOR\\b', 'authorization bypass through user-controlled key', 'user-controlled key'], leak: ['idor', 'direct object', 'user-controlled key'] },
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strip HTML entities and normalise whitespace. */
export const cleanDesc = (d) => d.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** Words of real content left once masks and boilerplate are removed. */
export function contentWords(red) {
  return red.replace(/[▇◆]+/g, ' ').replace(/VDB-[▇\d]+/g, ' ').replace(/The (exploit|attack) (has been|may be)[^.]*\./gi, ' ')
    .replace(/\b(a|an|the|is|in|of|to|and|or|was|be|this|that|which|as|by|for|with|from|through|n\/a|found|affected|vulnerability)\b/gi, ' ')
    .split(/[^A-Za-z]+/).filter((w) => w.length > 2).length;
}

/** Redact one CVE description. Returns null if it cannot be made safe/informative. */
export function redactDesc(desc, names, cwe) {
  let red = cleanDesc(desc);
  if (/https?:\/\//i.test(red)) return null;
  for (const n of [...names].sort((a, b) => b.length - a.length)) {
    const re = new RegExp('(?<![A-Za-z0-9])' + esc(n) + '(?![A-Za-z0-9])', 'gi');
    red = red.replace(re, VENDOR_MASK);
  }
  red = red.replace(/CVE-\d+-\d+/g, VENDOR_MASK).replace(/CWE-\d+/g, VENDOR_MASK).replace(/VDB-\d+/g, 'VDB-' + VENDOR_MASK)
    .replace(/\b(classified|declared|rated|categorized|considered) as (\w+)/gi, `$1 as ${VENDOR_MASK}`)
    .replace(/\b(severity|risk)(:| is| of)? (low|medium|moderate|high|critical|important)\b/gi, `$1$2 ${VENDOR_MASK}`)
    .replace(/\bfrom n\/a through\b/gi, 'through');
  const rule = RULES[cwe];
  for (const m of rule.mask) red = red.replace(R(m), CWE_MASK);
  red = red.replace(/◆◆◆(\s*[\/,(]?\s*(and|or)?\s*◆◆◆\)?)+/g, CWE_MASK).replace(/◆◆◆\s*\(◆◆◆\)/g, CWE_MASK).replace(/\(◆◆◆\)/g, CWE_MASK)
    .replace(/▇▇▇(\s*▇▇▇)+/g, (m) => m.split(/\s+/).slice(0, 2).join(' ')).replace(/\s+/g, ' ');
  for (const l of rule.leak) if (R(l).test(red)) return null;
  if ((red.match(/▇▇▇/g) || []).length > 5) return null;
  if (contentWords(red) < 12) return null;
  if (!hasHint(red, cwe)) return null;
  return red;
}

// If the weakness name was masked (◆◆◆) the text is guessable by exclusion + clues; otherwise it must still contain a cue word.
export const HINTS = {
  'CWE-79': 'script|html|sanitiz|escap|encod|parameter|cookie|browser|inject|input|field|title|name',
  'CWE-89': 'quer|database|parameter|argument|inject|input|\\bid\\b|param',
  'CWE-22': 'file|director|path|folder|read|download|\\.\\./|zip|archive|upload',
  'CWE-78': 'command|shell|exec|system\\(|os |input|parameter|argument|cgi|telnet',
  'CWE-77': 'command|shell|exec|input|parameter|argument|cgi',
  'CWE-352': 'request|forge|logged|admin|click|session|nonce|token|csrf',
  'CWE-787': 'write|memory|corrupt|buffer|heap|stack|bounds|crafted|parsing|parser|size',
  'CWE-125': 'read|memory|buffer|bounds|crafted|parsing|parser|disclos|size',
  'CWE-416': 'free|memory|heap|dangling|race|pointer|corrupt',
  'CWE-476': 'null|pointer|crash|denial|dereference|panic',
  'CWE-862': 'authori|permission|privilege|capabilit|access|unauthenticated|check|role',
  'CWE-918': 'request|server|internal|url|fetch|connection|webhook|proxy',
  'CWE-434': 'upload|file|extension|type|php|shell|execut',
  'CWE-502': 'object|serializ|pickle|gadget|untrusted|instantiat',
  'CWE-287': 'authenticat|login|password|credential|session|token|bypass|log in',
  'CWE-94': 'code|eval|script|template|inject|execut',
  'CWE-200': 'sensitive|disclos|expos|leak|read|obtain|information|view|log|data',
  'CWE-120': 'copy|buffer|memory|length|size|crash|stack|heap|strcpy|input',
  'CWE-400': 'resource|memory|cpu|denial|exhaust|consum|loop|crash|large|request|hang',
  'CWE-611': 'xml|entit|parser|dtd',
  'CWE-601': 'url|link|phish|redirect|malicious|site|website',
  'CWE-798': 'password|credential|key|secret|account|login|default|token',
  'CWE-190': 'integer|overflow|size|length|memory|wrap|calculation|parsing',
  'CWE-639': 'id|identifier|other user|another user|object|parameter|access|authoriz|permission|key',
};
export const hasHint = (red, cwe) => red.includes(CWE_MASK) || new RegExp(HINTS[cwe], 'i').test(red.replace(/[▇◆]+/g, ' '));
