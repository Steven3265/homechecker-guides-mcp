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
  ['cooling off', 'cooling period', 'rescission period', 'pull out after signing', 'back out after signing', 'withdraw after signing'],
  ['auction', 'bid', 'bidding'],
  ['damp', 'moisture', 'mould', 'water ingress', 'rainwater ingress', 'condensation'],
  ['crack', 'cracking', 'movement', 'settlement', 'subsidence'],
  ['weatherboard', 'timber cladding', 'timber home'],
  ['brick veneer', 'double brick', 'masonry'],
  ['apartment', 'unit', 'strata lot'],
  ['renovation', 'extension', 'alteration', 'building work'],
  ['insurance', 'insurer', 'insurability', 'premium', 'claim'],
  ['maintenance', 'upkeep', 'preventative work'],
  ['1950s', '1960s', '1970s', 'postwar'],
  ['1920s', '1930s', '1940s', 'interwar'],
  ['2000s', '2010s', '2020s', 'modern home'],
];

const STATE_ALIASES: Record<string, string[]> = {
  ACT: ['australian capital territory', 'canberra'],
  NSW: ['nsw', 'new south wales', 'sydney'],
  NT: ['nt', 'northern territory', 'darwin'],
  QLD: ['qld', 'queensland', 'brisbane'],
  SA: ['sa', 'south australia', 'adelaide'],
  TAS: ['tas', 'tasmania', 'hobart'],
  VIC: ['vic', 'victoria', 'victorian', 'melbourne'],
  WA: ['wa', 'western australia', 'perth'],
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

type JurisdictionMention = { code: string; index: number; alias: string; negated: boolean };

function jurisdictionMentions(query: string): JurisdictionMention[] {
  const normalized = ` ${normalize(query)} `;
  const mentions: JurisdictionMention[] = [];

  // ACT is uniquely ambiguous because "Act" is also the ordinary legislation
  // suffix. Treat ACT as the territory only when it is used as a location or
  // directly qualifies residential-property language. This also makes ALL-CAPS
  // legal questions such as "SALE OF LAND ACT ... VICTORIA" safe.
  const actPatterns = [
    /\b(?:in|for|within|across|from|to)\s+(?:the\s+)?(ACT)\b/gi,
    /\b(ACT)\s+(?:home|house|property|apartment|unit|buyer|seller|contract|purchase|market)\b/g,
  ];
  for (const pattern of actPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      const rawAlias = match[1]!;
      const aliasOffset = match.index + match[0].toLowerCase().lastIndexOf(rawAlias.toLowerCase());
      const normalizedPrefix = normalize(query.slice(0, aliasOffset));
      const index = (` ${normalizedPrefix} `).length - 1;
      const before = normalized.slice(Math.max(0, index - 28), index + 1);
      const negated = /\b(?:not|except|excluding|outside|rather than|not in)\s*$/.test(before.trimEnd());
      mentions.push({ code: 'ACT', index, alias: 'act', negated });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }

  for (const [code, aliases] of Object.entries(STATE_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      const needle = ` ${normalizedAlias} `;
      let offset = 0;
      while ((offset = normalized.indexOf(needle, offset)) !== -1) {
        const before = normalized.slice(Math.max(0, offset - 28), offset + 1);
        const negated = /\b(?:not|except|excluding|outside|rather than|not in)\s*$/.test(before.trimEnd());
        mentions.push({ code, index: offset, alias: normalizedAlias, negated });
        offset += needle.length;
      }
    }
  }

  return mentions;
}

function mentionedJurisdictions(query: string): string[] {
  return [...new Set(
    jurisdictionMentions(query)
      .filter((mention) => !mention.negated)
      .map((mention) => mention.code),
  )];
}

function isJurisdictionComparison(query: string, codes: string[]): boolean {
  if (codes.length < 2) return false;
  const q = normalize(query);
  return /\b(?:compare|comparison|compared|versus|vs|difference|differences|between|both|across)\b/.test(q);
}

function detectJurisdiction(query: string): string | undefined {
  const normalized = ` ${normalize(query)} `;
  const positive = jurisdictionMentions(query).filter((mention) => !mention.negated);
  const codes = [...new Set(positive.map((mention) => mention.code))];
  if (codes.length === 1) return codes[0];
  if (codes.length === 0) return undefined;
  if (isJurisdictionComparison(query, codes)) return undefined;

  // When several states are mentioned outside a genuine comparison, prefer a
  // single state explicitly tied to the property/buying location. Otherwise
  // leave jurisdiction unresolved rather than choosing by alias iteration.
  const locationCandidates = positive.filter((mention) => {
    const before = normalized.slice(Math.max(0, mention.index - 48), mention.index + 1).trimEnd();
    return /\b(?:buying|purchasing|property|home|house|apartment|unit|located|based)\s+(?:a\s+|an\s+|the\s+)?(?:property\s+|home\s+|house\s+|apartment\s+|unit\s+)?in\s*$/.test(before);
  });
  const locationCodes = [...new Set(locationCandidates.map((mention) => mention.code))];
  return locationCodes.length === 1 ? locationCodes[0] : undefined;
}

function jurisdictionsForSearch(options: SearchOptions): string[] {
  const explicit = canonicalJurisdiction(options.jurisdiction);
  if (explicit) return [explicit];

  const mentioned = mentionedJurisdictions(options.query);
  if (mentioned.length <= 1) return mentioned;

  // Search is deliberately set-based when a query positively names more than
  // one jurisdiction. Collapsing two positive state mentions to whichever one
  // happens to look most like the property location can hide the other state's
  // dedicated rule guide (for example VIC + QLD disclosure comparisons). A
  // negated state has already been removed by jurisdictionMentions(), so
  // retaining all remaining states is the conservative retrieval behaviour.
  return mentioned;
}

function canonicalJurisdiction(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = normalize(value);
  if (normalized === 'australia' || normalized === 'au') return 'Australia';
  const exactCode = Object.keys(STATE_ALIASES).find((code) => normalized === code.toLowerCase());
  if (exactCode) return exactCode;
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

  // Bare calendar years and generic words such as "modern" are common in
  // finance, history and other unrelated questions. Only construction-linked
  // years or explicit residential era language may become a structured era
  // signal. Era metadata can improve an already relevant query; it must never
  // manufacture relevance for "house price in 2020" or "modern portfolio
  // theory".
  const constructionYear = detectConstructionYear(query);
  if (constructionYear !== undefined) {
    const era = eraForConstructionYear(constructionYear);
    if (era) return era;
  }

  const propertyContext = /\b(?:home|house|property|building|apartment|unit|townhouse|villa|weatherboard|brick|construction|built|constructed|inspect|condition|renovation|fabric|era|period)\b/.test(q);
  if (!propertyContext) return undefined;

  if (/\b(?:pre 1920s?|victorian era|edwardian era)\b/.test(q)) return 'pre-1920s';
  if (/\b(?:1920s|1930s|1940s|interwar)\b/.test(q)) return '1920s-1940s';
  if (/\b(?:1950s|1960s|1970s|postwar)\b/.test(q)) return '1950s-1970s';
  if (/\b(?:1980s|1990s)\b/.test(q)) return '1980s-1990s';
  if (/\b(?:2000s|2010s|2020s)\b/.test(q)) return '2000s-on';
  if (/\bmodern\s+(?:home|house|property|building|apartment|unit|townhouse)\b/.test(q)) return '2000s-on';
  if (/\b(?:new build|near new)\b/.test(q)) return '2000s-on';
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

function scoreGuide(guide: GuideRecord, options: SearchOptions, terms: string[], inferredJurisdictions?: string[]): { score: number; matchedTerms: string[] } {
  const query = normalize(options.query);
  const matchedTerms = new Set<string>();
  let score = 0;

  const fields: Array<[string, number]> = [
    [guide.slug, 7],
    [guide.question, 12],
    [guide.title, 12],
    [guide.summary, 5],
    [guide.answer, 6],
    [guide.topics.join(' '), 7],
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
    const bodyOccurrences = Math.min(countOccurrences(guide.contentMarkdown, term), 3);
    if (bodyOccurrences) {
      score += bodyOccurrences * 1.25;
      termMatched = true;
    }
    if (termMatched) matchedTerms.add(term);
  }

  const jurisdictions = inferredJurisdictions ?? jurisdictionsForSearch(options);
  const inferredEra = options.era ?? detectEra(options.query);
  const inferredPropertyType = options.propertyType ?? detectPropertyType(options.query);

  if (jurisdictions.length > 0) {
    if (jurisdictions.some((jurisdiction) => guide.jurisdiction.includes(jurisdiction))) score += 18;
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
// Keyword scoring always produces a best-ranked guide, even when the corpus
// does not answer the question. Absolute and relative floors therefore remove
// unambiguous noise before a caller can mistake a lexical neighbour for an
// answer. These are corpus-calibrated values, not universal constants.
//
// The enriched corpus changes the ranking problem: long guides legitimately
// mention many adjacent concepts. After enrichment, question/title/topic fields carry
// more authority and repeated body occurrences saturate after three hits per
// term. RELATIVE_FLOOR still trims the low-scoring tail so one strong guide is
// not diluted by padding. Re-run the benchmark after any material corpus or
// scoring change.
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

// Strong retrieval is allowed only when the query contains credible evidence
// that the user is actually asking about an Australian residential-property
// topic. Keyword overlap alone is not enough: terms such as `strata`, `unit`,
// `settlement`, `auction`, `mould`, `Section 32` and `Form 2` all have valid
// meanings outside Homechecker's corpus. The gate is intentionally conservative
// and affects confidence only; ambiguous queries can still return weak/background
// results for a caller to inspect.
const DOMAIN_EVIDENCE_THRESHOLD = 3;

const CLEAR_NON_PROPERTY_CONTEXT_PATTERNS: RegExp[] = [
  /\b(?:software|programming|javascript|typescript|python|browser|chrome|unit test|design pattern|gis|dataset)\b/i,
  /\b(?:copyright|patent|trademark|intellectual property|corporations act|privacy act|criminal law|company law|business law|procurement|banking|securities|portfolio theory)\b/i,
  /\b(?:medical|medicine|hospital|clinical|workout|fitness|exercise|cheese|recipe)\b/i,
  /\b(?:agriculture|crop|geology|mathematics|maths)\b/i,
  /\b(?:music|theatre|movie|film|set design|stage scenery|stage set|advertising|ebay|tailoring|submarine|aircraft|airplane|vehicle|car)\b/i,
  /\b(?:population|capital city)\b/i,
];

const DIRECT_RESIDENTIAL_PATTERNS: RegExp[] = [
  /\b(?:building and pest|building inspection|building inspector|property inspection|pre[- ]purchase inspection|property condition report|building biologist|owners corporation|heritage overlay|brick veneer|double brick)\b/i,
  /\bsection 32\b/i,
  /\b(?:wall cracks?|cracks? in (?:(?:the|my|a|this|that) )?(?:wall|ceiling|brickwork)|(?:diagonal|structural|cosmetic) cracks?|cracks?.{0,35}(?:door|doors|window|windows|movement|structural|cosmetic))\b/i,
  /\b(?:maintenance|upkeep)\b.{0,35}\b(?:repair|repairs|repair bills?|home|house|property|building)\b/i,
  /\b(?:repair|repairs|repair bills?)\b.{0,35}\b(?:maintenance|upkeep)\b/i,
  /\b(?:auction|bidding)\b.{0,35}\bdue diligence\b|\bdue diligence\b.{0,35}\b(?:auction|bidding)\b/i,
  /\bcooling[- ]?off\b.{0,35}\b(?:buy|buying|buyer|contract|property|home|house|apartment)\b|\b(?:buy|buying|buyer|contract|property|home|house|apartment)\b.{0,35}\bcooling[- ]?off\b/i,
  /\b(?:damp|mould|moisture|water ingress)\b.{0,35}\b(?:home|house|building|wall|window|ceiling|roof|bathroom|property)\b|\b(?:home|house|building|wall|window|ceiling|roof|bathroom|property)\b.{0,35}\b(?:damp|mould|moisture|water ingress)\b/i,
  /\b(?:insurance|insurer)\b.{0,35}\b(?:home|house|property|roof|damage|condition|building)\b|\b(?:home|house|property|roof|damage|condition|building)\b.{0,35}\b(?:insurance|insurer)\b/i,
  /\b(?:vendor|seller)\b.{0,30}\b(?:building|inspection) report\b|\b(?:building|inspection) report\b.{0,30}\b(?:vendor|seller|rely|reliance)\b/i,
  /\b(?:strata|body corporate|common property|owners corporation)\b.{0,35}\b(?:apartment|unit|lot|levy|levies|minutes|records|building|buy|buying|owner)\b|\b(?:apartment|unit|lot|levy|levies|minutes|records|building|buy|buying|owner)\b.{0,35}\b(?:strata|body corporate|common property|owners corporation)\b/i,
  /\b(?:renovat\w*|extension|alteration)\b.{0,35}\b(?:home|house|property|building|planning|permit|approval)\b|\b(?:home|house|property|building|planning|permit|approval)\b.{0,35}\b(?:renovat\w*|extension|alteration)\b/i,
  /\b(?:storm|storms|flood|flooding|bushfire|extreme weather|severe weather)\b.{0,35}\b(?:home|house|property|building)\b|\b(?:home|house|property|building)\b.{0,35}\b(?:storm|storms|flood|flooding|bushfire|extreme weather|severe weather)\b/i,
  /\b(?:home|house|property)\b.{0,35}\b(?:records?|warranties|invoices|maintenance history)\b|\b(?:records?|warranties|invoices|maintenance history)\b.{0,35}\b(?:home|house|property)\b/i,
  /\b(?:home|house|property)\b.{0,35}\b(?:age|ages|aging|ageing|decade|decades)\b|\b(?:age|ages|aging|ageing|decade|decades)\b.{0,35}\b(?:home|house|property)\b/i,
];

/**
 * Coarse query-level evidence that the request belongs to Homechecker's domain.
 * This is deliberately separate from guide ranking: it prevents one overloaded
 * corpus keyword from manufacturing confidence without blocking weak/background
 * retrieval. It is not a general intent classifier.
 */
export function residentialDomainEvidence(query: string): number {
  const q = normalize(query);
  if (!q) return 0;

  const hasResidentialNoun = /\b(?:home|house|property|apartment|townhouse|dwelling|villa|residential|real estate)\b/.test(q);
  const hasTransaction = /\b(?:buy|buying|buyer|purchase|purchasing|seller|selling|sale|offer|auction|bid|bidding|contract|settlement|cooling off|due diligence)\b/.test(q);
  const hasCondition = /\b(?:inspect|inspection|condition|defect|defects|crack|cracks|cracking|damp|moisture|mould|condensation|rainwater|ingress|roof|wall|foundation|wiring|plumbing|cladding|weatherboard|brick|maintenance|upkeep|renovation|extension|alteration|insurance|insurer|records|repairs|pest|asbestos|storm|storms|flood|flooding|bushfire)\b/.test(q);
  const hasSharedBuilding = /\b(?:strata|body corporate|common property|levy|levies|owners corporation)\b/.test(q);
  const hasDocumentCue = /\b(?:section 32|vendor statement|seller disclosure|form 2|contract for sale|sale contract|disclosure statement|disclosure requirements?)\b/.test(q);
  const hasJurisdiction = mentionedJurisdictions(query).length > 0;
  const direct = DIRECT_RESIDENTIAL_PATTERNS.some((pattern) => pattern.test(query));

  // Explicitly non-property subject matter wins over a single overloaded cue.
  // A genuinely residential query that also mentions software/finance/etc can
  // still pass when it contains multiple independent property signals.
  const nonPropertyContext = CLEAR_NON_PROPERTY_CONTEXT_PATTERNS.some((pattern) => pattern.test(query));

  let score = direct ? 4 : 0;
  if (hasResidentialNoun) score += 1.5;
  if (hasTransaction) score += 1.2;
  if (hasCondition) score += 1.2;
  if (hasSharedBuilding) score += 1.2;
  if (hasDocumentCue) score += 1.2;
  if (hasJurisdiction) score += 0.4;

  if (hasResidentialNoun && (hasTransaction || hasCondition || hasSharedBuilding || hasDocumentCue)) score += 1.5;
  if (hasTransaction && (hasCondition || hasSharedBuilding || hasDocumentCue)) score += 0.8;
  if (hasCondition && hasSharedBuilding) score += 0.8;
  if (detectEra(query) !== undefined && hasResidentialNoun) score += 2;
  if (/\bcooling[- ]?off\b/.test(q) && hasJurisdiction) score += 2;
  if (detectConstructionYear(query) !== undefined && hasResidentialNoun) score += 1.5;

  if (nonPropertyContext && !(hasResidentialNoun && (hasTransaction || hasCondition || hasSharedBuilding) && score >= 5)) return 0;
  return Math.round(score * 10) / 10;
}

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
 * Confidence is deliberately layered. Explicit outside-scope outcomes and
 * weak residential-domain evidence always win first. A construction-era match
 * or an authoritative synonym match in the top guide's question/title/topics
 * can then recover confidence for clear paraphrases without relying on body
 * density alone. Everything else falls back to relevance-per-term.
 */
// Pure financing and investment-tax requests have no answer in this corpus.
// Keep this independent of lexical scores: new editorial examples can otherwise
// lift incidental words such as "much" or "investment" above the result floor.
const FINANCIAL_ADVICE_PATTERN = /\b(?:capital gains(?: tax)?|cgt|negative gearing|mortgages?|home loans?|refinanc\w*|borrowing capacity|interest rates?|rental yields?|rental income|investment returns?)\b/i;

function isFinanceOnlyQuery(query: string): boolean {
  const q = normalize(query);
  if (!FINANCIAL_ADVICE_PATTERN.test(q)) return false;

  // A building/document topic can still supply useful background for a mixed
  // request. A place, construction year, sale or residential noun alone cannot.
  // Stamp duty and valuations retain the existing weak/background policy.
  const hasGuideTopic = /\b(?:inspect\w*|building and pest|building biologist|condition|defects?|cracks?|cracking|damp|moisture|mould|water ingress|roof\w*|walls?|foundations?|wiring|plumbing|cladding|weatherboard|brick|maintenance|upkeep|renovat\w*|extension|alteration|insurance|insurer\w*|records?|warranties|invoices|repairs?|pest|asbestos|storm\w*|flood\w*|bushfire|strata|body corporate|owners corporation|section 32|vendor statement|seller disclosure|form 2|contract review|contract for sale|cooling off|due diligence|heritage overlay)\b/.test(q);
  return !hasGuideTopic;
}

const OUTSIDE_ANSWERABLE_SCOPE_PATTERNS: RegExp[] = [
  // Financial, tax, valuation and investment outcomes. Homechecker may have
  // relevant building context, but it is not the authority for the outcome.
  FINANCIAL_ADVICE_PATTERN,
  /\b(?:stamp duty|market rent|property value|market value|valuation|capital growth)\b/i,
  /\b(?:how much tax|tax treatment|tax deduction|tax deductible|claim .{0,30} on tax|claim .{0,30} as a deduction)\b/i,
  /\b(?:how much rent|rent (?:can|could|should) i charge)\b/i,
  /\b(?:house|home|property|apartment|unit)\b.{0,20}\bworth\b/i,
  /\b(?:average|median|mean)\s+(?:house|home|property|apartment|unit)\s+(?:price|prices|value|values)\b/i,
  /\b(?:house|home|property|apartment|unit)\s+(?:price|prices|value|values)\b/i,

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

function hasStrongTopicalMatch(query: string, results: GuideSearchResult[]): boolean {
  const top = results[0];
  if (!top) return false;

  const q = normalize(query);
  const authority = normalize([top.title, top.question, top.summary, top.topics.join(' ')].join(' '));
  return SYNONYM_GROUPS.some((group) =>
    group.some((phrase) => q.includes(normalize(phrase))) &&
    group.some((phrase) => authority.includes(normalize(phrase))),
  );
}

function hasStrongStructuredMatch(query: string, results: GuideSearchResult[]): boolean {
  const top = results[0];
  if (!top) return false;

  // Explicit residential construction-era language is a useful structured
  // signal, but it must not override confidence for a different outcome merely
  // because a query contains an era word. Price/market/finance questions are
  // outside this corpus even when they mention a modern or 1970s house.
  const q = normalize(query);
  if (/\b(?:price|prices|value|values|market|mortgage|loan|rent|rental|yield|portfolio|tax|interest rate|capital growth|investment return)\b/.test(q)) {
    return false;
  }

  const era = detectEra(query);
  return Boolean(era && metadataMatches(top.eras, era));
}

export function isWeakMatch(query: string, results: GuideSearchResult[]): boolean {
  if (results.length === 0) return false;
  if (isOutsideAnswerableScope(query)) return true;
  if (residentialDomainEvidence(query) < DOMAIN_EVIDENCE_THRESHOLD) return true;
  if (hasStrongStructuredMatch(query, results) || hasStrongTopicalMatch(query, results)) return false;
  return relevanceDensity(query, results) < WEAK_RELEVANCE_PER_TERM;
}

export function searchGuides(options: SearchOptions): GuideSearchResult[] {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
  const query = options.query.trim();
  if (!query) return [];
  if (isFinanceOnlyQuery(query)) return [];
  const terms = expandedTerms(query);
  const jurisdictions = jurisdictionsForSearch(options);
  const { jurisdiction: _requestedJurisdiction, ...optionsWithoutJurisdiction } = options;
  const normalizedOptions: SearchOptions = jurisdictions.length === 1
    ? { ...optionsWithoutJurisdiction, jurisdiction: jurisdictions[0]! }
    : optionsWithoutJurisdiction;

  const candidates = guides.filter((guide) => {
    if (!(options.includePillar ?? false) && guide.pillar) return false;
    if (options.cluster && guide.cluster?.id !== options.cluster) return false;
    if (jurisdictions.length > 0 && !(
      guide.jurisdiction.includes('Australia') ||
      jurisdictions.some((jurisdiction) => guide.jurisdiction.includes(jurisdiction))
    )) return false;
    return true;
  });

  const ranked = candidates
    .map((guide) => {
      const { score, matchedTerms } = scoreGuide(guide, normalizedOptions, terms, jurisdictions);
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

function isChecklistCandidateUsable(candidate: GuideRecord['checklistCandidates'][number]): boolean {
  const section = normalize(candidate.section);
  const text = normalize(candidate.text);

  // Provider/example rows are evidence supporting the editorial guide, not
  // buyer actions. Turning them into imperatives creates nonsense such as
  // "Check Sydney: CSI combined building and pest price...". Keep the
  // underlying guide available, but do not promote those rows into tasks.
  if (/\bprovider (?:fee )?examples?\b/.test(section)) return false;
  if (/\bnamed provider examples?\b/.test(section)) return false;
  if (/^(?:sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra)\b/.test(text) && /\b(?:price|fee|checked|gst)\b/.test(text)) return false;

  return true;
}

function hasAuctionIntent(profile: ChecklistProfile): boolean {
  const text = normalize([profile.buyingStage, ...(profile.concerns ?? [])].filter(Boolean).join(' '));
  return /\b(?:auction|bid|bidding)\b/.test(text);
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
  let matched = searchGuides(searchOptions);

  // A checklist is a planning surface rather than a pure search result. If the
  // buyer explicitly says auction/bid, preserve at least one auction-specific
  // source even when dense era/condition guides would otherwise fill all six
  // retrieval slots.
  if (hasAuctionIntent(profile) && !matched.some((result) => result.topics.some((topic) => /\bauction\b/i.test(topic)))) {
    const auctionMatch = searchGuides({
      query: 'auction due diligence before bidding at auction',
      limit: 3,
      ...(profile.jurisdiction ? { jurisdiction: profile.jurisdiction } : {}),
    }).find((result) => result.topics.some((topic) => /\bauction\b/i.test(topic)));
    if (auctionMatch) matched = [...matched.slice(0, 5), auctionMatch];
  }

  const terms = expandedTerms(query);
  const items: Array<BuyerChecklistItem & { score: number }> = [];

  for (const result of matched) {
    const guide = getGuide(result.slug);
    if (!guide) continue;
    const candidates = guide.checklistCandidates
      .filter(isChecklistCandidateUsable)
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
    wordCount: guide.wordCount,
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
