// pure helpers shared by build.mjs and tests
export const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
export const cleanTitle = (t) => t.replace(/\s+/g, ' ').replace(/(From|Theme From|Love Theme From)"/, '$1 "').replace(/\s+\)/g, ')').trim();
