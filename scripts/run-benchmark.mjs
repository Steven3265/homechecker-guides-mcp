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

const top1Recall = positiveCases ? top1Hits / positiveCases : 0;
const passed =
  failedCases === 0 &&
  top1Recall >= 0.85 &&
  top3Hits === positiveCases &&
  weakCorrect === weakCases &&
  emptyCorrect === emptyCases &&
  outsideSafe === outsideCases &&
  falseStrong === 0 &&
  jurisdictionLeaks === 0;

if (!passed) {
  console.error(`\nBenchmark gate failed (${failedCases} case failures).`);
  process.exit(1);
}
console.log('\nBenchmark gate passed.');
