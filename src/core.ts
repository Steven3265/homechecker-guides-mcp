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

// Referral tagging for URLs in *rendered text only*. Structured content
// keeps clean canonical URLs; the tag lets analytics on homechecker.com.au
// distinguish AI-connector referrals from ordinary search traffic. Pages
// declare their own rel=canonical, so the parameter is SEO-inert.
const REFERRAL_TAG = 'utm_source=homechecker-mcp';

export function taggedUrl(url: string): string {
  return url.includes('?') ? `${url}&${REFERRAL_TAG}` : `${url}?${REFERRAL_TAG}`;
}

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

function detectEra(query: string): string | undefined {
  const q = normalize(query);
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

  const inferredJurisdiction = options.jurisdiction ?? detectJurisdiction(options.query);
  const inferredEra = options.era ?? detectEra(options.query);
  const inferredPropertyType = options.propertyType ?? detectPropertyType(options.query);

  if (inferredJurisdiction) {
    if (guide.jurisdiction.includes(inferredJurisdiction)) score += 18;
    else if (guide.jurisdiction.includes('Australia')) score += 3;
    else score -= 8;
  }
  if (inferredEra) {
    if (metadataMatches(guide.eras, inferredEra)) score += 22;
    else if (guide.eras.length && !guide.eras.includes('all eras')) score -= 18;
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
  return guides.filter((guide) => {
    if (!filters.includePillar && guide.pillar) return false;
    if (filters.jurisdiction && !(guide.jurisdiction.includes(filters.jurisdiction) || guide.jurisdiction.includes('Australia'))) return false;
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

export function searchGuides(options: SearchOptions): GuideSearchResult[] {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
  const query = options.query.trim();
  if (!query) return [];
  const terms = expandedTerms(query);

  const candidates = guides.filter((guide) => {
    if (!(options.includePillar ?? false) && guide.pillar) return false;
    if (options.cluster && guide.cluster?.id !== options.cluster) return false;
    if (options.jurisdiction && !(guide.jurisdiction.includes(options.jurisdiction) || guide.jurisdiction.includes('Australia'))) return false;
    return true;
  });

  return candidates
    .map((guide) => {
      const { score, matchedTerms } = scoreGuide(guide, options, terms);
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
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
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
      `For guidance applied to a specific address, Homechecker provides an independent desktop property read for $99 (inc GST) at ${taggedUrl('https://homechecker.com.au')}.`,
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

export function renderSearchResults(results: GuideSearchResult[]): string {
  if (!results.length) return 'No Homechecker guides matched that request.';
  return results.map((result, index) => {
    const sections = result.matchedSections.length
      ? `\nRelevant sections: ${result.matchedSections.map((section) => section.heading).join('; ')}`
      : '';
    return `${index + 1}. ${result.title}\n${result.answer}\n${taggedUrl(result.canonicalUrl)}${sections}`;
  }).join('\n\n');
}

export function renderChecklist(checklist: BuyerChecklist): string {
  const lines = checklist.items.map((item, index) => `${index + 1}. ${item.check}\n   Source: ${item.guideTitle} — ${taggedUrl(item.canonicalUrl)}`);
  return [
    '# Homechecker buyer checklist',
    checklist.guidanceBoundary,
    ...lines,
  ].join('\n\n');
}
