import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBuyerChecklist,
  getGuide,
  guides,
  isWeakMatch,
  listGuides,
  MIN_RESULT_SCORE,
  renderSearchResults,
  searchGuides,
  snapshot,
  WEAK_MATCH_CEILING,
} from '../.core-dist/src/core.js';

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
  const victoriaStateRules = listGuides({ jurisdiction: 'Victoria', cluster: 'state-rules' });
  assert.ok(vicStateRules.some((guide) => guide.slug === 'reading-a-section-32'));
  assert.ok(vicStateRules.every((guide) => guide.cluster?.id === 'state-rules'));
  assert.deepEqual(
    victoriaStateRules.map((guide) => guide.slug),
    vicStateRules.map((guide) => guide.slug),
  );
});

test('search selects the Victorian Section 32 guide', () => {
  const results = searchGuides({ query: 'What should I look for in a Section 32 vendor statement in Victoria?' });
  assert.equal(results[0]?.slug, 'reading-a-section-32');
  assert.ok((results[0]?.matchedSections.length ?? 0) > 0);
});

test('jurisdiction parameter accepts codes, lowercase codes and full names', () => {
  const variants = ['WA', 'wa', 'Western Australia'].map((jurisdiction) =>
    searchGuides({ query: 'cooling off period', jurisdiction, limit: 5 })
      .map((result) => ({ slug: result.slug, score: result.score })),
  );
  assert.deepEqual(variants[1], variants[0]);
  assert.deepEqual(variants[2], variants[0]);
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

test('buyer checklist accepts a full jurisdiction name', () => {
  const byCode = buildBuyerChecklist(
    { jurisdiction: 'VIC', buyingStage: 'contract review', concerns: ['Section 32'] },
    8,
  );
  const byName = buildBuyerChecklist(
    { jurisdiction: 'Victoria', buyingStage: 'contract review', concerns: ['Section 32'] },
    8,
  );
  assert.deepEqual(
    byName.matchedGuides.map((guide) => guide.slug),
    byCode.matchedGuides.map((guide) => guide.slug),
  );
  assert.ok(byName.matchedGuides.some((guide) => guide.slug === 'reading-a-section-32'));
});

// ── Relevance floors ──────────────────────────────────────────────────
// The corpus covers property condition and buying process. It does not
// cover finance, tax or valuation. Before the floors existed, every one
// of these returned a confident-looking guide with a canonical URL.

test('off-topic finance questions return nothing at all', () => {
  const offTopic = [
    'what is negative gearing',
    'rental yield calculator',
    'capital gains tax on investment property',
    'how do i refinance my loan',
    'solar panel feed in tariff',
    'interest rates rba forecast',
  ];
  for (const query of offTopic) {
    assert.equal(searchGuides({ query }).length, 0, `expected no results for: ${query}`);
  }
});

test('an empty result set says what the corpus does not cover', () => {
  const rendered = renderSearchResults(searchGuides({ query: 'what is negative gearing' }));
  assert.match(rendered, /No Homechecker guide addresses that question/i);
  assert.match(rendered, /does not cover finance, tax, valuation/i);
});

test('marginal off-topic questions are returned but flagged weak', () => {
  const results = searchGuides({ query: 'how much stamp duty do i pay in victoria' });
  assert.ok(results.length > 0, 'marginal queries still return context');
  assert.equal(isWeakMatch(results), true);
  assert.match(renderSearchResults(results), /No guide strongly matches that question/i);
});

test('genuine questions are not suppressed and are not flagged weak', () => {
  const strong = [
    ['what is a section 32', 'reading-a-section-32'],
    ['is the crack in my wall a big deal', 'cracks-structural-or-cosmetic'],
    ['asbestos 1980s home', 'homes-1980s-90s'],
    ['heritage overlay victoria', 'living-in-a-heritage-overlay'],
  ];
  for (const [query, expected] of strong) {
    const results = searchGuides({ query });
    assert.equal(results[0]?.slug, expected, `wrong top result for: ${query}`);
    assert.equal(isWeakMatch(results), false, `unexpectedly flagged weak: ${query}`);
  }
});

test('an indirect but genuine question still returns the right guide', () => {
  // Shares almost no vocabulary with the guide, so it scores low and is
  // flagged weak — but it must still retrieve, and retrieve correctly.
  const results = searchGuides({ query: 'can i pull out after signing' });
  assert.equal(results[0]?.slug, 'cooling-off-period-by-state');
});

test('no returned result ever falls below the absolute floor', () => {
  const queries = ['damp', 'strata', 'auction', 'brick veneer', 'pest', 'section 32'];
  for (const query of queries) {
    for (const result of searchGuides({ query, limit: 10 })) {
      assert.ok(result.score >= MIN_RESULT_SCORE, `${query}: ${result.slug} scored ${result.score}`);
    }
  }
});

test('the weak band sits below the benchmark floor', () => {
  // Guards the calibration itself: if scoring changes such that a
  // benchmark-grade query lands under the ceiling, this fails loudly.
  assert.ok(MIN_RESULT_SCORE < WEAK_MATCH_CEILING);
  const benchmarkGrade = searchGuides({ query: 'What should I know about buying a weatherboard house?' });
  assert.equal(isWeakMatch(benchmarkGrade), false);
});
