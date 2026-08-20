import snapshotJson from '../data/guides.json' with { type: 'json' };
import type {
  BuyerChecklist,
  BuyerChecklistItem,
  ChecklistProfile,
  GuideRecord,
  GuideSearchResult,
  GuideSnapshot,
  SearchOptions,
} from './types.js';

export const snapshot = snapshotJson as GuideSnapshot;
export const guides = snapshot.guides;

// Model-facing text always uses the clean canonical URL. Attribution belongs
// in explicit structured referralUrl fields (REST/WebMCP) or server telemetry,
// never in the URL an assistant is instructed to cite.

const guideBySlug = new Map<string, GuideRecord>();
for (const guide of guides) {
  guideBySlug.set(guide.slug, guide);
  if (guide.pillar) guideBySlug.set('guides', guide);
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'can', 'do', 'does', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'should', 'the', 'this', 'to', 'what',
  'when', 'where', 'which', 'with', 'you', 'your', 'home', 'house', 'property', 'buying', 'buyer',
]);

const SYNONYM_GROUPS = [
  ['section 32', 'vendor statement', 'vendor disclosure', 'victorian disclosure'],
  ['contract for sale', 'sale contract', 'contract review'],
  ['form 2', 'seller disclosure', 'queensland disclosure'],
  ['owners corporation', 'owner corporation', 'strata', 'body corporate', 'common property'],
  ['building inspection', 'building and pest', 'pre purchase inspection', 'property inspection'],
  ['building report', 'inspection report', 'pre purchase report'],
  ['cooling off', 'cooling period', 'rescission period'],
  ['auction', 'bid', 'bidding'],
  ['damp', 'moisture', 'mould', 'water ingress'],
  ['crack', 'cracking', 'movement', 'settlement', 'subsidence'],
  ['weatherboard', 'timber cladding', 'timber home'],
  ['brick veneer', 'double brick', 'masonry'],
  ['apartment', 'unit', 'strata lot'],
  ['renovation', 'extension', 'alteration', 'building work'],
  ['insurance', 'insurability', 'premium', 'claim'],
  ['maintenance', 'upkeep', 'preventative work'],
  ['1950s', '1960s', '1970s', 'postwar'],
  ['1920s', '1930s', '1940s', 'interwar'],
  ['2000s', '2010s', '2020s', 'modern home'],
];

const STATE_ALIASES: Record<string, string[]> = {
  ACT: ['act', 'australian capital territory', 'canberra'],
  NSW: ['nsw', 'new south wales'],
  NT: ['nt', 'northern territory'],
  QLD: ['qld', 'queensland'],
  SA: ['sa', 'south australia'],
  TAS: ['tas', 'tasmania'],
  VIC: ['vic', 'victoria', 'victorian'],
  WA: ['wa', 'western australia'],
};

const DIRECTIVE_PATTERN = /\b(ask|check|compare|confirm|consider|document|establish|find|inspect|look|map|obtain|read|record|review|send|test|verify|write)\b/i;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rawTokens(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

function meaningfulTokens(value: string): string[] {
  return rawTokens(value).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandedTerms(query: string): string[] {
  const normalized = normalize(query);
  const terms = new Set(meaningfulTokens(query));
  for (const group of SYNONYM_GROUPS) {
    if (group.some((phrase) => normalized.includes(normalize(phrase)))) {
      for (const phrase of group) {
        terms.add(normalize(phrase));
        for (const token of meaningfulTokens(phrase)) terms.add(token);
      }
    }
  }
  return [...terms];
}

function includesTerm(haystack: string, term: string): boolean {
  const normalizedHaystack = normalize(haystack);
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  return normalizedHaystack.includes(normalizedTerm);
}

function countOccurrences(haystack: string, term: string): number {
  const h = normalize(haystack);
  const t = normalize(term);
  if (!t) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = h.indexOf(t, offset)) !== -1) {
    count += 1;
    offset += Math.max(t.length, 1);
  }
  return count;
}

