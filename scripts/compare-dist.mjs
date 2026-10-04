// Compare deux builds Astro page par page, aux hash près.
// Usage : node scripts/compare-dist.mjs <dossierA> <dossierB>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [a, b] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) return walk(p);
  return p.endsWith('.html') || p.endsWith('.xml') ? [p] : [];
});
const norm = (s) => s
  .replace(/\/_astro\/[^"' )]+/g, '/_astro/X')
  .replace(/data-astro-cid-[a-z0-9]+/g, 'data-astro-cid-X')
  .replace(/astro-[a-z0-9]{8}/g, 'astro-X')
  .replace(/ uid="[^"]+"/g, ' uid="X"');

const pagesA = walk(a).map((p) => relative(a, p)).sort();
const pagesB = new Set(walk(b).map((p) => relative(b, p)));
let bad = 0;
for (const p of pagesA) {
  if (p.startsWith('admin/')) continue;
  if (!pagesB.has(p)) { console.log('MANQUANTE', p); bad++; continue; }
  const x = norm(readFileSync(join(a, p), 'utf8'));
  const y = norm(readFileSync(join(b, p), 'utf8'));
  if (x !== y) {
    let i = 0;
    while (x[i] === y[i]) i++;
    console.log('DIFF', p, '\n  avant:', x.slice(Math.max(0, i - 80), i + 80), '\n  après:', y.slice(Math.max(0, i - 80), i + 80));
    bad++;
  }
}
// Pages en plus : signalées sans échec (fichiers locaux non suivis, nouvelles routes).
for (const p of pagesB) if (!p.startsWith('admin/') && !pagesA.includes(p)) console.log('EN PLUS (info)', p);
console.log(bad ? `${bad} page(s) différente(s)` : `OK, ${pagesA.length} pages identiques`);
process.exit(bad ? 1 : 0);
