#!/usr/bin/env node
/**
 * Lite tax-canon guard. Lite summarizes the Full site's certified current
 * result while preserving the deliberately narrower Lower-layer SCM scope.
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
const charter = read('charter.html');
const simulations = read('simulations.html');
const activeCascade = '70 / 35 / 17 / 8';

check(systems.includes(activeCascade) && /remains operative/.test(systems), 'Systems states the operative LP-073 cascade');
check(/refused Schedule A after Finding III failed/.test(systems) && /Lower certificate and Schedule B were therefore not reached/.test(systems),
  'Systems records lawful nonactivation after Finding III');
check(/LP-073.*remains operative/.test(systems), 'Systems classifies LP-073 as operative');
check(/\$10 million threshold/.test(systems) && /Savings Circulation Mandate are unchanged/.test(systems),
  'Systems preserves the threshold and SCM');
check(/\+1 \/ Main<\/td><td[^>]*>70%/.test(systems), 'Systems table gives Sanctuary/Main 70%');
check(/-1<\/td><td[^>]*>35%/.test(systems) && /-2<\/td><td[^>]*>17%/.test(systems) && /-3<\/td><td[^>]*>8%/.test(systems),
  'Systems table gives the exact Lower cascade');
check(/active 8% top marginal rate above the unchanged \$10 million threshold/.test(simulations),
  'Simulation uses the current -3 rate and threshold');
check(charter.includes(activeCascade) && /failed Finding III and refused Schedule A/.test(charter), 'Charter summary states the lawful failure and operative cascade');

/* Layered SCM scope is substantive canon, not merely wording. */
check(/In \+1 Sanctuary and Main, it reaches all attributed savings at a 10% monthly pulse/.test(systems),
  'SCM: +1/Main reaches all attributed savings at 10%');
check(/In -1, it reaches all savings at 5%/.test(systems), 'SCM: -1 reaches all savings at 5%');
check(/In -2 and -3, its 5% pulse reaches only savings attributable to VMSS-distributed UBI and Primary Job Subsidy/.test(systems),
  'SCM: -2/-3 reaches only UBI/PJS-attributable savings at 5%');
check(/private gains remain outside the mandate/.test(systems), 'SCM: -2/-3 private gains remain outside');
check(/only UBI\/PJS-attributable savings in -2\/-3/.test(charter), 'Charter retains the narrower Lower scope');

const textFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const rel = join(prefix, entry.name);
  if (entry.isDirectory()) return textFiles(join(dir, entry.name), rel);
  return /\.(html|md|txt|json|js|mjs|cjs|ts|xml|ya?ml)$/i.test(entry.name) ? [rel] : [];
});

const stale = [];
const universalScm = [];
for (const file of textFiles(ROOT)) {
  if (file === 'tools/check-tax-canon.mjs') continue;
  read(file).split(/\r?\n/).forEach((line, index) => {
    const staleStatus = /LP-073 is historical|LP-073[^.\n]{0,80}superseded|Schedule A certified first|supported Schedule B|Schedules? [AB][^.\n]{0,80}(?:active|effective)|50\s*\/\s*25\s*\/\s*12\.5\s*\/\s*6\.25[^.\n]{0,80}(?:active|operative|took effect)/i.test(line);
    const staleCurrentRate = /(?:operative|active|current)[^.\n]{0,80}(?:50%|25%|12\.5%|6\.25%)/i.test(line) && /tax|rate|schedule|LP-07/i.test(line);
    if (staleStatus || staleCurrentRate) stale.push(`${file}:${index + 1}: ${line.trim().slice(0, 180)}`);
    if (/prevents? (?:extreme )?wealth hoarding|prevents? anyone from hoarding|anti-hoarding system/i.test(line)) universalScm.push(`${file}:${index + 1}`);
  });
}

check(stale.length === 0, 'Repository scan rejects stale LP-074 activation/current proposed-rate claims', stale.join('; '));
check(universalScm.length === 0, 'Repository scan rejects universal SCM claims', universalScm.join('; '));

/* Negative fixtures make directionality permanent. */
check(/LP-073 is historical|LP-073[^.\n]{0,80}superseded/i.test('LP-073 is historical and superseded.'), 'Mutation fixture catches superseded LP-073');
check(/50\s*\/\s*25\s*\/\s*12\.5\s*\/\s*6\.25[^.\n]{0,80}(?:active|operative|took effect)/i.test('50 / 25 / 12.5 / 6.25 is active.'), 'Mutation fixture catches active proposed cascade');
check(/prevents? (?:extreme )?wealth hoarding/i.test('The SCM prevents extreme wealth hoarding everywhere.'), 'Mutation fixture catches universal SCM prose');
check(!/(?:operative|active|current)[^.\n]{0,80}(?:50%|25%|12\.5%|6\.25%)/i.test('The proposed 50% rate did not activate.'), 'Mutation fixture permits rejected proposed rates');
check(!/LP-073 is historical|LP-073[^.\n]{0,80}superseded/i.test('LP-073 remains operative.'), 'Mutation fixture permits operative LP-073');

console.log(`\nLite tax canon check — ${passes.length} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log(`  Operative cascade: ${activeCascade}; Schedule A refused and Schedule B not reached; layered SCM scope verified.`);
