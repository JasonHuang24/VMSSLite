#!/usr/bin/env node
/**
 * Lite tax-canon guard.
 *
 * Lite has no rate-history archive or build pipeline, so its public Systems
 * and simulations pages must state the active fiscal position directly. This
 * small zero-dependency checker keeps the Lite repository independently
 * synchronized with the full VMSS site's active tax canon.
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
const activeComposite = '50 / 35 / 17 / 8';

check(systems.includes(activeComposite), 'Systems states the active 50/35/17/8 composite');
check(/Schedule A is active/.test(systems), 'Systems states Schedule A active');
check(/Schedule B remains pending/.test(systems), 'Systems states Schedule B pending');
check(!/\bSchedule B\b[\s\S]{0,160}\b(?:inactive|not active|not in force)\b/i.test(systems),
  'Systems describes Schedule B as pending, not inactive');
check(/effective from 2295/.test(systems), 'Systems states the 2295 effective date');
check(/Savings Circulation Mandate is unchanged/.test(systems), 'Systems preserves SCM unchanged');
check(/\+1 \/ Main<\/td><td[^>]*>50%/.test(systems), 'Systems table gives Sanctuary/Main the 50% top rate');
check(/-1<\/td><td[^>]*>35%/.test(systems) && /-2<\/td><td[^>]*>17%/.test(systems) && /-3<\/td><td[^>]*>8%/.test(systems),
  'Systems table retains the 35/17/8 lower rates');

const systemLegacy = /\b70\s*%|\b70\s*\/\s*35\s*\/\s*17\s*\/\s*8\b/i.test(systems);
check(!systemLegacy, 'Systems contains no stale 70-tax claim');
check(!/10[–-]15% taxation/i.test(simulations), 'simulations contains no stale 10–15% -3 tax claim');
check(/active 8% top marginal rate above \$10 million/.test(simulations), 'simulations states the active -3 8% top rate');

/* Catch a future live-tax regression outside the two known surfaces while
   allowing the unrelated STI 70–84 score band used by the interface. */
const textFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const rel = join(prefix, entry.name);
  if (entry.isDirectory()) return textFiles(join(dir, entry.name), rel);
  return /\.(html|md|txt|json|js|mjs|cjs|ts|xml|ya?ml)$/i.test(entry.name) ? [rel] : [];
});
const stale = [];
for (const file of textFiles(ROOT)) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    const stale70 = /\b70\s*%|\b70\s*\/\s*35\s*\/\s*17\s*\/\s*8\b/i.test(line);
    const taxContext = /\b(tax|taxation|marginal|income|schedule)\b/i.test(line);
    if (stale70 && taxContext) stale.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
    if (/10[–-]15% taxation/i.test(line)) stale.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
  });
}
check(stale.length === 0, 'Lite text scan finds no stale current tax patterns', stale.length ? stale.join('; ') : 'STI-only 70 references remain allowed');

console.log(`\nLite tax canon check — ${passes.length} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log(`  Active composite: ${activeComposite}; Schedule A active from 2295; Schedule B pending; SCM unchanged.`);
