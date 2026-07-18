#!/usr/bin/env node
/**
 * Lite authority and tax-canon guard. Lite summarizes the Full site's current
 * legal result without importing the complete Path 2 record.
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
const operativeCascade = '70 / 35 / 17 / 8';
const candidateCascade = '50 / 25 / 12.5 / 6.25';
const activeCandidatePattern = /(?:active|effective|binding)[^\n]{0,100}50\s*\/\s*25\s*\/\s*12\.5\s*\/\s*6\.25|50\s*\/\s*25\s*\/\s*12\.5\s*\/\s*6\.25[^\n]{0,100}(?:active|effective|operative|binding)\b/i;
const oldRateClaimPattern = /active\s+(?:6\.25|12\.5|25|50)%|(?:6\.25|12\.5|25)%\s+top\s+marginal|Schedule A and Schedule B are active|Schedules A and B active/i;
const universalScmPattern = /prevents? (?:extreme )?wealth hoarding|prevents? anyone from hoarding|anti-hoarding system/i;

check(systems.includes(`LP-073 remains operative at ${operativeCascade}`),
  'Systems states LP-073 as operative at 70/35/17/8');
check(systems.includes(candidateCascade) && /remains conditional/.test(systems) && /incomplete and void/.test(systems),
  'Systems records the LP-074 candidate as conditional and its purported certificate as void');
check(/neither Schedule A nor Schedule B activated/.test(systems), 'Systems states neither LP-074 schedule activated');
check(/Savings Circulation Mandate is unchanged/.test(systems), 'Systems preserves SCM parameters');
check(/\+1 \/ Main<\/td><td[^>]*>70%/.test(systems), 'Systems table gives Sanctuary/Main the 70% top rate');
check(/-1<\/td><td[^>]*>35%/.test(systems) && /-2<\/td><td[^>]*>17%/.test(systems) && /-3<\/td><td[^>]*>8%/.test(systems),
  'Systems table gives the operative 35/17/8 lower rates');
check(/operative 8% top marginal rate above \$10 million/.test(simulations), 'simulation states the operative -3 8% top rate');

/* The layered SCM scope is substantive canon, not merely wording. */
check(/In \+1 Sanctuary and Main, it reaches all attributed savings at a 10% monthly pulse/.test(systems),
  'SCM: +1/Main reaches all attributed savings at 10%');
check(/In -1, it reaches all savings at 5%/.test(systems), 'SCM: -1 reaches all savings at 5%');
check(/In -2 and -3, its 5% pulse reaches only savings attributable to VMSS-distributed UBI and Primary Job Subsidy/.test(systems),
  'SCM: -2/-3 reaches only VMSS-distributed UBI/PJS-attributable savings');
check(/private gains remain outside the mandate/.test(systems), 'SCM: -2/-3 private gains remain outside');
check(/only UBI\/PJS-attributable savings in -2\/-3/.test(charter), 'Charter summary preserves the narrower -2/-3 SCM scope');

/* Permanent negative fixtures prove that the guard is directionally correct. */
check(activeCandidatePattern.test('The active 50 / 25 / 12.5 / 6.25 schedule is binding.'),
  'Mutation guard rejects a false active LP-074 cascade');
check(oldRateClaimPattern.test('Schedule A and Schedule B are active.'),
  'Mutation guard rejects a false dual-schedule activation');
check(universalScmPattern.test('The SCM prevents extreme wealth hoarding in every layer.'),
  'Mutation guard rejects universal anti-hoarding prose');
check(!activeCandidatePattern.test('A 50% child-tax share is unrelated to LP-074.'),
  'Mutation guard permits an unrelated 50% use');
check(!activeCandidatePattern.test('The candidate 50 / 25 / 12.5 / 6.25 cascade remains conditional and its certificate is void.'),
  'Mutation guard permits the qualified conditional candidate');

const textFiles = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const rel = join(prefix, entry.name);
  if (entry.isDirectory()) return textFiles(join(dir, entry.name), rel);
  return /\.(html|md|txt|json|js|mjs|cjs|ts|xml|ya?ml)$/i.test(entry.name) ? [rel] : [];
});

const stale = [];
const universalScm = [];
const malformedCurrent70 = [];
for (const file of textFiles(ROOT)) {
  if (file === 'tools/check-tax-canon.mjs') continue;
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    const where = `${file}:${index + 1}`;
    const taxContext = /\b(tax|taxation|marginal|income|schedule|LP-07[34])\b/i.test(line);
    const exactCandidate = /50\s*\/\s*25\s*\/\s*12\.5\s*\/\s*6\.25/.test(line);
    const candidateProperlyQualified = /candidate/i.test(line) && /conditional/i.test(line) && /void/i.test(line);
    const activeCandidate = activeCandidatePattern.test(line);
    const oldRateClaim = oldRateClaimPattern.test(line);
    if (activeCandidate || oldRateClaim || (taxContext && exactCandidate && !candidateProperlyQualified)) {
      stale.push(`${where}: ${line.trim().slice(0, 200)}`);
    }

    if (universalScmPattern.test(line)) {
      universalScm.push(`${where}: ${line.trim().slice(0, 200)}`);
    }

    /* Raw 70 tax language is allowed only as the operative composite/table or
       as an explicitly historical context. Unrelated 70s never enter here. */
    if (taxContext && /70\s*%/.test(line)) {
      const allowed = file === 'systems.html' && (/LP-073 remains operative/.test(line) || />70%<\//.test(line)) ||
        /historical|formerly|then-live/i.test(line);
      if (!allowed) malformedCurrent70.push(`${where}: ${line.trim().slice(0, 200)}`);
    }
  });
}

check(stale.length === 0, 'Lite scan rejects active 50-cascade and unqualified candidate claims',
  stale.length ? stale.join('; ') : 'clean');
check(universalScm.length === 0, 'Lite scan rejects universal anti-hoarding SCM claims',
  universalScm.length ? universalScm.join('; ') : 'clean');
check(malformedCurrent70.length === 0, 'Lite scan narrowly classifies current/historical 70% tax language',
  malformedCurrent70.length ? malformedCurrent70.join('; ') : 'clean');

console.log(`\nLite tax canon check — ${passes.length} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`);
  process.exit(1);
}
console.log(`  Operative cascade: ${operativeCascade}; LP-074 candidate ${candidateCascade} remains conditional; layered SCM scope verified.`);