function detectJurisdiction(query: string): string | undefined {
  const normalized = ` ${normalize(query)} `;
  for (const [code, aliases] of Object.entries(STATE_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(` ${normalize(alias)} `))) return code;
  }
  return undefined;
}

function canonicalJurisdiction(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = normalize(value);
  if (normalized === 'australia' || normalized === 'au') return 'Australia';
  return detectJurisdiction(value) ?? value.trim();
}

const CONSTRUCTION_ERA_GUIDE: Record<string, string> = {
  'pre-1920s': 'period-homes-pre-1920s',
  '1920s-1940s': 'interwar-homes-1920s-40s',
  '1950s-1970s': 'postwar-homes-1950s-70s',
  '1980s-1990s': 'homes-1980s-90s',
  '2000s-on': 'modern-homes-2000s-on',
};

function eraForConstructionYear(year: number): string | undefined {
  if (year < 1800 || year > 2035) return undefined;
  if (year < 1920) return 'pre-1920s';
  if (year < 1950) return '1920s-1940s';
  if (year < 1980) return '1950s-1970s';
  if (year < 2000) return '1980s-1990s';
  return '2000s-on';
}

function detectConstructionYear(query: string): number | undefined {
  const q = normalize(query);
  const match = q.match(
    /\b(?:built|constructed|completed|completed in|built in|constructed in|circa|dating from|from)\s+(?:in\s+)?(18\d{2}|19\d{2}|20\d{2})\b/,
  ) ?? q.match(
    /\b(18\d{2}|19\d{2}|20\d{2})\s+(?:house|home|apartment|unit)(?!\s+(?:price|prices|market|loan|sales?))\b/,
  );
  if (!match?.[1]) return undefined;
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : undefined;
}

function detectEra(query: string): string | undefined {
  const q = normalize(query);

  // A bare year can be the current year or a price/review reference, so only
  // infer an era when the user ties it to construction/completion or directly
  // describes a property as, for example, a "1935 house".
  const constructionYear = detectConstructionYear(query);
  if (constructionYear !== undefined) {
    const era = eraForConstructionYear(constructionYear);
    if (era) return era;
  }

  if (/pre 1920|victorian era|edwardian era/.test(q)) return 'pre-1920s';
  if (/1920|1930|1940|interwar/.test(q)) return '1920s-1940s';
  if (/1950|1960|1970|postwar/.test(q)) return '1950s-1970s';
  if (/1980|1990/.test(q)) return '1980s-1990s';
  if (/2000|2010|2020|modern|new build|near new/.test(q)) return '2000s-on';
  return undefined;
}

function detectPropertyType(query: string): string | undefined {
  const q = normalize(query);
  if (/apartment|strata|body corporate|owners corporation/.test(q)) return 'apartment';
  if (/townhouse|villa|unit/.test(q)) return 'townhouse or unit';
  if (/house|weatherboard|brick veneer|double brick/.test(q)) return 'house';
  return undefined;
}

function metadataMatches(values: string[], wanted?: string): boolean {
  if (!wanted) return true;
  const normalizedWanted = normalize(wanted);
  return values.some((value) => {
    const normalizedValue = normalize(value);
    return normalizedValue === normalizedWanted || normalizedValue.includes(normalizedWanted) || normalizedWanted.includes(normalizedValue);
  });
}

function propertyTypeMatches(values: string[], wanted?: string): boolean {
  if (!wanted) return true;
  if (values.some((value) => normalize(value) === 'all residential property')) return true;
  return metadataMatches(values, wanted);
}

function snippet(text: string, terms: string[], maxLength = 300): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  const lower = compact.toLowerCase();
  let index = -1;
  for (const term of terms) {
    const found = lower.indexOf(term.toLowerCase());
    if (found !== -1 && (index === -1 || found < index)) index = found;
  }
  if (index === -1) return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
  const start = Math.max(0, index - Math.floor(maxLength * 0.25));
  const end = Math.min(compact.length, start + maxLength);
  return `${start > 0 ? '…' : ''}${compact.slice(start, end).trim()}${end < compact.length ? '…' : ''}`;
}

