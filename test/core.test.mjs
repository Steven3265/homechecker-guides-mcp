import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBuyerChecklist,
  getGuide,
  guides,
  isWeakMatch,
  listGuides,
  MIN_RESULT_SCORE,
  relevanceDensity,
  residentialDomainEvidence,
  renderSearchResults,
  searchGuides,
  snapshot,
  WEAK_RELEVANCE_PER_TERM,
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

test('preserves explicit relationships back to the guide hub', () => {
  const guide = getGuide('reading-a-section-32');
  assert.ok(guide);
  assert.ok(guide.related.includes('guides'));
  assert.equal(getGuide('guides')?.pillar, true);
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

test('rendered search text exposes canonical URLs without referral parameters', () => {
  const results = searchGuides({ query: 'Section 32 Victoria', limit: 3 });
  const text = renderSearchResults(results, 'Section 32 Victoria');
  assert.match(text, /https:\/\/homechecker\.com\.au\/guides\/reading-a-section-32/);
  assert.doesNotMatch(text, /utm_source=/);
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

test('insurer wording retrieves insurance guidance ahead of incidental building-condition matches', () => {
  const queries = [
    'If the house has old wiring, roof issues or previous damage, how should I describe that risk to an insurer?',
    'What should I tell insurers about old wiring and previous roof damage to my house?',
    'How does roof condition affect what an insurer needs to know about my home?',
  ];
  for (const query of queries) {
    const results = searchGuides({ query, limit: 3 });
    assert.equal(results[0]?.slug, 'home-condition-and-insurance', query);
    assert.equal(isWeakMatch(query, results), false, `insurance query unexpectedly weak: ${query}`);
  }

  // Insurance vocabulary also applies outside residential property. Expanding
  // it must preserve the existing confidence boundary for those questions.
  const query = 'What should I tell my car insurer about previous accident damage?';
  const results = searchGuides({ query, limit: 3 });
  assert.ok(results.length === 0 || isWeakMatch(query, results));
});

test('authoritative topic matches recover clear residential paraphrases without relying on body density', () => {
  const cases = [
    ['How do I tell condensation from rainwater ingress in a house?', 'damp-and-moisture-in-your-home'],
    ['The vendor supplied a building report. Can I rely on it?', 'how-to-read-a-building-and-pest-report'],
  ];
  for (const [query, expected] of cases) {
    const results = searchGuides({ query, limit: 5 });
    assert.equal(results[0]?.slug, expected, query);
    assert.equal(isWeakMatch(query, results), false, `clear residential paraphrase unexpectedly weak: ${query}`);
  }
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
  assert.doesNotMatch(first.guidanceBoundary, /utm_source=/);
});

test('movie and film set wording cannot manufacture strong brick-veneer confidence', () => {
  const queries = [
    'What is brick veneer in a movie set?',
    'How is brick veneer used on a film set?',
    'What is brick veneer in stage scenery?',
  ];
  for (const query of queries) {
    const results = searchGuides({ query, limit: 3 });
    assert.ok(results.length === 0 || isWeakMatch(query, results), `false-strong collision: ${query}`);
  }
});

test('buyer checklist does not turn provider price examples into tasks', () => {
  const jurisdictions = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
  for (const jurisdiction of jurisdictions) {
    const checklist = buildBuyerChecklist({
      jurisdiction,
      concerns: ['building inspection', 'cost', 'condition'],
    }, 12);
    const text = checklist.items.map((item) => item.check).join('\n');
    assert.doesNotMatch(text, /Check (?:sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra):/i, jurisdiction);
    assert.doesNotMatch(text, /(?:Building Biology NSW|Wave Building Biology|Buildingbiology Services Australia)/i, jurisdiction);
  }
});

test('buyer checklist preserves an explicit auction concern when condition material is dense', () => {
  const checklist = buildBuyerChecklist({
    jurisdiction: 'NSW',
    propertyType: 'house',
    era: 'pre-1920s',
    concerns: ['auction', 'roof', 'damp', 'cracks', 'insurance'],
  }, 12);
  assert.ok(checklist.matchedGuides.some((guide) => /auction/.test(guide.slug)), 'expected an auction-specific source guide');
  assert.ok(checklist.items.some((item) => /auction/.test(item.guideSlug)), 'expected at least one auction-sourced checklist item');
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
  const q = 'what is negative gearing';
  const rendered = renderSearchResults(searchGuides({ query: q }), q);
  assert.match(rendered, /No Homechecker guide addresses that question/i);
  assert.match(rendered, /does not cover finance, tax, valuation/i);
});

test('finance-only requests stay empty across conversational wording and property context', () => {
  const queries = [
    'How much capital gains tax will I owe on an investment property?',
    'How much capital gains tax will I pay when I sell my investment property?',
    'Calculate CGT on the sale of my Melbourne house.',
    'Capital-gains tax on a house built in 1970 in Victoria',
    'How does negative gearing work when buying an investment apartment?',
    'What rental yield can I expect from a modern apartment in Sydney?',
    'How much rental income will I receive from a house built in 1965?',
    'Which mortgage should I choose when buying a home in NSW?',
    'How much can I borrow with a home loan for this house?',
    'Should I refinance my house in Queensland?',
    'What interest rates apply when buying an apartment in Melbourne?',
    'What investment returns should I expect from selling this house?',
  ];
  for (const query of queries) {
    // Caller-supplied metadata must not turn a financial request into a match.
    for (const options of [{}, { jurisdiction: 'VIC', limit: 10, includePillar: true }]) {
      const results = searchGuides({ query, ...options });
      assert.deepEqual(results, [], `expected no results for: ${query}`);
      assert.match(renderSearchResults(results, query), /No Homechecker guide addresses that question/);
    }
  }
});

test('mixed finance and building questions retain relevant weak background', () => {
  const queries = [
    ['What renovation records should I keep for capital gains tax?', 'keeping-a-record-of-your-home'],
    ['What home repair invoices should I keep for CGT?', 'keeping-a-record-of-your-home'],
    ['Before choosing a mortgage, how do I read a building and pest inspection report?', 'how-to-read-a-building-and-pest-report'],
    ['How do damp and moisture in a house affect rental yield?', 'damp-and-moisture-in-your-home'],
  ];
  for (const [query, expected] of queries) {
    const results = searchGuides({ query });
    assert.ok(results.some((result) => result.slug === expected), `missing useful background for: ${query}`);
    assert.equal(isWeakMatch(query, results), true, `financial outcome must stay weak: ${query}`);
  }
});

test('marginal off-topic questions are returned but flagged weak', () => {
  const results = searchGuides({ query: 'how much stamp duty do i pay in victoria' });
  assert.ok(results.length > 0, 'marginal queries still return context');
  assert.equal(isWeakMatch('how much stamp duty do i pay in victoria', results), true);
  assert.match(renderSearchResults(results, 'how much stamp duty do i pay in victoria'), /No guide strongly matches that question/i);
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
    assert.equal(isWeakMatch(query, results), false, `unexpectedly flagged weak: ${query}`);
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

test('verbose off-topic questions never reach a strong match', () => {
  // Raw score grows with query length, so a wordy off-topic question used to
  // accumulate enough incidental points to look confident. Per-term
  // normalisation is what stops that; these are the cases that exposed it.
  const verbose = [
    'how much capital gains tax will i pay when i sell my investment property',
    'what is negative gearing and how does it work',
    'should i buy or rent a home in australia in 2026',
    'how do i get pre approval for a home loan from my bank',
    'what is the best mortgage interest rate available in australia right now',
    'which suburbs in sydney are the best for property investment growth',
    'how much stamp duty do i pay in victoria when buying a house',
  ];
  for (const query of verbose) {
    const results = searchGuides({ query });
    if (results.length === 0) continue;
    assert.equal(isWeakMatch(query, results), true, `leaked as a strong match: ${query}`);
  }
});

test('relevance is measured per term, so length cannot fake confidence', () => {
  const terse = 'capital gains tax on investment property';
  const wordy = 'how much capital gains tax will i pay when i sell my investment property';
  for (const query of [terse, wordy]) {
    const results = searchGuides({ query });
    assert.ok(
      results.length === 0 || relevanceDensity(query, results) < WEAK_RELEVANCE_PER_TERM,
      `${query} should not read as a strong match`,
    );
  }
  assert.ok(MIN_RESULT_SCORE > 0 && WEAK_RELEVANCE_PER_TERM > 0);
});


test('era metadata cannot manufacture a strong match for unrelated modern/year questions', () => {
  const unrelated = [
    'What was the average house price in Melbourne in 2020?',
    'Can you explain modern portfolio theory?',
  ];
  for (const query of unrelated) {
    const results = searchGuides({ query });
    if (results.length === 0) continue;
    assert.equal(isWeakMatch(query, results), true, `structured era signal leaked as strong: ${query}`);
  }
});


test('open-world lexical collisions cannot manufacture strong Homechecker confidence', () => {
  const collisions = [
    'What is Section 32 of the Copyright Act?',
    'What does section 32 of the Corporations Act say?',
    'Explain geological strata',
    'What is a unit test in software?',
    'How long should I cool off after a workout?',
    'How do art auctions work?',
    'What is settlement risk in banking?',
    'How do I remove mould from cheese?',
    'What is Form 2 in a medical context?',
    'What is a vendor statement in procurement?',
    'What is a brick phone?',
    'What is the population of Victoria?',
    'Sydney weather tomorrow',
    'What does movement mean in music?',
    'What is an extension in a browser?',
    'What does common property mean in mathematics?',
  ];

  for (const query of collisions) {
    const results = searchGuides({ query });
    if (results.length === 0) continue;
    assert.equal(isWeakMatch(query, results), true, `lexical collision leaked as strong: ${query}`);
  }

  const genuine = [
    'what is a section 32',
    'is the crack in my wall a big deal',
    'what should I check before buying an apartment with strata',
    'how much does a building and pest inspection cost',
  ];
  for (const query of genuine) {
    assert.ok(residentialDomainEvidence(query) >= 3, `missing residential-domain evidence: ${query}`);
  }
});


test('domain gate preserves strong confidence for clear residential questions', () => {
  const clearResidential = [
    'Buying in NSW and I have the sale contract before signing. What disclosures should I check?',
    'There are diagonal cracks around doors. How do I tell normal cosmetic cracking from movement that needs investigation?',
    'What does a home need as it ages decade by decade?',
    'What should I check before renovating my home?',
    'What are common issues in a 1970s house?',
    'Compare cooling-off periods in Victoria and NSW before I sign a contract.',
    'Buying in Victoria and Queensland: compare disclosure requirements',
  ];
  for (const query of clearResidential) {
    const results = searchGuides({ query });
    assert.ok(results.length > 0, `expected residential results for: ${query}`);
    assert.equal(isWeakMatch(query, results), false, `residential query unexpectedly weakened: ${query}`);
  }
});

test('specific construction years infer the correct era without treating the current year as an era', () => {
  const cases = [
    ['house built in 1910', 'period-homes-pre-1920s'],
    ['what should I inspect in a 1935 house', 'interwar-homes-1920s-40s'],
    ['house built in 1965', 'postwar-homes-1950s-70s'],
    ['what problems are typical in a home constructed in 1987', 'homes-1980s-90s'],
    ['house completed in 2015', 'modern-homes-2000s-on'],
    ['home built in 2022', 'modern-homes-2000s-on'],
  ];
  for (const [query, expected] of cases) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.slice(0, 3).some((result) => result.slug === expected), `${query}: expected ${expected} in top 3`);
  }

  const currentYearContext = searchGuides({ query: 'should i buy or rent a home in australia in 2026' });
  assert.equal(isWeakMatch('should i buy or rent a home in australia in 2026', currentYearContext), true);
});

test('property-adjacent outcomes outside the corpus can return background but never a strong match', () => {
  const outsideScope = [
    'what rent can i charge for a two bedroom apartment',
    'can i claim this renovation on tax',
    'how much does underpinning cost',
    'is my contract enforceable',
    'how much should i bid for this house',
    'recommend the best building inspector in carlton',
    'what is the market value of this property',
    'what is the exact price to rewire a 1960s house',
    'will this crack definitely cause the building to collapse',
    'is this apartment compliant with the building code',
    'will council approve my extension',
    'should i rent or buy in australia in 2026',
    'what are today\'s auction clearance rates',
  ];

  for (const query of outsideScope) {
    const results = searchGuides({ query });
    if (results.length === 0) continue;
    assert.equal(isWeakMatch(query, results), true, `outside-scope query leaked as strong: ${query}`);
  }
});


test("jurisdiction inferred from the query excludes other states' dedicated rule guides", () => {
  const sa = searchGuides({ query: 'What seller disclosure do I get when buying in South Australia?', limit: 10 });
  assert.ok(sa.every((result) => !['reading-a-section-32', 'reading-a-contract-for-sale-nsw', 'seller-disclosure-qld'].includes(result.slug)));
  assert.equal(isWeakMatch('What seller disclosure do I get when buying in South Australia?', sa), true);

  const wa = searchGuides({ query: 'What contract disclosures apply when buying in Western Australia?', limit: 10 });
  assert.ok(wa.every((result) => !['reading-a-section-32', 'reading-a-contract-for-sale-nsw', 'seller-disclosure-qld'].includes(result.slug)));
  assert.equal(isWeakMatch('What contract disclosures apply when buying in Western Australia?', wa), true);
});

test('jurisdiction inference handles negation and multi-state comparisons deterministically', () => {
  const correctionQuery = 'I am buying in Victoria, not Queensland. The agent mentioned Form 2 seller disclosure. Which disclosure guide is relevant to me?';
  const corrected = searchGuides({ query: correctionQuery, limit: 10 });
  assert.ok(corrected.length > 0);
  assert.ok(corrected.every((result) => result.slug !== 'seller-disclosure-qld'));
  assert.equal(corrected[0].slug, 'reading-a-section-32');

  const comparisonQuery = 'Compare cooling-off periods in Victoria and NSW before I sign a contract.';
  const comparison = searchGuides({ query: comparisonQuery, limit: 5 });
  assert.ok(comparison.some((result) => result.slug === 'cooling-off-period-by-state'));

  const disclosureComparisonQuery = 'Buying in Victoria and Queensland: compare disclosure requirements';
  const disclosureComparison = searchGuides({ query: disclosureComparisonQuery, limit: 5 });
  assert.ok(disclosureComparison.some((result) => result.slug === 'reading-a-section-32'));
  assert.ok(disclosureComparison.some((result) => result.slug === 'seller-disclosure-qld'));
});

test('legislation titles do not misclassify ordinary Act wording as the ACT jurisdiction', () => {
  const cases = [
    {
      query: 'NSW cooling off period under the Conveyancing Act',
      expected: 'cooling-off-period-by-state',
      forbidden: ['reading-a-section-32', 'seller-disclosure-qld'],
    },
    {
      query: 'Section 32 requirements under the Victorian Sale of Land Act',
      expected: 'reading-a-section-32',
      forbidden: ['reading-a-contract-for-sale-nsw', 'seller-disclosure-qld'],
    },
    {
      query: 'Owners corporation rules under the Strata Schemes Management Act in NSW',
      expected: 'reading-your-owners-corporation-report',
      forbidden: ['reading-a-section-32', 'seller-disclosure-qld'],
    },
  ];

  for (const { query, expected, forbidden } of cases) {
    const results = searchGuides({ query, limit: 10 });
    assert.equal(results[0]?.slug, expected, `wrong top result for: ${query}`);
    assert.ok(results.every((result) => !forbidden.includes(result.slug)), `jurisdiction leaked for: ${query}`);
  }

  const allCapsVic = searchGuides({ query: 'WHAT DOES THE SALE OF LAND ACT REQUIRE IN VICTORIA?', limit: 10 });
  assert.equal(allCapsVic[0]?.slug, 'reading-a-section-32');
  assert.ok(allCapsVic.every((result) => !['reading-a-contract-for-sale-nsw', 'seller-disclosure-qld'].includes(result.slug)));

  const melbourneAct = searchGuides({ query: 'Building Act compliance for a Melbourne home', limit: 10 });
  assert.equal(isWeakMatch('Building Act compliance for a Melbourne home', melbourneAct), true);
  assert.ok(melbourneAct.every((result) => !['reading-a-contract-for-sale-nsw', 'seller-disclosure-qld'].includes(result.slug)));
});

test('ACT remains usable as an explicit jurisdiction without treating every legal Act as the territory', () => {
  const upper = searchGuides({ query: 'What is the cooling-off period when buying in ACT?', limit: 10 });
  const lowerLocationCue = searchGuides({ query: 'What is the cooling-off period when buying in act?', limit: 10 });
  const definiteArticle = searchGuides({ query: 'What is the cooling-off period when buying in the ACT?', limit: 10 });
  const firstPersonDefiniteArticle = searchGuides({ query: 'I am in the ACT, what disclosure applies?', limit: 10 });
  assert.equal(upper[0]?.slug, 'cooling-off-period-by-state');
  assert.equal(lowerLocationCue[0]?.slug, 'cooling-off-period-by-state');
  assert.equal(definiteArticle[0]?.slug, 'cooling-off-period-by-state');
  for (const results of [upper, lowerLocationCue, definiteArticle, firstPersonDefiniteArticle]) {
    assert.ok(results.every((result) => !['reading-a-section-32', 'reading-a-contract-for-sale-nsw', 'seller-disclosure-qld'].includes(result.slug)));
  }

  const explicitCode = listGuides({ jurisdiction: 'act', cluster: 'state-rules' });
  assert.deepEqual(
    explicitCode.map((guide) => guide.slug),
    listGuides({ jurisdiction: 'ACT', cluster: 'state-rules' }).map((guide) => guide.slug),
  );
});

test('answerability guard does not weaken topics Homechecker explicitly covers', () => {
  const answerable = [
    'how much does a building and pest inspection cost',
    'how much does a building biologist cost',
    'what should i check before buying an apartment',
    'does a renovation need planning checks before i start',
    'how can home condition affect insurance',
    'what should i inspect in a house built in 1965',
  ];

  for (const query of answerable) {
    const results = searchGuides({ query });
    assert.ok(results.length > 0, `expected results for: ${query}`);
    assert.equal(isWeakMatch(query, results), false, `answerable query unexpectedly weak: ${query}`);
  }
});

test('authority coverage rejects unexplained non-residential context without named-domain exclusions', () => {
  const collisions = [
    'What does brick veneer mean in a spacecraft habitat module?',
    'What does Section 32 mean in an aircraft maintenance manual?',
    'What does a property condition report mean in a rental car fleet system?',
    'How do I render a heritage overlay layer in a game engine?',
    'What should a building inspection cover for a museum exhibit?',
    'What is a vendor statement in corporate procurement?',
  ];

  for (const query of collisions) {
    const results = searchGuides({ query, limit: 3 });
    assert.ok(results.length === 0 || isWeakMatch(query, results), `unexplained context leaked as strong: ${query}`);
  }
});

test('claim mode separates general guidance from property-specific determinations', () => {
  const guidance = [
    'What can diagonal cracking indicate in a house?',
    'What evidence should I collect about damp in my house?',
    'How can home condition affect insurance?',
  ];
  for (const query of guidance) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length > 0, `expected guidance for: ${query}`);
    assert.equal(isWeakMatch(query, results), false, `general guidance unexpectedly weak: ${query}`);
  }

  const determinations = [
    'Does this diagonal crack mean the foundations have failed?',
    'Can mould in my house make my child sick?',
    'Is this Section 32 legally valid?',
    'Will my insurer definitely cover roof damage on this house?',
    'Is a special levy of $50,000 reasonable for this apartment building?',
  ];
  for (const query of determinations) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length === 0 || isWeakMatch(query, results), `specific determination leaked as strong: ${query}`);
  }
});

