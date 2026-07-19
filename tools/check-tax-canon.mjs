#!/usr/bin/env node
/** Focused Lite guard for the certified LP-074 rate schedule. */
import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const failures = [];
let passed = 0;
const check = (condition, label, detail = '') => {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const readme = read('README.md');
const systems = read('systems.html');
const charter = read('charter.html');
const simulations = read('simulations.html');
const cascade = '50 / 25 / 12.5 / 6.25';

check(systems.includes(cascade) && /became active in 2295/.test(systems), 'Systems states the active 2295 cascade');
check(/passed Findings I&ndash;IV/.test(systems), 'Findings I–IV pass');
check(/certified Schedule A/.test(systems), 'Schedule A certified');
check(/independently passed B1&ndash;B6 to certify Schedule B/.test(systems), 'B1–B6 and Schedule B certified');
check(/LP-073 is historical/.test(systems) && /LP-075 is procedural only/.test(systems), 'Authority statuses are correct');
check(/\$10 million threshold and Savings Circulation Mandate are unchanged/.test(systems), 'Threshold and SCM are unchanged');
check(/\+1 \/ Main<\/td><td[^>]*>50%/.test(systems), 'Sanctuary/Main rate is 50%');
check(/-1<\/td><td[^>]*>25%/.test(systems), '-1 rate is 25%');
check(/-2<\/td><td[^>]*>12\.5%/.test(systems), '-2 rate is 12.5%');
check(/-3<\/td><td[^>]*>6\.25%/.test(systems), '-3 rate is 6.25%');
check(/active 6\.25% top marginal rate above the unchanged \$10 million threshold/.test(simulations), 'Terminal simulation uses 6.25%');
check(/tax cut increases first-pass private allocation/i.test(readme + systems), 'Private-allocation effect is stated');
check(/SCM still reaching qualifying idle savings/i.test(readme), 'Lite summary preserves qualifying SCM reach');
check(/In -2 and -3, the 5% pulse reaches only savings attributable to VMSS-distributed UBI and Primary Job Subsidy/.test(systems), 'Lower SCM scope is preserved');
check(/private gains remain outside the mandate/.test(systems), 'Lower private gains remain excluded');
check(charter.includes(cascade) && /entered force in 2295/.test(charter), 'Charter summary matches the certified schedule');

const textFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const rel = join(prefix, entry.name);
  if (entry.isDirectory()) return textFiles(join(dir, entry.name), rel);
  return /\.(html|md|txt|json|js|mjs|cjs|ts|xml|ya?ml)$/i.test(entry.name) ? [rel] : [];
});

const forbidden = [
  ['Finding III failure', /Finding III[^.\n]{0,80}(?:FAIL|failed|failure)/i],
  ['Schedule A refusal', /Schedule A[^.\n]{0,80}refus/i],
  ['Schedule B not reached', /Schedule B[^.\n]{0,80}not reached/i],
  ['lawful nonactivation/failure', /lawful (?:nonactivation|failure)/i],
  ['operative LP-073', /LP-073[^.\n]{0,100}(?:remains operative|partially active)/i],
  ['active old cascade', /(?:70|50)\s*\/\s*35\s*\/\s*17\s*\/\s*8[^.\n]{0,80}(?:active|operative|current|remains)/i],
  ['current 35% -1 rate', /(?:current|active|operative)[^.\n]{0,80}35%|35%[^.\n]{0,80}(?:current|active|operative)/i],
  ['current 17% -2 rate', /(?:current|active|operative)[^.\n]{0,80}17%|17%[^.\n]{0,80}(?:current|active|operative)/i],
  ['current 8% -3 rate', /(?:current|active|operative)[^.\n]{0,80}\b8%|\b8%[^.\n]{0,80}(?:current|active|operative)/i],
];

const leaks = [];
for (const file of textFiles(ROOT)) {
  if (file.replaceAll('\\', '/') === 'tools/check-tax-canon.mjs') continue;
  read(file).split(/\r?\n/).forEach((line, index) => {
    for (const [label, pattern] of forbidden) {
      if (pattern.test(line)) leaks.push(`${label} at ${file}:${index + 1}`);
    }
  });
}
check(leaks.length === 0, 'Repository has no refusal or active-old-rate claims', leaks.join('; '));

/* Directionality fixtures ensure the guard rejects the superseded branch state. */
check(forbidden[0][1].test('Finding III failed.'), 'Fixture catches Finding III failure');
check(forbidden[1][1].test('Schedule A was refused.'), 'Fixture catches Schedule A refusal');
check(forbidden[2][1].test('Schedule B was not reached.'), 'Fixture catches Schedule B not reached');
check(forbidden[4][1].test('LP-073 remains operative.'), 'Fixture catches operative LP-073');
check(forbidden[8][1].test('The active 8% Terminal rate applies.'), 'Fixture catches active 8% rate');

console.log(`\nLite tax canon check — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log('  Active from 2295: 50 / 25 / 12.5 / 6.25; both schedules certified; LP-073 historical; SCM and threshold unchanged.');