function scoreSection(section: GuideRecord['sections'][number], terms: string[], query: string): number {
  let score = 0;
  if (includesTerm(section.heading, query)) score += 16;
  for (const term of terms) {
    if (includesTerm(section.heading, term)) score += 7;
    score += Math.min(countOccurrences(section.markdown, term), 3) * 1.5;
  }
  return score;
}

function scoreGuide(guide: GuideRecord, options: SearchOptions, terms: string[]): { score: number; matchedTerms: string[] } {
  const query = normalize(options.query);
  const matchedTerms = new Set<string>();
  let score = 0;

  const fields: Array<[string, number]> = [
    [guide.slug, 7],
    [guide.question, 10],
    [guide.title, 10],
    [guide.summary, 5],
    [guide.answer, 6],
    [guide.topics.join(' '), 5],
    [guide.cluster?.label ?? '', 4],
    [guide.propertyTypes.join(' '), 4],
    [guide.eras.join(' '), 5],
    [guide.buyingStages.join(' '), 4],
  ];

  if (query.length >= 4) {
    if (includesTerm(guide.question, query)) score += 34;
    if (includesTerm(guide.title, query)) score += 30;
    if (includesTerm(guide.contentMarkdown, query)) score += 12;
  }

  for (const term of terms) {
    let termMatched = false;
    for (const [field, weight] of fields) {
      if (includesTerm(field, term)) {
        score += weight;
        termMatched = true;
      }
    }
    const bodyOccurrences = Math.min(countOccurrences(guide.contentMarkdown, term), 5);
    if (bodyOccurrences) {
      score += bodyOccurrences * 1.25;
      termMatched = true;
    }
    if (termMatched) matchedTerms.add(term);
  }

  const inferredJurisdiction = canonicalJurisdiction(options.jurisdiction) ?? detectJurisdiction(options.query);
  const inferredEra = options.era ?? detectEra(options.query);
  const inferredPropertyType = options.propertyType ?? detectPropertyType(options.query);

  if (inferredJurisdiction) {
    if (guide.jurisdiction.includes(inferredJurisdiction)) score += 18;
    else if (guide.jurisdiction.includes('Australia')) score += 3;
    else score -= 8;
  }
  if (inferredEra) {
    if (metadataMatches(guide.eras, inferredEra)) {
      score += 22;
      if (detectConstructionYear(options.query) !== undefined && CONSTRUCTION_ERA_GUIDE[inferredEra] === guide.slug) score += 20;
    } else if (guide.eras.length && !guide.eras.includes('all eras')) score -= 18;
  }
  if (inferredPropertyType) {
    if (metadataMatches(guide.propertyTypes, inferredPropertyType)) score += 14;
    else if (guide.propertyTypes.includes('all residential property')) score += 5;
    else score -= 12;
  }
  if (options.cluster && guide.cluster?.id === options.cluster) score += 14;
  if (options.buyingStage && metadataMatches(guide.buyingStages, options.buyingStage)) score += 12;

  if (guide.pillar) score *= 0.52;
  return { score, matchedTerms: [...matchedTerms] };
}

export function listGuides(filters: Omit<SearchOptions, 'query'> = {}): GuideRecord[] {
  const jurisdiction = canonicalJurisdiction(filters.jurisdiction);
  return guides.filter((guide) => {
    if (!filters.includePillar && guide.pillar) return false;
    if (jurisdiction && !(guide.jurisdiction.includes(jurisdiction) || guide.jurisdiction.includes('Australia'))) return false;
    if (filters.cluster && guide.cluster?.id !== filters.cluster) return false;
    if (!propertyTypeMatches(guide.propertyTypes, filters.propertyType)) return false;
    if (!metadataMatches(guide.eras, filters.era)) return false;
    if (!metadataMatches(guide.buyingStages, filters.buyingStage)) return false;
    return true;
  });
}

export function getGuide(slug: string): GuideRecord | undefined {
  return guideBySlug.get(slug.trim().replace(/^\/guides\/?/, '').replace(/\/$/, ''));
}