test('checklist uses authored actions, preserves explicit concerns and excludes incompatible era rows', () => {
  const checklist = buildBuyerChecklist({
    jurisdiction: 'VIC',
    propertyType: 'house',
    era: '1950s-1970s',
    buyingStage: 'before offer or auction',
    concerns: ['cracking', 'damp', 'auction'],
  }, 12);

  const sources = new Set(checklist.items.map((item) => item.guideSlug));
  assert.ok(sources.has('cracks-structural-or-cosmetic'));
  assert.ok(sources.has('damp-and-moisture-in-your-home'));
  assert.ok([...sources].some((slug) => /auction/.test(slug)));

  const text = checklist.items.map((item) => item.check).join('\n');
  assert.doesNotMatch(text, /^Check (?:sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra):/im);
  assert.doesNotMatch(text, /\b(?:Pre-1920s|1920s.?40s|1980s.?90s|2000s onward)\b/i);
});

test('authored questions retain strong confidence in their own guidance', () => {
  for (const guide of guides.filter((guide) => !guide.pillar)) {
    const results = searchGuides({ query: guide.question, limit: 5 });
    assert.equal(results[0]?.slug, guide.slug, `wrong guide for: ${guide.question}`);
    assert.equal(isWeakMatch(guide.question, results), false, `authored question weakened: ${guide.question}`);
  }
});

