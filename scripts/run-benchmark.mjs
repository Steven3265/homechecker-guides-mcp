import { rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

rmSync('.core-dist', { recursive: true, force: true });
const compile = spawnSync('tsc', ['-p', 'tsconfig.core.json'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const [{ searchGuides }, benchmarkText] = await Promise.all([
  import('../.core-dist/src/core.js'),
  readFile(new URL('../data/benchmark.json', import.meta.url), 'utf8'),
]);
const cases = JSON.parse(benchmarkText);
let passed = 0;

for (const entry of cases) {
  const results = searchGuides({ query: entry.query, limit: 3 });
  const top = results.map((result) => result.slug);
  const ok = entry.expected.some((slug) => top.includes(slug));
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${entry.query}`);
  console.log(`      expected: ${entry.expected.join(' or ')}`);
  console.log(`      returned: ${top.join(', ')}`);
}

console.log(`\n${passed}/${cases.length} benchmark questions passed in the top 3.`);
if (passed !== cases.length) process.exit(1);
