import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from './snapshot-lib.mjs';

const dir = mkdtempSync(join(tmpdir(), 'homechecker-pending-'));
const comparator = fileURLToPath(new URL('./compare-pending-snapshot.mjs', import.meta.url));
const registry = { publishedGuides: [{ slug: '', pillar: true, title: 'Guides', question: 'Where do I begin?', dek: 'Overview', answer: 'Check the records.', updated: '2026-09-07', body: [{ type: 'p', html: 'Review the available property records.' }], faqs: [], related: [] }], guideClusters: [] };
const build = (generatedAt) => buildSnapshot(registry, { generatedAt });
const write = (snapshot) => writeFileSync(join(dir, 'data/guides.json'), JSON.stringify(snapshot));
const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
const compare = (ref) => execFileSync(process.execPath, [comparator, ref], { cwd: dir, encoding: 'utf8' }).trim();
try {
  mkdirSync(join(dir, 'data'));
  git('init', '-b', 'main');
  git('config', 'user.name', 'Snapshot test');
  git('config', 'user.email', 'test@example.invalid');
  const baseline = build('2026-09-07T00:00:00Z');
  baseline.guides[0].answer = 'Previous publication';
  write(baseline); git('add', '.'); git('commit', '-m', 'Baseline');
  // First refresh from main contains a real update and opens the pending branch.
  const first = build('2026-09-08T00:00:00Z');
  write(first); assert.equal(compare('main'), 'different');
  git('checkout', '-b', 'pending'); git('add', '.'); git('commit', '-m', 'Refresh');
  const pendingHead = git('rev-parse', 'pending').toString();
  // Second refresh starts from unchanged main and receives the same export.
  git('checkout', 'main');
  const second = build('2026-09-09T00:00:00Z');
  assert.notEqual(first.generatedAt, second.generatedAt);
  write(second);
  assert.equal(compare('main'), 'different');
  assert.equal(compare('pending'), 'equal', 'timestamp-only rebuild must skip the pending PR update');
  assert.equal(git('rev-parse', 'pending').toString(), pendingHead);
  second.guides[0].answer = 'A genuinely updated answer';
  write(second); assert.equal(compare('pending'), 'different');
  const nested = structuredClone(first); nested.source.generatedAt = 'meaningful source field';
  write(nested); assert.equal(compare('pending'), 'different', 'only the top-level generatedAt is ignored');
  writeFileSync(join(dir, 'data/guides.json'), '{broken');
  assert.notEqual(spawnSync(process.execPath, [comparator, 'pending'], { cwd: dir }).status, 0);
  console.log('Pending snapshot regression passed: two refreshes, timestamp-only skip, real changes retained, invalid JSON rejected.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