test('methods and document checks are not mistaken for determinations or provider selection', () => {
  const queries = [
    ['Is a building inspection worth it before auction?', 'building-inspection-before-auction'],
    ['How do I check planning approval records before renovating my home?', 'planning-a-renovation'],
    ['What records should I review about council approval for my home renovation?', 'planning-a-renovation'],
    ['What is the best way to investigate damp in a house?', 'damp-and-moisture-in-your-home'],
    ['What is the best way to choose a building and pest inspector?', 'how-to-choose-a-building-and-pest-inspector'],
    ['What does a building inspection cover before buying a house?', 'how-to-read-a-building-and-pest-report'],
    ['How do I read strata meeting minutes?', 'reading-your-owners-corporation-report'],
  ];
  for (const [query, slug] of queries) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.some((result) => result.slug === slug), `missing guidance for: ${query}`);
    assert.equal(isWeakMatch(query, results), false, `guidance weakened: ${query}`);
  }
});

test('a supported cost request cannot authorise a separate property-specific conclusion', () => {
  const cost = 'How much does a building and pest inspection cost?';
  const costResults = searchGuides({ query: cost });
  assert.equal(costResults[0]?.slug, 'building-and-pest-inspection-cost');
  assert.equal(isWeakMatch(cost, costResults), false);
  const queries = [
    'Is this house structurally safe?',
    'Is this house structurally safe, and how much does a building and pest inspection cost?',
    'How much does a building and pest inspection cost, and is this house structurally safe?',
    'How much does a building and pest inspection cost? Is this house structurally safe?',
    'Is this building inspection report legally valid, and how much does a building inspection cost?',
    'Is a $500 building and pest inspection fee reasonable for this house?',
    'Is a $500.50 building and pest inspection fee reasonable for this house?',
  ];
  for (const query of queries) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length > 0, `expected useful background: ${query}`);
    assert.equal(isWeakMatch(query, results), true, `determination leaked as strong: ${query}`);
  }
});