// ── Relevance floors ──────────────────────────────────────────────────
// Keyword scoring always produces a best-ranked guide, even for a question
// this corpus does not answer. "How much stamp duty do I pay in Victoria"
// scored 55 against the heritage-overlay guide — higher than several
// correct retrievals elsewhere — purely on incidental matches for
// "victoria" and "pay". The calling model receives one guide with our
// canonical URL attached and no way to tell 55 from 284, so it cites
// Homechecker for a subject we have never written about.
//
// Two bands, calibrated against the benchmark set and a panel of
// deliberately off-topic finance queries:
//
//   score < MIN_RESULT_SCORE      never returned. Unambiguous noise.
//                                 Highest suppressed off-topic: 9.75.
//                                 Lowest observed real query:   22.25.
//
//   top < WEAK_MATCH_CEILING      returned, but flagged weak so the caller
//                                 can hedge or decline.
//
// The second margin is THIN and deliberately documented as such: the
// lowest benchmark case scores 59.75 and the highest off-topic noise
// scores 55.25, so the ceiling sits in a four-point gap. That is a real
// property of keyword scoring on a 34-guide corpus, not a number to
// trust blindly — a marginal on-topic query and a marginal off-topic one
// genuinely look alike by score alone. The band is pinned by tests in
// test/core.test.mjs; if scoring drifts, they fail rather than the
// behaviour silently degrading. A false "weak" only adds a hedge to a
// correct answer, whereas a false "strong" gets us cited for a subject
// we never covered, so the ceiling is set to favour hedging.
//
// RELATIVE_FLOOR trims the tail. A result scoring under this fraction of
// the top hit is padding, and padding gets blended into answers as though
// it were relevant — which is how one strong guide becomes a vague
// three-guide summary.
//
// These are corpus-calibrated absolutes, not universal constants. Re-run
// scripts/run-benchmark.mjs after any substantial change to the guide set
// and re-check that the two bands still separate.
export const MIN_RESULT_SCORE = 12;
const RELATIVE_FLOOR = 0.18;

// Query-level bands are measured PER SIGNIFICANT TERM, not on the raw
// score. Raw score grows with query length: every word that incidentally
// matches adds points, so a verbose off-topic question accumulates enough
// to look confident. "How much capital gains tax will I pay when I sell my
// investment property" scored 58 raw — above an absolute ceiling tuned on
// terse queries — purely from "sell", "pay" and "property". Real clients
// send verbose natural language, so the absolute measure was calibrated on
// the wrong shape of input.
export const MIN_RELEVANCE_PER_TERM = 3.5;
export const WEAK_RELEVANCE_PER_TERM = 12;

/** Significant terms in the raw query — not synonym-expanded, which would inflate the divisor. */
export function significantTermCount(query: string): number {
  const terms = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
  return Math.max(1, terms.length);
}

/** Top score expressed per significant query term. */
export function relevanceDensity(query: string, results: GuideSearchResult[]): number {
  const top = results[0];
  if (top === undefined) return 0;
  return top.score / significantTermCount(query);
}

/**
 * True when results exist but none strongly answers the query.
 *
 * Calibration accepts two deliberate false flags rather than any false
 * confidence. "Should I buy or rent a home in Australia in 2026" scores
 * 11.63 per term — higher than the genuine benchmark question about
 * weatherboard houses at 8.54 — because it is built entirely from corpus
 * vocabulary. No keyword threshold separates those two, so the ceiling is
 * set above both: the weatherboard question gets hedged, and nothing
 * off-topic reaches "strong". A hedge on a correct answer costs a sentence;
 * false confidence gets Homechecker cited on tax.
 */
