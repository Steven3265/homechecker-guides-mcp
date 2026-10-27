import { rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

rmSync('.core-dist', { recursive: true, force: true });
const compile = spawnSync('tsc', ['-p', 'tsconfig.core.json'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const [{ searchGuides, isWeakMatch }, benchmarkText] = await Promise.all([
  import('../.core-dist/src/core.js'),
  readFile(new URL('../data/benchmark.json', import.meta.url), 'utf8'),
]);
const cases = JSON.parse(benchmarkText);

if (!Array.isArray(cases) || cases.length < 199) {
  throw new Error(`Benchmark must contain at least 199 cases; found ${Array.isArray(cases) ? cases.length : 0}.`);
}

let positiveCases = 0;
let top1Hits = 0;
let top3Hits = 0;
let weakCases = 0;
let weakCorrect = 0;
let emptyCases = 0;
let emptyCorrect = 0;
let outsideCases = 0;
let outsideSafe = 0;
let falseStrong = 0;
let jurisdictionCases = 0;
let jurisdictionLeaks = 0;
let failedCases = 0;

for (const entry of cases) {
  const results = searchGuides({ query: entry.query, limit: 3 });
  const slugs = results.map((result) => result.slug);
  const weak = results.length > 0 && isWeakMatch(entry.query, results);
  let ok = true;
  let expectation = '';

  if (entry.category === 'positive' || entry.category === 'jurisdiction') {
    positiveCases += 1;
    const top3 = entry.expected.some((slug) => slugs.includes(slug));
    const top1 = entry.expected.includes(slugs[0]);
    if (top3) top3Hits += 1;
    if (top1) top1Hits += 1;
    ok = top3;
    expectation = `expected top-3: ${entry.expected.join(' or ')}`;
  } else if (entry.category === 'weak') {
    weakCases += 1;
    ok = results.length > 0 && weak;
    if (ok) weakCorrect += 1;
    if (results.length > 0 && !weak) falseStrong += 1;
    expectation = 'expected: non-empty weak/background result';
  } else if (entry.category === 'empty') {
    emptyCases += 1;
    ok = results.length === 0;
    if (ok) emptyCorrect += 1;
    if (results.length > 0 && !weak) falseStrong += 1;
    expectation = 'expected: no result';
  } else if (entry.category === 'outside') {
    outsideCases += 1;
    ok = results.length === 0 || weak;
    if (ok) outsideSafe += 1;
    if (results.length > 0 && !weak) falseStrong += 1;
    expectation = 'expected: weak/background or no result; never strong';
  } else {
    throw new Error(`${entry.id}: unknown benchmark category ${entry.category}`);
  }

  if ((entry.forbidden ?? []).length > 0) {
    jurisdictionCases += 1;
    const leaked = entry.forbidden.filter((slug) => slugs.includes(slug));
    if (leaked.length) {
      jurisdictionLeaks += 1;
      ok = false;
      expectation += `; forbidden returned: ${leaked.join(', ')}`;
    }
  }

  if (!ok) failedCases += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${entry.category}] ${entry.id}: ${entry.query}`);
  if (!ok) {
    console.log(`      ${expectation}`);
    console.log(`      returned: ${slugs.join(', ') || '(none)'}${results.length ? `; strength=${weak ? 'weak' : 'strong'}` : ''}`);
  }
}

// ── Filtered pass (1.2.2) ───────────────────────────────────────────────
// Callers such as the Homechecker engine send short building questions with
// structured filters. (1) Every negative case above must stay non-strong even
// when residential filters are attached: filters are context, never authority.
// (2) Engine-style questions must find the right guide and be answered strongly.
const FILTER_SETS = [
  { propertyType: 'house', era: '2000s-on', jurisdiction: 'VIC' },
  { propertyType: 'apartment' },
  { propertyType: 'townhouse', era: '1920s-1940s', jurisdiction: 'NSW' },
];
let filteredNegatives = 0;
let filteredFalseStrong = 0;
for (const entry of cases) {
  if (!['weak', 'empty', 'outside'].includes(entry.category)) continue;
  for (const filters of FILTER_SETS) {
    filteredNegatives += 1;
    const results = searchGuides({ query: entry.query, limit: 3, ...filters });
    if (results.length > 0 && !isWeakMatch(entry.query, results, filters)) {
      filteredFalseStrong += 1;
      failedCases += 1;
      console.log(`FAIL  [filtered-negative] ${entry.id}: ${entry.query}`);
      console.log(`      filters: ${JSON.stringify(filters)}; returned strong: ${results.map((r) => r.slug).join(', ')}`);
    }
  }
}
const filtered = JSON.parse(await readFile(new URL('../data/benchmark-filtered.json', import.meta.url), 'utf8')).cases;
let engineCases = 0;
let engineTop3 = 0;
let engineStrong = 0;
for (const entry of filtered) {
  engineCases += 1;
  const results = searchGuides({ query: entry.query, limit: 3, ...entry.filters });
  const slugs = results.map((r) => r.slug);
  const top3 = entry.expected.some((slug) => slugs.includes(slug));
  const strong = results.length > 0 && !isWeakMatch(entry.query, results, entry.filters);
  if (top3) engineTop3 += 1;
  if (top3 && strong) engineStrong += 1;
  console.log(`${top3 && strong ? 'PASS' : top3 ? 'WEAK' : 'FAIL'}  [engine] ${entry.query} ${JSON.stringify(entry.filters)} -> ${slugs.join(', ') || '(none)'}`);
}

const pct = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : 'n/a';
console.log('\nRetrieval benchmark summary');
console.log(`  cases:                 ${cases.length}`);
console.log(`  positive top-1 recall: ${top1Hits}/${positiveCases} (${pct(top1Hits, positiveCases)})`);
console.log(`  positive top-3 recall: ${top3Hits}/${positiveCases} (${pct(top3Hits, positiveCases)})`);
console.log(`  weak/background:       ${weakCorrect}/${weakCases} (${pct(weakCorrect, weakCases)})`);
console.log(`  correct-empty:         ${emptyCorrect}/${emptyCases} (${pct(emptyCorrect, emptyCases)})`);
console.log(`  open-world safe:       ${outsideSafe}/${outsideCases} (${pct(outsideSafe, outsideCases)})`);
console.log(`  false-strong negatives:${falseStrong}/${weakCases + emptyCases + outsideCases} (${pct(falseStrong, weakCases + emptyCases + outsideCases)})`);
console.log(`  jurisdiction leakage:  ${jurisdictionLeaks}/${jurisdictionCases}`);
console.log(`  filtered negatives:    ${filteredNegatives - filteredFalseStrong}/${filteredNegatives} never strong`);
console.log(`  engine-style top-3:    ${engineTop3}/${engineCases} (${pct(engineTop3, engineCases)})`);
console.log(`  engine-style strong:   ${engineStrong}/${engineCases} (${pct(engineStrong, engineCases)})`);

const top1Recall = positiveCases ? top1Hits / positiveCases : 0;
const passed =
  failedCases === 0 &&
  top1Recall >= 0.85 &&
  top3Hits === positiveCases &&
  weakCorrect === weakCases &&
  emptyCorrect === emptyCases &&
  outsideSafe === outsideCases &&
  falseStrong === 0 &&
  jurisdictionLeaks === 0 &&
  filteredFalseStrong === 0 &&
  engineTop3 === engineCases &&
  engineStrong / engineCases >= 0.80;

if (!passed) {
  console.error(`\nBenchmark gate failed (${failedCases} case failures).`);
  process.exit(1);
}
console.log('\nBenchmark gate passed.');