test('unsupported settings cannot be diluted by residential vocabulary', () => {
  const cases = [
    'What should I check before buying a house in Monopoly?',
    'What should I check before buying a house in a video game?',
    'What should I check before buying a house within Zorblaxia?',
    'What does Section 32 mean in an aircraft maintenance manual?',
    'What does brick veneer mean in a spacecraft habitat module?',
    'What should a building inspection cover for a museum exhibit?',
  ];
  for (const query of cases) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length === 0 || isWeakMatch(query, results), `unsupported setting accepted: ${query}`);
  }
  for (const query of [
    'What should I check before buying an apartment in NSW?',
    'What should I check in a house built in 1965?',
    'What evidence should I collect about damp in my house?',
  ]) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length > 0, `missing residential guidance: ${query}`);
    assert.equal(isWeakMatch(query, results), false, `supported context weakened: ${query}`);
  }
});

test('multiple initially missing concern sources survive regardless of input order', () => {
  const profile = {
    jurisdiction: 'VIC', propertyType: 'house', era: '1950s-1970s',
    buyingStage: 'before offer or auction',
  };
  const orders = [
    ['damp', 'renovation', 'records'], ['records', 'renovation', 'damp'],
    ['renovation', 'damp', 'records'], ['damp', 'records', 'renovation'],
  ];
  let reference;
  for (const concerns of orders) {
    const checklist = buildBuyerChecklist({ ...profile, concerns }, 12);
    const slugs = new Set(checklist.items.map((item) => item.guideSlug));
    for (const slug of ['damp-and-moisture-in-your-home', 'planning-a-renovation', 'keeping-a-record-of-your-home']) {
      assert.ok(slugs.has(slug), `dropped ${slug} for ${concerns}`);
    }
    assert.ok([...slugs].some((slug) => slug.includes('auction')));
    // The renovation export has descriptive table candidates. Its actions
    // must come from actual authored prose, not an invented "Check" prefix.
    for (const item of checklist.items.filter((item) => item.guideSlug === 'planning-a-renovation')) {
      assert.ok(getGuide(item.guideSlug).sections.some((section) => section.heading === item.section && section.markdown.includes(item.check)));
    }
    assert.ok(checklist.matchedGuides.length <= 6);
    assert.ok(checklist.items.length <= 12);
    const selection = { matchedGuides: checklist.matchedGuides, items: checklist.items };
    if (reference) assert.deepEqual(selection, reference, 'concern order changed selected guidance');
    reference = selection;
  }
});

test('transaction recommendations are weak across ordinary decision phrasing', () => {
  const decisions = [
    'Should we buy this house?',
    'Would you buy this house?',
    'Would you bid on this house?',
    'Should we make an offer on this apartment?',
    'Is this a good house to buy?',
    'Do you recommend buying this house?',
    'Which house should we buy?',
  ];
  for (const query of decisions) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length > 0, `expected useful background: ${query}`);
    assert.equal(isWeakMatch(query, results), true, `transaction decision leaked as strong: ${query}`);
  }
});

test('transaction guidance stays strong when the user asks how to investigate or prepare', () => {
  const guidance = [
    'What should I check before buying a house?',
    'What should I check before bidding at auction?',
    'How should I prepare before bidding at auction?',
  ];
  for (const query of guidance) {
    const results = searchGuides({ query, limit: 5 });
    assert.ok(results.length > 0, `expected transaction guidance: ${query}`);
    assert.equal(isWeakMatch(query, results), false, `transaction guidance unexpectedly weak: ${query}`);
  }
});