const OUTSIDE_ANSWERABLE_SCOPE_PATTERNS: RegExp[] = [
  // Financial, tax, valuation and investment outcomes. Homechecker may have
  // relevant building context, but it is not the authority for the outcome.
  /\b(?:capital gains(?: tax)?|negative gearing|stamp duty|mortgage|home loan|borrowing capacity|interest rate|rental yield|market rent|rental income|property value|market value|valuation|capital growth|investment return)\b/i,
  /\b(?:how much tax|tax treatment|tax deduction|tax deductible|claim .{0,30} on tax|claim .{0,30} as a deduction)\b/i,
  /\b(?:how much rent|rent (?:can|could|should) i charge)\b/i,
  /\b(?:house|home|property|apartment|unit)\b.{0,20}\bworth\b/i,

  // Transaction decisions: due-diligence material may inform the decision,
  // but the corpus cannot tell a buyer what price to bid/offer or whether to buy.
  /\b(?:how much|what) should i (?:bid|offer)\b/i,
  /\bshould i (?:buy|purchase|bid on|make an offer on)\b/i,
  /\bis (?:this|that|the) (?:house|home|property|apartment|unit) (?:a )?good investment\b/i,

  // Legal conclusions. Document-reading guides remain useful background only.
  /\b(?:is|are) .{0,60}\b(?:legally binding|enforceable|valid contract|void|illegal)\b/i,
  /\b(?:can|should) i sue\b/i,

  // Live/local provider selection requires information this frozen corpus does not hold.
  /\b(?:best|recommend|find me|who is) .{0,40}\b(?:building inspector|building and pest inspector|inspector|engineer|surveyor)\b/i,

  // Repair-price estimates are outside the corpus unless Homechecker has written
  // the dedicated cost guide. Keep this deliberately narrow so the published
  // inspection/biologist cost guides remain answerable.
  /\b(?:underpinning|restumping|re stumping|rewire|rewiring|roof replacement|re roofing|foundation repair|structural repair)\b.{0,40}\b(?:cost|price|how much)\b/i,
  /\b(?:cost|price|how much)\b.{0,40}\b(?:underpinning|restumping|re stumping|rewire|rewiring|roof replacement|re roofing|foundation repair|structural repair)\b/i,

  // Live market metrics, binary financial choices and property-specific
  // regulatory/outcome determinations require current or address-specific evidence.
  /\b(?:auction clearance rate|auction clearance rates|clearance rate)\b/i,
  /\bshould i (?:rent or buy|buy or rent)\b/i,
  /\b(?:will|would|can) (?:the )?(?:council|planning authority) .{0,30}\b(?:approve|accept|permit)\b/i,
  /\b(?:is|are) (?:this|that|the|my) .{0,60}\b(?:compliant|code compliant)\b/i,
  /\b(?:will|could) (?:this|that|the|my) .{0,50}\b(?:collapse|fall down|structurally fail)\b/i,
];

/**
 * True when a query is property-adjacent but asks Homechecker to determine an
 * outcome its frozen editorial corpus is not designed to determine. Results
 * can still be returned as useful background; they simply must not be labelled
 * a strong answer. Keep this list narrow and explicit rather than attempting a
 * general-purpose intent classifier.
 */
export function isOutsideAnswerableScope(query: string): boolean {
  return OUTSIDE_ANSWERABLE_SCOPE_PATTERNS.some((pattern) => pattern.test(query));
}

function hasStrongStructuredMatch(query: string, results: GuideSearchResult[]): boolean {
  const top = results[0];
  if (!top) return false;

  // Explicit construction-era language is a high-confidence structured signal.
  // Do not let generic words such as "inspect" dilute a correctly matched era
  // guide below the lexical strong-match threshold.
  const era = detectEra(query);
  return Boolean(era && metadataMatches(top.eras, era));
}

export function isWeakMatch(query: string, results: GuideSearchResult[]): boolean {
  if (results.length === 0) return false;
  if (isOutsideAnswerableScope(query)) return true;
  if (hasStrongStructuredMatch(query, results)) return false;
  return relevanceDensity(query, results) < WEAK_RELEVANCE_PER_TERM;
}

