#!/usr/bin/env node
/**
 * Lite tax-canon guard. It keeps Lite's compact current-state explanation in
 * sync with the full site without importing the full Path 2 procedural record.
 */
import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const failures = [];
const passes = [];
const check = (ok, label, detail = '') => (ok ? passes : failures).push(`${label}${detail ? ` — ${detail}` : ''}`);

const systems = read('systems.html');
const simulations = read('simulations.html');
const activeCascade = '50 / 25 / 12.5 / 6.25';

check(systems.includes(activeCascade), 'Systems states the active 50/25/12.5/6.25 cascade');
check(/Schedule A and Schedule B are active/.test(systems), 'Systems states both schedules active');
check(/effective from 2295/.test(systems), 'Systems states the 2295 effective date');
check(/Savings Circulation Mandate is unchanged/.test(systems), 'Systems preserves SCM unchanged');
check(/\+1 \/ Main<\/td><td[^>]*>50%/.test(systems), 'Systems table gives Sanctuary/Main the 50% top rate');
check(/-1<\/td><td[^>]*>25%/.test(systems) && /-2<\/td><td[^>]*>12\.5%/.test(systems) && /-3<\/td><td[^>]*>6\.25%/.test(systems),
  'Systems table gives the exact 25/12.5/6.25 lower cascade');
check(/active 6\.25% top marginal rate above \$10 million/.test(simulations), 'simulation states the active -3 6.25% top rate');

const textFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const rel = join(prefix, entry.name);
  if (entry.isDirectory()) return textFiles(join(dir, entry.name), rel);
  return /\.(html|md|txt|json|js|mjs|cjs|ts|xml|ya?ml)$/i.test(entry.name) ? [rel] : [];
});

const stale = [];
for (const file of textFiles(ROOT)) {
  if (file === 'tools/check-tax-canon.mjs') continue;
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    const currentTax = /\b(tax|taxation|marginal|income|schedule)\b/i.test(line);
    /* Status and explicit “active rate” claims are doctrine on their own and
       must not evade the guard merely because a future editor omits the word
       tax from the same line. Broader 35/17/8 number checks retain a tax
       context so STI, vote, and other unrelated percentages stay allowed. */
    const standaloneDoctrine = /50\s*\/\s*35\s*\/\s*17\s*\/\s*8|Schedule B (?:remains |is )?pending|active (?:8|17|35)%|10[–-]15% taxation/i.test(line);
    const semanticLegacyRate = /(?:\b(?:8|17|35)\s*%\s+(?:top\s*)?marginal(?:\s+(?:tax|rate))?|\b(?:top\s*)?marginal(?:\s+(?:tax|rate))?[^.]{0,42}\b(?:8|17|35)\s*%|\b(?:tax(?:ation)?\s+rate|rate\s+of)[^.]{0,24}\b(?:8|17|35)\s*%)/i.test(line);
    if (standaloneDoctrine || (currentTax && semanticLegacyRate)) stale.push(`${file}:${index + 1}: ${line.trim().slice(0, 180)}`);
  });
}
check(stale.length === 0, 'Lite text scan finds no stale split/pending/live-lower tax patterns', stale.length ? stale.join('; ') : 'current Lite tax prose clean');

console.log(`\nLite tax canon check — ${passes.length} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log(`  Active cascade: ${activeCascade}; Schedules A and B active from 2295; SCM unchanged.`);
