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
check(/In -2 and -3,.{0,120}the 5% pulse reaches only savings attributable to VMSS-distributed UBI and Primary Job Subsidy/.test(systems), 'Lower SCM scope is preserved');
check(/private gains remain outside the mandate/.test(systems), 'Lower private gains remain excluded');
check(/district is approximately one million residents/.test(systems) && /\$100 billion per district/.test(systems)
  && /trigger is \$50 billion/.test(systems) && /triggers are \$25 billion and \$10 billion/.test(systems),
  'District definition and all SCM trigger amounts are preserved');
check(charter.includes(cascade) && /entered force in 2295/.test(charter), 'Charter summary matches the certified schedule');
check(/Progressive taxation scales to the institutional support and benefits each layer receives/.test(charter),
  'Charter preserves progressive taxation by institutional support');
check(/Involuntary punitive descent liquidates all assets at market value/.test(charter)
  && /100% of the descending citizen/.test(charter), 'Charter preserves involuntary-descent asset liquidation');

const textFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const rel = join(prefix, entry.name);
  if (entry.isDirectory()) return textFiles(join(dir, entry.name), rel);
  return /\.(html|md|txt|json|js|mjs|cjs|ts|xml|ya?ml)$/i.test(entry.name) ? [rel] : [];
});

const forbidden = [
  ['Finding III failure', /Finding III.{0,100}(?:FAIL|failed|failure|did not pass)/i, 'The 2294 record says Finding III did not pass.'],
  ['Schedule A refusal', /Schedule A.{0,100}(?:refus(?:ed|al)|reject(?:ed|ion)|not certified)/i, 'Schedule A was rejected in 2294.'],
  ['Schedule B refusal', /Schedule B.{0,100}(?:not reached|refus(?:ed|al)|reject(?:ed|ion)|not certified)/i, 'Schedule B was not certified.'],
  ['2294 nonactivation/failure', /2294.{0,120}(?:lawful (?:nonactivation|failure)|failed to activate|refusal)/i, 'The 2294 audit ended in a lawful nonactivation.'],
  ['operative LP-073', /LP-073.{0,120}(?:(?:remains|is|still) (?:operative|active|current)|partially active)/i, 'LP-073 remains operative today.'],
  ['active old cascade', /(?:current|active|operative).{0,100}70\s*%?\s*\/\s*35\s*%?\s*\/\s*17\s*%?\s*\/\s*8\s*%?|70\s*%?\s*\/\s*35\s*%?\s*\/\s*17\s*%?\s*\/\s*8\s*%?.{0,100}(?:current|active|operative)/i, 'The active schedule is 70 / 35 / 17 / 8.'],
  ['current 70% upper rate', /(?:current|active|operative).{0,80}\b70%|\b70%.{0,80}(?:current|active|operative)/i, 'The current Main rate remains 70%.'],
  ['current 35% -1 rate', /(?:current|active|operative).{0,80}\b35%|\b35%.{0,80}(?:current|active|operative)/i, 'The active -1 rate is 35%.'],
  ['current 17% -2 rate', /(?:current|active|operative).{0,80}\b17%|\b17%.{0,80}(?:current|active|operative)/i, 'The current -2 rate is 17%.'],
  ['current 8% -3 rate', /(?:current|active|operative).{0,80}\b8%|\b8%.{0,80}(?:current|active|operative)/i, 'The active 8% Terminal rate applies.'],
  ['three-of-four finding claim', /three findings passed.{0,60}(?:one did not|one failed)/i, 'Three findings passed, but one failed.'],
  ['multiple-refusal claim', /both refusals|two refusals|refused twice/i, 'Both refusals settled the question.'],
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

/* Every forbidden branch has its own directionality fixture. */
for (const [label, pattern, fixture] of forbidden) {
  check(pattern.test(fixture), `Fixture catches ${label}`);
}

console.log(`\nLite tax canon check — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log('  Active from 2295: 50 / 25 / 12.5 / 6.25; both schedules certified; LP-073 historical; SCM and threshold unchanged.');
