import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBuyerChecklist, getGuide, guides, listGuides, searchGuides, snapshot } from '../.core-dist/src/core.js';

test('snapshot contains the full published guide system', () => {
  assert.equal(snapshot.source.contentCount, 34);
  assert.equal(snapshot.source.spokeCount, 33);
  assert.equal(guides.filter((guide) => !guide.pillar).length, 33);
  assert.equal(new Set(guides.map((guide) => guide.resourceUri)).size, 34);
});

test('gets a canonical guide by slug and route', () => {
  const bySlug = getGuide('reading-a-section-32');
  const byRoute = getGuide('/guides/reading-a-section-32/');
  assert.ok(bySlug);
  assert.equal(bySlug, byRoute);
  assert.equal(bySlug.canonicalUrl, 'https://homechecker.com.au/guides/reading-a-section-32');
  assert.match(bySlug.contentMarkdown, /Sale of Land Act 1962/);
});

test('filters the catalogue by state and cluster', () => {
  const vicStateRules = listGuides({ jurisdiction: 'VIC', cluster: 'state-rules' });
  assert.ok(vicStateRules.some((guide) => guide.slug === 'reading-a-section-32'));
  assert.ok(vicStateRules.every((guide) => guide.cluster?.id === 'state-rules'));
});

test('search selects the Victorian Section 32 guide', () => {
  const results = searchGuides({ query: 'What should I look for in a Section 32 vendor statement in Victoria?' });
  assert.equal(results[0]?.slug, 'reading-a-section-32');
  assert.ok((results[0]?.matchedSections.length ?? 0) > 0);
});

test('search selects construction-era and fabric guides', () => {
  const results = searchGuides({ query: '1970s brick veneer house in Victoria', limit: 5 });
  const topSlugs = results.map((result) => result.slug);
  assert.ok(topSlugs.includes('postwar-homes-1950s-70s'));
  assert.ok(topSlugs.includes('brick-veneer-vs-double-brick'));
});

test('search selects owners corporation guidance', () => {
  const results = searchGuides({ query: 'How do I review the owners corporation records for an apartment?' });
  assert.ok(['reading-your-owners-corporation-report', 'buying-an-apartment-strata'].includes(results[0]?.slug ?? ''));
});

test('buyer checklist is deterministic, sourced and bounded', () => {
  const profile = {
    jurisdiction: 'VIC',
    propertyType: 'house',
    era: '1950s-1970s',
    buyingStage: 'before offer or auction',
    concerns: ['cracking', 'damp'],
  };
  const first = buildBuyerChecklist(profile, 10);
  const second = buildBuyerChecklist(profile, 10);

  assert.deepEqual(first, second);
  assert.ok(first.items.length >= 4);
  assert.ok(first.items.every((item) => item.canonicalUrl.startsWith('https://homechecker.com.au/guides/')));
  assert.ok(first.items.some((item) => item.guideSlug === 'cracks-structural-or-cosmetic'));
  assert.ok(first.items.some((item) => item.guideSlug === 'damp-and-moisture-in-your-home'));
  assert.match(first.guidanceBoundary, /does not assess the actual property/i);
});