export function searchGuides(options: SearchOptions): GuideSearchResult[] {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
  const query = options.query.trim();
  if (!query) return [];
  const terms = expandedTerms(query);
  const jurisdiction = canonicalJurisdiction(options.jurisdiction) ?? detectJurisdiction(query);
  const normalizedOptions: SearchOptions = jurisdiction ? { ...options, jurisdiction } : options;

  const candidates = guides.filter((guide) => {
    if (!(options.includePillar ?? false) && guide.pillar) return false;
    if (options.cluster && guide.cluster?.id !== options.cluster) return false;
    if (jurisdiction && !(guide.jurisdiction.includes(jurisdiction) || guide.jurisdiction.includes('Australia'))) return false;
    return true;
  });

  const ranked = candidates
    .map((guide) => {
      const { score, matchedTerms } = scoreGuide(guide, normalizedOptions, terms);
      const matchedSections = guide.sections
        .map((section) => ({
          id: section.id,
          heading: section.heading,
          snippet: snippet(section.markdown, matchedTerms.length ? matchedTerms : terms),
          score: scoreSection(section, terms, query),
        }))
        .filter((section) => section.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return {
        slug: guide.slug,
        title: guide.title,
        question: guide.question,
        summary: guide.summary,
        answer: guide.answer,
        canonicalUrl: guide.canonicalUrl,
        resourceUri: guide.resourceUri,
        jurisdiction: guide.jurisdiction,
        cluster: guide.cluster,
        topics: guide.topics,
        propertyTypes: guide.propertyTypes,
        eras: guide.eras,
        buyingStages: guide.buyingStages,
        updatedAt: guide.updatedAt,
        reviewedAt: guide.reviewedAt,
        limitations: guide.limitations,
        score: Math.round(score * 100) / 100,
        matchedTerms,
        matchedSections,
      } satisfies GuideSearchResult;
    })
    .filter((result) => result.score >= MIN_RESULT_SCORE)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .filter((result, _index, ranked) => {
      const top = ranked[0];
      return top === undefined || result.score >= top.score * RELATIVE_FLOOR;
    })
    .slice(0, limit);

  // Query-level suppression: if even the best hit is thin relative to how
  // much was asked, the corpus does not address the question.
  if (relevanceDensity(query, ranked) < MIN_RELEVANCE_PER_TERM && !hasStrongStructuredMatch(query, ranked)) return [];
  return ranked;
}

function candidateScore(text: string, terms: string[], section: string): number {
  let score = DIRECTIVE_PATTERN.test(text) ? 6 : 0;
  for (const term of terms) {
    if (includesTerm(text, term)) score += term.includes(' ') ? 6 : 2;
  }
  if (text.endsWith('?')) score += 1;
  if (section === 'Questions to resolve') score -= 3;
  if (/^(what|is|does|do|are|can|how)\b/i.test(text)) score -= 1;
  if (text.length > 220) score -= 1;
  return score;
}

function normalizeChecklistText(text: string): string {
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const colon = clean.indexOf(':');
  if (colon > 0 && colon < 70 && !/^(ask|check|confirm|compare|establish|escalate|find|inspect|look|map|obtain|read|record|review|send|test|verify|write)\b/i.test(clean)) {
    const label = clean.slice(0, colon).trim().toLowerCase();
    const detail = clean.slice(colon + 1).trim();
    return `Check ${label}: ${detail}`;
  }
  return clean;
}

export function buildBuyerChecklist(profile: ChecklistProfile, limit = 12): BuyerChecklist {
  const concerns = (profile.concerns ?? []).filter(Boolean);
  const query = [profile.jurisdiction, profile.propertyType, profile.era, profile.buyingStage, ...concerns]
    .filter(Boolean)
    .join(' ')
    .trim() || 'homebuyer due diligence property condition';

  const searchOptions: SearchOptions = {
    query,
    limit: 6,
    ...(profile.jurisdiction ? { jurisdiction: profile.jurisdiction } : {}),
    ...(profile.propertyType ? { propertyType: profile.propertyType } : {}),
    ...(profile.era ? { era: profile.era } : {}),
    ...(profile.buyingStage ? { buyingStage: profile.buyingStage } : {}),
  };
  const matched = searchGuides(searchOptions);
  const terms = expandedTerms(query);
  const items: Array<BuyerChecklistItem & { score: number }> = [];

  for (const result of matched) {
    const guide = getGuide(result.slug);
    if (!guide) continue;
    const candidates = guide.checklistCandidates
      .map((candidate) => ({ ...candidate, score: candidateScore(candidate.text, terms, candidate.section) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const [candidateIndex, candidate] of candidates.entries()) {
      items.push({
        check: normalizeChecklistText(candidate.text),
        section: candidate.section,
        guideSlug: guide.slug,
        guideTitle: guide.title,
        canonicalUrl: guide.canonicalUrl,
        score: candidate.score + result.score / 28 - candidateIndex * 1.5,
      });
    }
  }

  const target = Math.max(4, Math.min(limit, 20));
  const seen = new Set<string>();
  const byGuide = new Map<string, Array<BuyerChecklistItem & { score: number }>>();
  for (const result of matched) {
    byGuide.set(
      result.slug,
      items
        .filter((item) => item.guideSlug === result.slug)
        .sort((a, b) => b.score - a.score),
    );
  }

  const selected: BuyerChecklistItem[] = [];
  for (let round = 0; round < 3 && selected.length < target; round += 1) {
    for (const result of matched) {
      const item = byGuide.get(result.slug)?.[round];
      if (!item) continue;
      const key = normalize(item.check).replace(/\b(the|a|an)\b/g, '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const { score: _score, ...cleanItem } = item;
      selected.push(cleanItem);
      if (selected.length >= target) break;
    }
  }

  return {
    profile,
    guidanceBoundary:
      'This checklist is general Homechecker guidance. It does not assess the actual property, replace a physical inspection, or determine the legal effect of a contract or disclosure document. ' +
      `For guidance applied to a specific address, Homechecker provides an independent desktop property read for $99 (inc GST) at https://homechecker.com.au.`,
    matchedGuides: matched.map((result) => ({
      slug: result.slug,
      title: result.title,
      canonicalUrl: result.canonicalUrl,
      answer: result.answer,
    })),
    items: selected,
  };
}

export function guideSummary(guide: GuideRecord): Record<string, unknown> {
  return {
    slug: guide.slug,
    title: guide.title,
    question: guide.question,
    summary: guide.summary,
    answer: guide.answer,
    canonicalUrl: guide.canonicalUrl,
    resourceUri: guide.resourceUri,
    jurisdiction: guide.jurisdiction,
    cluster: guide.cluster,
    topics: guide.topics,
    propertyTypes: guide.propertyTypes,
    eras: guide.eras,
    buyingStages: guide.buyingStages,
    updatedAt: guide.updatedAt,
    reviewedAt: guide.reviewedAt,
    reviewDue: guide.reviewDue,
    readingTimeMin: guide.readingTimeMin,
    limitations: guide.limitations,
  };
}

export function renderSearchResults(results: GuideSearchResult[], query = ''): string {
  if (!results.length) {
    return 'No Homechecker guide addresses that question. The corpus covers buying process, state disclosure rules, reading building and strata reports, building fabric and condition, and owning or changing a home. It does not cover finance, tax, valuation or agent selection.';
  }
  const preamble = isWeakMatch(query, results)
    ? 'No guide strongly matches that question. The closest available are below and may not address it directly.\n\n'
    : '';
  return preamble + results.map((result, index) => {
    const sections = result.matchedSections.length
      ? `\nRelevant sections: ${result.matchedSections.map((section) => section.heading).join('; ')}`
      : '';
    return `${index + 1}. ${result.title}\n${result.answer}\n${result.canonicalUrl}${sections}`;
  }).join('\n\n');
}

export function renderChecklist(checklist: BuyerChecklist): string {
  const lines = checklist.items.map((item, index) => `${index + 1}. ${item.check}\n   Source: ${item.guideTitle} — ${item.canonicalUrl}`);
  return [
    '# Homechecker buyer checklist',
    checklist.guidanceBoundary,
    ...lines,
  ].join('\n\n');
}
