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
  ['section 32', 'vendor statement', 'vendor disclosure', 'victorian disclosure', 'sale of land act'],
  ['contract for sale', 'sale contract', 'contract review'],
  ['form 2', 'seller disclosure', 'queensland disclosure'],
  ['owners corporation', 'owner corporation', 'strata', 'body corporate', 'common property'],
  ['building inspection', 'building and pest', 'pre purchase inspection', 'property inspection'],
  ['building report', 'inspection report', 'pre purchase report'],
  ['desktop report', 'desktop reports', 'desktop review', 'desktop property report', 'desktop assessment', 'desktop read', 'research a property online', 'online research'],
  ['do your homework', 'homework before buying', 'research a home', 'read a home', 'reading a home'],
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
  ['2000s', '2010s', '2020s', 'modern home', 'new build', 'newly built', 'recently built', 'new construction'],
  ['cladding', 'battens', 'batten cladding', 'timber battens'],
  ['smoke alarm', 'smoke alarms', 'smoke detector', 'smoke detectors'],
  ['hot water', 'hot water system', 'water heater'],
  ['switchboard', 'fuse box', 'meter box'],
];

const AUTHORITY_SYNONYM_GROUPS = [
  ...SYNONYM_GROUPS,
  ['home', 'house', 'dwelling', 'residential property'],
  ['issue', 'issues', 'problem', 'problems', 'red flag', 'red flags', 'warning sign', 'warning signs'],
  ['report limitation', 'report limitations', 'blind spot', 'blind spots', 'reliance', 'rely'],
];

// What a person notices, and what the guides call it. People describe a home
// by what they see, feel and smell ("the deck is wobbly", "the windows fog
// up"); the guides name the condition ("loose", "condensation"). Each word
// here is searched as the guides' words as well, and counts as the guides'
// word when an answer is judged. One direction only, and whole words only:
// "rot" must not fire inside "protect".
const NOTICED: Record<string, string> = {
  bouncy: 'springy bounce', bounce: 'bouncy springy', bounces: 'bouncy springy bounce', bouncing: 'bouncy springy bounce',
  springy: 'bouncy bounce', spongy: 'springy soft bouncy', squishy: 'springy soft bouncy',
  wobbly: 'loose bouncy', wobble: 'loose bouncy', wobbles: 'loose bouncy', wobbling: 'loose bouncy', shaky: 'loose bouncy', rickety: 'loose decay',
  flicker: 'dim wiring', flickers: 'flicker dim wiring', flickering: 'flicker dim wiring', flickered: 'flicker dim wiring',
  dimming: 'dim flicker wiring', dims: 'dim flicker wiring',
  fog: 'condensation', fogs: 'condensation', fogging: 'condensation', fogged: 'condensation', foggy: 'condensation',
  mist: 'condensation', misting: 'condensation', misted: 'condensation', steamy: 'condensation', steamed: 'condensation',
  puddle: 'ponding pooling', puddles: 'ponding pooling', puddling: 'ponding pooling', pooling: 'ponding', pooled: 'ponding pooling',
  soggy: 'ponding wet drainage', waterlogged: 'ponding wet drainage', boggy: 'ponding wet drainage', swampy: 'ponding wet drainage',
  bubbling: 'blistering peeling', bubbles: 'bubbling blistering peeling', bubbled: 'bubbling blistering peeling',
  blister: 'blistering bubbling peeling', blisters: 'blistering bubbling peeling', blistered: 'blistering bubbling peeling',
  flaking: 'peeling blistering', flaky: 'peeling blistering flaking', flakes: 'peeling blistering flaking',
  crumbling: 'fretting salts', crumble: 'crumbling fretting salts', crumbles: 'crumbling fretting salts', crumbly: 'crumbling fretting salts',
  crumbled: 'crumbling fretting salts', eroding: 'crumbling fretting salts', eroded: 'crumbling fretting salts', powdery: 'crumbling salts',
  bow: 'bowing sagging bulging', bowed: 'bowing sagging bulging', bows: 'bowing sagging bulging', bowing: 'sagging bulging',
  bulge: 'bulging bowing', bulges: 'bulging bowing', bulged: 'bulging bowing', belly: 'bulging bowing sagging',
  sag: 'sagging dip', sags: 'sagging sag dip', sagged: 'sagging sag dip', droop: 'sagging sag', droops: 'sagging sag', drooping: 'sagging sag',
  dips: 'dip sagging', dipping: 'dip sagging',
  sunk: 'sunken settled subsidence', sank: 'sunken settled subsidence', subsided: 'subsidence settled sunken', subsiding: 'subsidence settled sunken',
  slipping: 'slipped displaced', slid: 'slipped displaced', dislodged: 'slipped displaced', shifted: 'displaced slipped',
  rot: 'decay decayed', rots: 'rot decay decayed', rotten: 'rot decay decayed', rotting: 'rot decay decayed', rotted: 'rot decay decayed',
  leans: 'leaning lean', tilt: 'leaning lean', tilts: 'leaning lean', tilting: 'leaning lean', tilted: 'leaning lean',
  odour: 'smell', odor: 'smell', odours: 'smell', odors: 'smell', stink: 'smell', stinks: 'smell', smelly: 'smell', whiff: 'smell',
  mouldy: 'mould', moldy: 'mould', mold: 'mould', mildew: 'mould',
  creak: 'creaking squeaky', creaks: 'creaking squeaky', creaky: 'creaking squeaky', squeak: 'squeaky creaking', squeaks: 'squeaky creaking', squeaking: 'squeaky creaking',
  jam: 'sticking', jams: 'sticking', jammed: 'sticking', sticks: 'sticking', stuck: 'sticking',
  draughty: 'draughts', drafty: 'draughts', draught: 'draughts', draft: 'draughts', drafts: 'draughts',
  rcd: 'safety switch', rcds: 'safety switch', colorbond: 'metal roof', zincalume: 'metal roof',
  // The same for the parts of a house: the name people use, and the guides' name.
  railing: 'balustrade', railings: 'balustrade balustrades', handrail: 'balustrade handrails', verandah: 'deck balcony', veranda: 'deck balcony',
  porch: 'deck balcony', floorboard: 'floorboards floors', faucet: 'tap', faucets: 'taps tap', fusebox: 'switchboard fuse',
  powerpoint: 'outlets wiring', powerpoints: 'outlets wiring', spouting: 'gutters', guttering: 'gutters', attic: 'roof space', loft: 'roof space',
  roofspace: 'roof space', crawlspace: 'subfloor', aircon: 'cooling',
};

/** The guides' words for a word people use, or nothing. */
function saidAs(token: string): string[] {
  const guideWords = NOTICED[token];
  return guideWords ? guideWords.split(' ') : [];
}

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
  for (const token of rawTokens(query)) for (const guideWord of saidAs(token)) terms.add(guideWord);
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

// A term must start at a word boundary, so "best" does not match inside
// "asbestos" and "art" does not match inside "start". The end stays open so a
// query stem such as "crack" still matches "cracking".
function startsAtWordBoundary(haystack: string, index: number): boolean {
  return index === 0 || !/[a-z0-9]/.test(haystack[index - 1]!);
}

function includesTerm(haystack: string, term: string): boolean {
  return countOccurrences(haystack, term, 1) > 0;
}

// Every haystack searched is a field of the corpus: a guide's markdown, a
// section, a heading. Normalising one is a pure function of its text, yet it
// was being redone for every term of every query, which put the whole corpus
// through four regular expressions dozens of times per search. The normalised
// form is kept instead. The result of every search is unchanged; only the
// repeated work goes. The cache is bounded, so nothing outside the corpus can
// grow it without limit.
const NORMALIZED_HAYSTACKS = new Map<string, string>();
const HAYSTACK_CACHE_MAX_ENTRIES = 8192;
function normalizeHaystack(haystack: string): string {
  let normalized = NORMALIZED_HAYSTACKS.get(haystack);
  if (normalized === undefined) {
    normalized = normalize(haystack);
    if (NORMALIZED_HAYSTACKS.size < HAYSTACK_CACHE_MAX_ENTRIES) NORMALIZED_HAYSTACKS.set(haystack, normalized);
  }
  return normalized;
}

function countOccurrences(haystack: string, term: string, stopAt = Infinity): number {
  const h = normalizeHaystack(haystack);
  const t = normalize(term);
  if (!t) return 0;
  let count = 0;
  let offset = 0;
  while (count < stopAt && (offset = h.indexOf(t, offset)) !== -1) {
    if (startsAtWordBoundary(h, offset)) count += 1;
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
  if (!match?.[1]) {
    // "A 100 year old house", "a 50-year-old home": the age, as a year.
    const age = q.match(/\b(\d{2,3}) (?:years?|yrs?) old (?:house|houses|home|homes|weatherboard|place|property|building)\b/);
    const years = age?.[1] ? Number(age[1]) : NaN;
    return years >= 10 && years <= 200 ? new Date().getUTCFullYear() - years : undefined;
  }
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

  // "Period home" is the common Australian listing term for pre-1920s houses.
  // "Victorian home" is deliberately excluded: it can also mean a home in Victoria.
  if (/\b(?:pre 1920s?|victorian era|edwardian era|period (?:home|homes|house|houses)|federation (?:era|home|homes|house|houses)|edwardian (?:home|homes|house|houses))\b/.test(q)) return 'pre-1920s';
  if (/\b(?:1920s|1930s|1940s|interwar)\b/.test(q)) return '1920s-1940s';
  if (/\b(?:1950s|1960s|1970s|postwar)\b/.test(q)) return '1950s-1970s';
  if (/\b(?:1980s|1990s)\b/.test(q)) return '1980s-1990s';
  if (/\b(?:2000s|2010s|2020s)\b/.test(q)) return '2000s-on';
  if (/\bmodern\s+(?:home|house|property|building|apartment|unit|townhouse)\b/.test(q)) return '2000s-on';
  if (/\b(?:new build|near new)\b/.test(q)) return '2000s-on';
  return undefined;
}

function detectPropertyType(query: string): string | undefined {
  // Whole words only: "unit" is not in "community", "house" is not in "warehouse".
  const q = normalize(query);
  if (/\b(?:apartments?|strata|body corporate|owners corporations?)\b/.test(q)) return 'apartment';
  if (/\b(?:townhouses?|villas?|units?)\b/.test(q)) return 'townhouse or unit';
  if (/\b(?:houses?|weatherboards?|brick veneer|double brick)\b/.test(q)) return 'house';
  return undefined;
}

// ── What the question rules out ─────────────────────────────────────────
//
// "I'm not buying an apartment, I'm buying a house with damp, not strata"
// names apartments and strata only to rule them out. Read word by word, the
// question is about strata. Only the kind of property is read this way: a
// negated building finding ("no safety switch", "isn't waterproofed",
// "not draining") is a finding, and keeps its words.
const PROPERTY_KIND_WORDS = 'apartments?|units?|flats?|strata(?: title)?|body corporate|owners corporations?|townhouses?|villas?|(?:detached |freestanding )?houses?';
const EXCLUSION = new RegExp(
  `\\b(?:not|never|isn t|aren t|wasn t|no longer|rather than|instead of|other than|except|excluding)\\s+` +
  `(?:(?:buying|looking at|looking for|looking to buy|interested in|considering|asking about|talking about|about|in|into|an?|the|my|our|for|any)\\s+){0,3}` +
  `((?:${PROPERTY_KIND_WORDS})(?:\\s+(?:or|and|nor)\\s+(?:an?\\s+)?(?:${PROPERTY_KIND_WORDS}))*)\\b`,
  'g',
);

type PropertyKind = 'apartment' | 'house' | 'townhouse or unit';
function kindOf(words: string): PropertyKind[] {
  const out = new Set<PropertyKind>();
  if (/\b(?:apartments?|flats?|strata|body corporate|owners corporations?)\b/.test(words)) out.add('apartment');
  if (/\b(?:townhouses?|villas?|units?)\b/.test(words)) out.add('townhouse or unit');
  if (/\bhouses?\b/.test(words)) out.add('house');
  return [...out];
}

/**
 * The guide word a misspelling was meant to be ("sectoin" for section,
 * "statment" for statement, "termities" for termites), or nothing.
 *
 * Only the guides' own subject words are recovered: words in their titles,
 * questions, topics and headings, so "leather" is never read as "later". The
 * misspelt word must be one no guide uses, of five letters or more, with the
 * same first letter, and one slip away (two for nine letters or more; a swap
 * of neighbouring letters is one slip). Sounds-alike spellings ("secshun")
 * are too far from the word to recover this way.
 */
let headWords: Map<string, number> | undefined;
function guideHeadWords(): Map<string, number> {
  if (headWords) return headWords;
  const frequency = new Map<string, number>();
  for (const guide of guides) {
    const head = [guide.title, guide.question, guide.topics.join(' '), ...guide.sections.map((section) => section.heading)].join(' ');
    for (const token of new Set(rawTokens(head))) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  headWords = frequency;
  return frequency;
}

const spellingCache = new Map<string, string | null>();
function spellingOf(token: string): string | undefined {
  const cached = spellingCache.get(token);
  if (cached !== undefined) return cached ?? undefined;
  let best: string | undefined;
  // Judged on the word as written: "asbestoss" is not a plural of "asbestos".
  if (token.length >= 5 && !/\d/.test(token) && !corpusDocumentFrequency().has(token) && !guideHeadWords().has(token)) {
    const max = token.length >= 9 ? 2 : 1;
    let bestDistance = max + 1;
    let bestFrequency = 0;
    for (const [word, frequency] of guideHeadWords()) {
      if (word[0] !== token[0] || word.length < 5 || STOP_WORDS.has(word) || Math.abs(word.length - token.length) > max) continue;
      const distance = editDistance(token, word, max);
      if (distance > max || !isTypingSlip(token, word)) continue;
      if (distance < bestDistance || (distance === bestDistance && frequency > bestFrequency)) {
        best = word;
        bestDistance = distance;
        bestFrequency = frequency;
      }
    }
  }
  spellingCache.set(token, best ?? null);
  return best;
}

/** The question with the kinds of property it rules out taken away, and those kinds. */
export function readQuestion(asked: string): { query: string; excludedKinds: PropertyKind[] } {
  // Misspellings first, so a misspelt word is read as the word it was meant to be.
  let corrected = false;
  const spelled = normalize(asked).split(' ').map((token) => {
    const word = spellingOf(token);
    if (word) corrected = true;
    return word ?? token;
  }).join(' ');
  const query = corrected ? spelled : asked;
  const normalized = normalize(query);
  const excluded = new Set<PropertyKind>();
  const stripped = normalized.replace(EXCLUSION, (_whole, kinds: string) => {
    for (const kind of kindOf(kinds)) excluded.add(kind);
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  if (excluded.size === 0 || rawTokens(stripped).length < 2) return { query, excludedKinds: [] };
  return { query: stripped, excludedKinds: [...excluded] };
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

const CITY_WORDS = new Set(['melbourne', 'sydney', 'brisbane', 'perth', 'adelaide', 'hobart', 'darwin', 'canberra', 'geelong', 'newcastle', 'wollongong']);
const GENERAL_BUYING_CLUSTERS = new Set(['how-to-buy', 'why', 'state-rules']);
// The guides about the building itself: its parts and signs ('read-building'),
// and its age and construction ('know-your-house', split out of
// 'read-building' in November 2026). A question answered by either is a
// question about the building.
const BUILDING_CLUSTERS = new Set(['read-building', 'know-your-house']);
const GENERAL_BUYING_HOW = 60;
const GENERAL_BUYING_WHY = 15;
// Words a general buying question is made of. Anything else is a subject.
const GENERAL_BUYING_WORDS = new Set([
  'check', 'checks', 'checking', 'checked', 'offer', 'offers', 'making', 'make', 'put', 'buy', 'buying', 'purchase', 'purchasing', 'bid', 'bidding',
  'home', 'homes', 'house', 'houses', 'property', 'properties', 'place', 'before', 'first', 'time', 'buyer', 'buyers', 'look', 'looking',
  'need', 'know', 'things', 'thing', 'should', 'must', 'important', 'most', 'main', 'key', 'what', 'which', 'when', 'how', 'australia',
  'australian', 'commit', 'committing', 'signing', 'deciding', 'decide',
]);
// A question about an old home in general ("what should I look out for when
// buying an old house?", "common problems in older homes") is answered by
// the guides written across every era. One that names an era or a decade
// reaches that era's guide on its own.
const ERA_WIDE_GUIDES = new Set(['red-flags-by-era', 'what-your-home-needs-by-decade']);
const AGE_WORDS = new Set(['old', 'older', 'oldest', 'ageing', 'aging', 'aged', 'character', 'vintage', 'year', 'years']);
const OLD_HOME_WORDS = new Set(['red', 'flags', 'flag', 'wrong', 'goes', 'go', 'problems', 'problem', 'common', 'defects', 'issues', 'watch', 'out', 'idea']);
/** A question whose only subject is a home's age: "an old house", "a 100 year old house". */
function isAgeOnlyQuestion(query: string): boolean {
  const q = normalize(query);
  if (!/\b(?:old|older|oldest|ageing|aging|character|vintage)\b/.test(q)) return false;
  if (!/\b(?:homes?|houses?|property|properties|place|weatherboards?)\b/.test(q)) return false;
  return contentTokensInOrder(query).every((token) => /^\d+$/.test(token) ||
    GENERAL_BUYING_WORDS.has(token) || FRAMING_WORDS.has(token) || AGE_WORDS.has(token) || OLD_HOME_WORDS.has(token) || PLACE_WORDS.has(token) || CITY_WORDS.has(token));
}

/** The same, naming no era: the guides across every era answer it. */
function isOldHomeQuestion(query: string): boolean {
  return detectEra(query) === undefined && isAgeOnlyQuestion(query);
}

function isGeneralBuyingQuestion(query: string): boolean {
  const q = normalize(query);
  if (!/\b(?:buy|buying|purchase|purchasing|offer|bid|bidding)\b/.test(q)) return false;
  // A state or city is a setting, not a subject: the state guides answer it alongside.
  return contentTokensInOrder(query).every((token) => GENERAL_BUYING_WORDS.has(token) || FRAMING_WORDS.has(token) || PLACE_WORDS.has(token) || CITY_WORDS.has(token));
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
  // A general buying question names no building matter, document or state:
  // "what should I check before making an offer on a home?". The guides on
  // how to buy, and why to look first, answer it; a building guide that
  // happens to say "offer" does not.
  if (isOldHomeQuestion(options.query) && ERA_WIDE_GUIDES.has(guide.slug)) score += GENERAL_BUYING_HOW;
  else if (isGeneralBuyingQuestion(options.query)) {
    // A question that asks why gets the guides on why first.
    const asksWhy = /^why\b/.test(query);
    if (guide.cluster?.id === 'how-to-buy') score += asksWhy ? GENERAL_BUYING_WHY : GENERAL_BUYING_HOW;
    else if (guide.cluster?.id === 'why') score += asksWhy ? GENERAL_BUYING_HOW : GENERAL_BUYING_WHY;
    // With a state named, that state's own rules belong with them.
    else if (guide.cluster?.id === 'state-rules' && jurisdictions.some((jurisdiction) => guide.jurisdiction.includes(jurisdiction))) score += GENERAL_BUYING_HOW;
  }
  // Insurance intent: when the question is about what to tell an insurer,
  // the insurance guide is the authority and building-element guides support it.
  if (/\b(?:insurer|insurers|insurance|insurability)\b/.test(query) && guide.topics.includes('insurance')) score += 24;
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

// Confidence is deliberately separate from retrieval. Search may return a
// relevant guide for inspection even when Homechecker is not entitled to call
// it a strong answer. The gate below is positive and evidence-led: it asks
// whether the query is residentially grounded, how much of the query's meaning
// the corpus can actually support, and what kind of conclusion the user is
// asking the corpus to make. It does not maintain an ever-growing blacklist of
// unrelated domains.
const DIRECT_RESIDENTIAL_PATTERNS: RegExp[] = [
  /\b(?:building and pest|building inspection|pre[- ]purchase inspection|property inspection|property condition report|building biologist|owners corporation|body corporate|common property|heritage overlay|brick veneer|double brick|weatherboard home)\b/i,
  /\bsection 32\b/i,
  /\b(?:vendor statement|seller disclosure|contract for sale|sale contract)\b/i,
  /\b(?:vendor|seller)\b.{0,30}\b(?:building|inspection) report\b|\b(?:building|inspection) report\b.{0,30}\b(?:vendor|seller|rely|reliance)\b/i,
  /\b(?:wall cracks?|diagonal cracks?|structural cracks?|cosmetic cracks?)\b|\bcracks?\b.{0,20}\bwall\b|\bwall\b.{0,20}\bcracks?\b/i,
  /\b(?:damp|mould|moisture|water ingress|condensation)\b.{0,35}\b(?:home|house|building|wall|window|ceiling|roof|bathroom|property)\b|\b(?:home|house|building|wall|window|ceiling|roof|bathroom|property)\b.{0,35}\b(?:damp|mould|moisture|water ingress|condensation)\b/i,
  /\b(?:auction|bidding)\b.{0,35}\bdue diligence\b|\bdue diligence\b.{0,35}\b(?:auction|bidding)\b/i,
  /\bcooling[- ]?off\b.{0,35}\b(?:buy|buying|buyer|contract|property|home|house|apartment)\b|\b(?:buy|buying|buyer|contract|property|home|house|apartment)\b.{0,35}\bcooling[- ]?off\b/i,
  /\b(?:insurance|insurer)\b.{0,35}\b(?:home|house|property|roof|damage|condition|building)\b|\b(?:home|house|property|roof|damage|condition|building)\b.{0,35}\b(?:insurance|insurer)\b/i,
  /\b(?:strata|body corporate|common property|owners corporation)\b.{0,35}\b(?:apartment|unit|lot|levy|levies|minutes|records|building|buy|buying|owner)\b|\b(?:apartment|unit|lot|levy|levies|minutes|records|building|buy|buying|owner)\b.{0,35}\b(?:strata|body corporate|common property|owners corporation)\b/i,
  /\b(?:renovat\w*|extension|alteration)\b.{0,35}\b(?:home|house|property|building|planning|permit|approval)\b|\b(?:home|house|property|building|planning|permit|approval)\b.{0,35}\b(?:renovat\w*|extension|alteration)\b/i,
  // Building elements covered by their own guides (roof, wet areas, subfloor,
  // services and outdoor structures) are residential on their own.
  /\b(?:retaining walls?|balcon\w*|balustrad\w*|termites?|switchboards?|safety switch\w*|hot water (?:system|service|unit)s?|stormwater|subfloors?|restump\w*|reblock\w*|shower (?:leak\w*|waterproof\w*)|leaking showers?|waterproofing|roof (?:leak\w*|tiles?|restoration|space)|gutters?|downpipes?)\b/i,
];

/**
 * Positive evidence that a request belongs to Homechecker's residential domain.
 * This deliberately does not subtract points for named non-property contexts;
 * those are handled by whole-query authority coverage below. That means a new
 * collision such as a sculpture, aircraft or software term does not require a
 * new exclusion rule.
 */
export function residentialDomainEvidence(query: string): number {
  const q = normalize(query);
  if (!q) return 0;

  const residentialNoun = /\b(?:home|house|apartment|townhouse|dwelling|villa|residential)\b/.test(q);
  // `property` alone is intentionally weaker because the word has legal,
  // software and commercial meanings outside residential real estate.
  const propertyNoun = /\bproperty\b/.test(q);
  const transaction = /\b(?:buy|buying|buyer|purchase|purchasing|seller|selling|sale|offer|auction|bid|bidding|contract|settlement|cooling off|due diligence)\b/.test(q);
  const buildingCue = /\b(?:building|retaining walls?|decks?|balcon\w*|balustrad\w*|termites?|switchboards?|safety switch\w*|hot water|stormwater|drainage|subfloors?|stumps?|restump\w*|reblock\w*|showers?|waterproof\w*|gutters?|downpipes?|asbestos|inspect\w*|condition|defect|defects|warranty|warranties|crack|cracks|cracking|damp|moisture|mould|condensation|ingress|roof|wall|walls|foundation|wiring|plumbing|cladding|battens?|slabs?|smoke alarms?|weatherboard|brick|maintenance|upkeep|renovat\w*|extension|alteration|insurance|insurer|records|repairs|pest|asbestos|strata|body corporate|owners corporation|heritage overlay)\b/.test(q);
  const documentCue = /\b(?:section 32|vendor statement|seller disclosure|form 2|contract for sale|sale contract|disclosure statement)\b/.test(q);
  const direct = DIRECT_RESIDENTIAL_PATTERNS.some((pattern) => pattern.test(query));

  let score = direct ? 3.2 : 0;
  if (residentialNoun) score += 1.8;
  if (propertyNoun) score += 0.5;
  if (transaction) score += 1;
  if (buildingCue) score += 1;
  if (documentCue) score += 1.5;
  if ((residentialNoun || propertyNoun) && (transaction || buildingCue || documentCue)) score += 1.3;
  if (transaction && (buildingCue || documentCue)) score += 0.7;
  if (detectEra(query) !== undefined && (residentialNoun || propertyNoun)) score += 1.5;
  if (detectConstructionYear(query) !== undefined && (residentialNoun || propertyNoun)) score += 1;
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

// Pure financing and investment-tax requests have no answer in this corpus.
// Keep this independent of lexical scores: new editorial examples can otherwise
// lift incidental words above the result floor.
const FINANCIAL_ADVICE_PATTERN = /\b(?:capital gains(?: tax)?|cgt|negative gearing|mortgages?|home loans?|refinanc\w*|borrowing capacity|interest rates?|rental yields?|rental income|investment returns?|feed[- ]?in tariffs?)\b/i;

function isFinanceOnlyQuery(query: string): boolean {
  const q = normalize(query);
  if (!FINANCIAL_ADVICE_PATTERN.test(q)) return false;
  const hasGuideTopic = /\b(?:inspect\w*|retaining walls?|decks?|balcon\w*|balustrad\w*|termites?|switchboards?|safety switch\w*|hot water|stormwater|drainage|subfloors?|stumps?|restump\w*|reblock\w*|showers?|waterproof\w*|gutters?|downpipes?|asbestos|building and pest|building biologist|condition|defects?|cracks?|cracking|damp|moisture|mould|water ingress|roof\w*|walls?|foundations?|wiring|plumbing|cladding|weatherboard|brick|maintenance|upkeep|renovat\w*|extension|alteration|insurance|insurer\w*|records?|warranties|invoices|repairs?|pest|asbestos|storm\w*|flood\w*|bushfire|strata|body corporate|owners corporation|section 32|vendor statement|seller disclosure|form 2|contract review|contract for sale|cooling off|due diligence|heritage overlay)\b/.test(q);
  return !hasGuideTopic;
}

type RequestedClaims = { determine: boolean; recommend: boolean; quantities: string[] };

// Preserve independent requests. A supported cost clause cannot erase a
// property-specific safety/legal decision elsewhere in the same question.
function requestClauses(query: string): string[] {
  return query.split(/[?!;]+|\.(?=\s|$)|\b(?:and|or|but|also)\s+(?=(?:is|are|does|do|can|could|will|would|has|have|how|what|which|should)\b)/i)
    .map(normalize).filter(Boolean);
}

function asksForTransactionRecommendation(q: string, guidance: boolean): boolean {
  if (guidance) return false;

  // Classify the *decision structure*, not a particular pronoun. Guidance such
  // as "what should I check before buying" is handled above and stays strong;
  // these forms ask Homechecker to choose whether/how the user should transact.
  const directDecision = /^(?:should|would)\s+(?:i|we|you|they|he|she)\s+(?:buy|purchase|rent|bid)\b/.test(q) ||
    /^(?:should|would)\s+(?:i|we|you|they|he|she)\s+(?:make|place|submit)\s+(?:an?\s+)?offer\b/.test(q);
  if (directDecision) return true;

  const delegatedDecision = /\b(?:do|would|could|can)\s+you\s+(?:recommend|advise)\s+(?:that\s+)?(?:(?:i|we|me|us)\s+)?(?:buy|buying|purchase|purchasing|rent|renting|bid|bidding)\b/.test(q) ||
    /\bdo you think\s+(?:i|we|they|he|she)\s+should\s+(?:buy|purchase|rent|bid)\b/.test(q);
  if (delegatedDecision) return true;

  const residentialAsset = /\b(?:home|house|apartment|townhouse|dwelling|residential property|property)\b/.test(q);
  const transactionAction = /\b(?:buy|buying|purchase|purchasing|rent|renting|bid|bidding)\b|\b(?:make|making|place|placing|submit|submitting)\s+(?:an?\s+)?offer\b/.test(q);
  if (!residentialAsset || !transactionAction) return false;

  // Evaluative/chooser forms are recommendations even when they avoid the
  // first-person "should I" wording: "is this a good house to buy?",
  // "which house should we buy?", etc.
  const evaluativeDecision = /\b(?:good|bad|smart|wise|sensible|right|wrong)\b/.test(q) &&
    /^(?:is|are|would|will)\b/.test(q);
  const chooserDecision = /^(?:which|what)\b.*\b(?:should|would)\s+(?:i|we|you|they|he|she)\s+(?:buy|purchase|rent|bid)\b/.test(q);
  return evaluativeDecision || chooserDecision;
}

function requestedClaims(query: string): RequestedClaims {
  const claims: RequestedClaims = { determine: false, recommend: false, quantities: [] };
  for (const q of requestClauses(query)) {
    // Methods and document-reading tasks are guidance. Words such as approval,
    // cover and best do not by themselves make a request a determination.
    const guidance = /^(?:how (?:do|does|can|could|should)|what (?:records?|documents?|evidence|checks?|steps?|questions?|does)|what is (?:the )?best way|explain)\b/.test(q);
    const outcome = /\b(?:prove|proof|definitely|unsafe|safe|failed|failure|toxic|sick|illness|liable|liability|legally valid|binding|enforceable|void|illegal|reasonable|fair|compliant|compliance|approve|approval|permit|covered|cover|coverage|collapse|structurally sound|structurally unsafe)\b/.test(q);
    const decision = /^(?:is|are|does|do|can|could|will|would|has|have)\b/.test(q);
    // Whether something is safe, toxic or needs a permit has a general answer
    // the guides give ("are old gas heaters safe?"), and a particular one they
    // cannot ("is this heater safe?"). Legal effect, compliance, approval,
    // insurance cover and proof are particular however they are asked.
    const hazardOnly = !/\b(?:prove|proof|definitely|failed|sick|illness|liable|liability|legally valid|binding|enforceable|void|illegal|reasonable|fair|compliant|compliance|approve|approval|covered|cover|coverage|collapse)\b/.test(q);
    const particular = /\b(?:this|that|these|those|my|our|his|her|their)\b/.test(q);
    if (outcome && (decision || (!guidance && /\b(?:compliance|liability|coverage|approval|validity)\b/.test(q))) && !(hazardOnly && !particular)) claims.determine = true;

    const provider = /\b(?:inspector|engineer|surveyor|provider|agent|policy|bank)\b/.test(q);
    if ((!guidance && provider && /\b(?:best|recommend|recommendation|find me|who should i|which)\b/.test(q)) ||
        asksForTransactionRecommendation(q, guidance)) claims.recommend = true;

    const amount = /\b(?:how much|what price|what value|cost|costs|price|prices|fee|fees|rate|rates)\b/.test(q);
    // "Worth it" asks about usefulness, unlike "what is this house worth?".
    // "Worth arranging", "worth sorting out" and "worth paying for" ask the same thing.
    const valuation = /\bworth\b(?! (?:it|\w+ing)\b)/.test(q);
    // "What does a new roof cost?" opens like guidance and asks for a price.
    const priced = /^what (?:do|does|did|will|would)\b.*\b(?:cost|costs)\b/.test(q);
    if ((amount && !guidance) || priced || valuation) claims.quantities.push(q);
  }
  return claims;
}


const AUTHORITY_STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','been','before','by','can','could','do','does','did','for','from','had','has','have','how','i','if','in','into','is','it','its','me','my','of','on','or','our','should','that','the','their','them','then','there','these','they','this','those','to','was','we','were','what','when','where','which','who','will','with','would','you','your',
  'about','after','also','anything','before','big','compare','comparison','deal','different','explain','help','indicate','indicates','know','look','mean','means','need','please','read','requirement','requirements','tell','think','understand','use','using','want','way',
  // Task wording is handled by requestedClaims, not subject-matter coverage.
  'best','check','checking','investigate','prepare','preparing','preparation',
  // "What evidence should I collect/gather..." is a guidance opener (see
  // requestedClaims); the subject is what follows, not the evidence-gathering
  // verbs. Without this, coverage depended on an incidental third result.
  'evidence','collect','collecting','gather','gathering',
]);

function tokenVariants(token: string): string[] {
  const out = new Set([token]);
  if (token.length > 4 && token.endsWith('ies')) out.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith('es')) out.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith('s')) out.add(token.slice(0, -1));
  if (token.length > 5 && token.endsWith('ed')) out.add(token.slice(0, -2));
  if (token.length > 6 && token.endsWith('ing')) out.add(token.slice(0, -3));
  return [...out];
}

function authorityMeaningTokens(value: string): string[] {
  const tokens = rawTokens(value)
    .filter((token) => token.length > 2 && !AUTHORITY_STOP_WORDS.has(token))
    .flatMap(tokenVariants);
  return [...new Set(tokens)];
}

function guidePrimaryAuthority(result: GuideSearchResult): string {
  return [result.title, result.question, result.summary, result.answer].join(' ');
}

function guideContextAuthority(result: GuideSearchResult): string {
  return [
    result.topics.join(' '),
    result.propertyTypes.join(' '),
    result.eras.join(' '),
    result.buyingStages.join(' '),
    result.jurisdiction.join(' '),
    result.cluster?.label ?? '',
  ].join(' ');
}

function guideStructuredAuthority(result: GuideSearchResult): string {
  const guide = getGuide(result.slug);
  if (!guide) return '';
  return [
    ...guide.sections.map((section) => section.heading),
    ...guide.checklistCandidates.map((candidate) => candidate.text),
    guide.limitations ?? '',
  ].join(' ');
}

type CachedAuthority = {
  primary: string;
  primaryNormalized: string;
  primaryTokens: Set<string>;
  structured: string;
  structuredNormalized: string;
  structuredTokens: Set<string>;
  contextual: string;
  contextualTokens: Set<string>;
};

const authorityCache = new Map<string, CachedAuthority>();

function cachedAuthority(result: GuideSearchResult): CachedAuthority {
  const existing = authorityCache.get(result.slug);
  if (existing) return existing;
  const primary = guidePrimaryAuthority(result);
  const structured = guideStructuredAuthority(result);
  const contextual = guideContextAuthority(result);
  const built: CachedAuthority = {
    primary,
    primaryNormalized: normalize(primary),
    primaryTokens: new Set(authorityMeaningTokens(primary)),
    structured,
    structuredNormalized: normalize(structured),
    structuredTokens: new Set(authorityMeaningTokens(structured)),
    contextual,
    contextualTokens: new Set(authorityMeaningTokens(contextual)),
  };
  authorityCache.set(result.slug, built);
  return built;
}

function queryHasSynonymSupport(query: string, authority: string, token: string): boolean {
  const q = normalize(query);
  const a = normalize(authority);
  return AUTHORITY_SYNONYM_GROUPS.some((group) => {
    const queryPhrases = group.filter((phrase) => q.includes(normalize(phrase)));
    if (queryPhrases.length === 0) return false;
    const tokenBelongs = queryPhrases.some((phrase) => authorityMeaningTokens(phrase).some((part) => tokenVariants(part).some((variant) => variant === token)));
    return tokenBelongs && group.some((phrase) => a.includes(normalize(phrase)));
  });
}

function tokenSupportedByResult(query: string, token: string, result: GuideSearchResult, primaryOnly = false): number {
  const variants = tokenVariants(token);
  const cached = cachedAuthority(result);
  if (variants.some((variant) => cached.primaryTokens.has(variant))) return 1;
  if (queryHasSynonymSupport(query, cached.primary, token)) return 1;
  // A word people use for what they notice counts as the guides' word for it.
  const guideWords = saidAs(token);
  if (guideWords.some((word) => cached.primaryTokens.has(word))) return 1;
  if (primaryOnly) return 0;
  if (guideWords.some((word) => cached.structuredTokens.has(word))) return 0.8;

  // "houses" and "homes" are the same words as "house" and "home".
  if (variants.some((variant) => ['home', 'house', 'dwelling', 'property'].includes(variant)) && result.propertyTypes.length > 0) return 0.8;
  const era = detectEra(query);
  if (/^(?:18|19|20)\d{2}$/.test(token) && era && metadataMatches(result.eras, era)) return 0.8;
  if (/^(?:1920s|1930s|1940s|1950s|1960s|1970s|1980s|1990s|2000s|2010s|2020s)$/.test(token) && era && metadataMatches(result.eras, era)) return 0.8;

  if (variants.some((variant) => cached.structuredTokens.has(variant))) return 0.8;
  if (queryHasSynonymSupport(query, cached.structured, token)) return 0.8;
  if (variants.some((variant) => cached.contextualTokens.has(variant))) return 0.6;
  if (variants.some((variant) => ['buy', 'buying', 'buyer', 'purchase', 'purchasing', 'sale', 'selling', 'contract', 'sign', 'signing', 'auction', 'bid', 'bidding'].includes(variant)) && result.buyingStages.length > 0) return 0.6;

  // Jurisdiction is contextual evidence, not subject-matter authority.
  for (const [code, aliases] of Object.entries(STATE_ALIASES)) {
    if (!result.jurisdiction.includes(code) && !result.jurisdiction.includes('Australia')) continue;
    if (aliases.some((alias) => authorityMeaningTokens(alias).some((part) => variants.includes(part)))) return 0.6;
  }
  return 0;
}

/**
 * Structured filters a caller supplied with a search. A residential property
 * type (house, apartment, townhouse…) or a construction era is the caller
 * telling us the question is about a home, as surely as the words "my house"
 * would. Jurisdiction alone is not: a state name says nothing about the topic.
 */
export interface SearchContext {
  propertyType?: string;
  era?: string;
  jurisdiction?: string;
}

const RESIDENTIAL_PROPERTY_TYPE = /\b(?:house|home|apartment|townhouse|unit|villa|dwelling|duplex|terrace|semi detached|residential)\b/;

/** The question names a physical building matter (element, system, defect or upkeep). */
function hasBuildingCue(query: string): boolean {
  return /\b(?:building|retaining walls?|decks?|balcon\w*|balustrad\w*|termites?|switchboards?|safety switch\w*|fuse box\w*|meter box\w*|hot water|water heaters?|stormwater|drainage|subfloors?|stumps?|restump\w*|reblock\w*|showers?|bathrooms?|waterproof\w*|gutters?|downpipes?|asbestos|eaves|defects?|warrant(?:y|ies)|crack\w*|damp|moisture|mould|condensation|insulation|ventilation|roofs?|walls?|foundations?|footings?|wiring|plumbing|cladding|battens?|render|slabs?|smoke (?:alarms?|detectors?)|weatherboards?|brick\w*|windows?|floors?|ceilings?|chimneys?|maintenance)\b/.test(normalize(query));
}

function suppliedResidentialContext(context?: SearchContext): boolean {
  if (!context) return false;
  if (context.propertyType && RESIDENTIAL_PROPERTY_TYPE.test(normalize(context.propertyType))) return true;
  if (context.era && eraRange(context.era) !== undefined) return true;
  return false;
}

function hasAffirmativeResidentialContext(query: string): boolean {
  const q = normalize(query);
  const residentialNoun = /\b(?:home|house|apartment|townhouse|dwelling|villa|residential)\b/.test(q);
  const propertyNoun = /\bproperty\b/.test(q);
  // Transaction verbs/stages are stronger grounding than role nouns such as
  // "vendor", which also occur in procurement and other non-property domains.
  const transaction = /\b(?:buy|buying|buyer|purchase|purchasing|selling|sale|offer|auction|bid|bidding|contract|settlement|cooling off|due diligence|sign|signing)\b/.test(q);
  const buildingOrDocument = /\b(?:building|retaining walls?|decks?|balcon\w*|balustrad\w*|termites?|switchboards?|safety switch\w*|hot water|stormwater|drainage|subfloors?|stumps?|restump\w*|reblock\w*|showers?|waterproof\w*|gutters?|downpipes?|asbestos|inspection|report|condition|defects?|warrant(?:y|ies)|crack\w*|damp|moisture|mould|roof|walls?|foundation|wiring|plumbing|cladding|battens?|slabs?|smoke alarms?|weatherboard|brick|maintenance|renovat\w*|extension|insurance|strata|owners corporation|body corporate|section 32|vendor statement|seller disclosure|form 2|heritage overlay|sale contract|contract for sale|disclosure|disclosures)\b/.test(q);
  const physicalResidentialCue = /\b(?:building|retaining walls?|decks?|balcon\w*|balustrad\w*|termites?|switchboards?|safety switch\w*|hot water|stormwater|drainage|subfloors?|stumps?|restump\w*|reblock\w*|showers?|waterproof\w*|gutters?|downpipes?|asbestos|defects?|warrant(?:y|ies)|crack\w*|damp|moisture|mould|roof|walls?|foundation|wiring|plumbing|cladding|battens?|slabs?|smoke alarms?|weatherboard|brick|maintenance|renovat\w*|extension|insurance|strata|owners corporation|body corporate)\b/.test(q);
  const relationalResidential = [
    /\b(?:strata|owners corporation|body corporate)\b.{0,30}\b(?:records?|minutes|reports?)\b/,
    /\bcracks?\b.{0,20}\bwall\b|\bwall\b.{0,20}\bcracks?\b/,
    /\b(?:diagonal|structural|cosmetic)\s+cracks?\b|\bcracks?\b.{0,30}\b(?:doors?|windows?|movement|structural|cosmetic)\b/,
    /\brenovat\w*\b.{0,25}\b(?:planning|permit|approval|building)\b|\b(?:planning|permit|approval|building)\b.{0,25}\brenovat\w*\b/,
    /\b(?:vendor|seller)\b.{0,25}\b(?:building|inspection) report\b|\b(?:building|inspection) report\b.{0,25}\b(?:vendor|seller|rely|reliance)\b/,
    /\b(?:auction|bidding)\b.{0,30}\bdue diligence\b|\bdue diligence\b.{0,30}\b(?:auction|bidding)\b/,
    /\bcooling off\b.{0,30}\b(?:buy|buying|contract|sign|signing)\b|\b(?:buy|buying|contract|sign|signing)\b.{0,30}\bcooling off\b/,
  ].some((pattern) => pattern.test(q));
  if (residentialNoun && (transaction || buildingOrDocument || detectEra(query) !== undefined || detectConstructionYear(query) !== undefined)) return true;
  if (propertyNoun && (transaction || physicalResidentialCue)) return true;
  if (transaction && buildingOrDocument) return true;
  if (/\bcooling off\b/.test(q) && /\b(?:contract|sign|signing|buy|buying|buyer)\b/.test(q)) return true;
  // Victoria's Section 32 is a property document; naming the state alongside it
  // is enough residential grounding (unlike a bare "section 32").
  if (
    /\bsection 32\b/.test(q) &&
    /\b(?:victoria|victorian|vic|melbourne)\b/.test(q) &&
    // Another named instrument ("section 32 of the Charter") changes the subject.
    !/\b(?:charter|code|regulations?|police|crimes?|constitution)\b/.test(q) &&
    (!/\bact\b/.test(q) || /\bsale of land act\b/.test(q))
  ) return true;
  if (relationalResidential) return true;
  return false;
}

function contentTokensInOrder(value: string): string[] {
  return rawTokens(value).filter((token) => token.length > 2 && !AUTHORITY_STOP_WORDS.has(token));
}

function primaryPhraseCoverage(query: string, result: GuideSearchResult): number {
  const tokens = contentTokensInOrder(query);
  if (tokens.length <= 1) return tokens.length === 1 ? tokenSupportedByResult(query, tokens[0]!, result, true) : 0;
  const primary = cachedAuthority(result).primaryNormalized;
  let total = 0;
  let supported = 0;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]!;
    const right = tokens[index + 1]!;
    total += 1;
    const phrase = `${left} ${right}`;
    if (primary.includes(phrase)) {
      supported += 1;
      continue;
    }
    // A synonym concept can bridge wording such as warning-sign/red-flag or
    // insurer/insurance without making unrelated residual phrases disappear.
    const leftSupported = queryHasSynonymSupport(query, primary, left);
    const rightSupported = queryHasSynonymSupport(query, primary, right);
    if (leftSupported && rightSupported) supported += 0.8;
  }
  return total ? supported / total : 0;
}

const bodyTokenCache = new Map<string, Set<string>>();
/** Every word in a guide's sections, for half-weight support of ordinary words. */
function guideBodyTokens(slug: string): Set<string> {
  const cached = bodyTokenCache.get(slug);
  if (cached) return cached;
  const guide = getGuide(slug);
  const tokens = new Set(rawTokens((guide?.sections ?? []).map((section) => `${section.heading} ${section.markdown}`).join(' ')));
  bodyTokenCache.set(slug, tokens);
  return tokens;
}

/**
 * How much of the question the single top guide explains. Authority tokens
 * (title, question, topics, headings) count in full; a word that appears only
 * in the guide's body text counts at half weight, enough to carry an ordinary
 * word ("pooling", "lining") alongside a well-supported subject, never enough
 * to make an answer on its own.
 */
function topGuideCoverage(query: string, result: GuideSearchResult): number {
  const tokens = authorityMeaningTokens(query);
  if (tokens.length === 0) return 0;
  const body = guideBodyTokens(result.slug);
  let supported = 0;
  for (const token of tokens) {
    const authority = tokenSupportedByResult(query, token, result, false);
    supported += authority > 0 ? authority : body.has(token) ? 0.5 : 0;
  }
  return supported / tokens.length;
}

function authorityCoverage(query: string, results: GuideSearchResult[], topOnly = false): number {
  const tokens = authorityMeaningTokens(query);
  if (tokens.length === 0 || results.length === 0) return 0;
  const considered = topOnly ? results.slice(0, 1) : results.slice(0, 3);
  let supported = 0;
  for (const token of tokens) {
    let best = 0;
    for (const result of considered) best = Math.max(best, tokenSupportedByResult(query, token, result, topOnly));
    supported += best;
  }
  return supported / tokens.length;
}

// ─── Subject coverage ────────────────────────────────────────────────────
//
// authorityCoverage reads a question against a guide's title, question and
// summary, and counts every word alike. That is a sound test of a question
// written the way the guides are, and a poor one of a question asked the way
// people talk: "how serious", "usually found" and "is it normal" are not the
// subject, and a guide that spends a section on brickwork without naming it
// in its summary still answers a question about brickwork.
//
// subjectCoverage is the second reading, used only when the first one fails
// and the question is clearly about a home. It differs in three ways:
//
//  - Framing words (how serious, how common, is it worth) are set aside: they
//    say what the person wants to know about the subject, not what it is.
//  - A word most guides use says little about the subject and counts less.
//  - The guide's own body counts. A word the guide uses repeatedly is one it
//    discusses; a word it uses once is taken as incidental and earns little.
//
// A word no supporting guide uses still counts in full against the answer,
// which is what keeps "mould on cheese" and "a brick phone" weak.
const FRAMING_WORDS = new Set([
  // how much it matters
  'serious', 'seriously', 'bad', 'worse', 'worst', 'better', 'good', 'dangerous', 'danger', 'normal', 'normally',
  'common', 'commonly', 'usual', 'usually', 'typical', 'typically', 'worry', 'worried', 'worrying', 'concern',
  'concerned', 'problem', 'problems', 'issue', 'issues', 'big', 'major', 'minor', 'deal', 'breaker', 'idea',
  'harder', 'easier', 'hard', 'easy', 'matter', 'matters', 'important', 'likely', 'risk', 'risky',
  // degree and time
  'really', 'actually', 'often', 'sometimes', 'always', 'never', 'still', 'just', 'even', 'much', 'many', 'more',
  'most', 'less', 'some', 'any', 'every', 'each', 'other', 'another', 'long', 'last', 'lasts', 'now', 'soon',
  'later', 'first', 'next', 'near', 'around', 'there', 'here', 'while', 'until', 'after', 'during', 'between',
  // generic verbs
  'get', 'gets', 'getting', 'got', 'make', 'makes', 'making', 'made', 'go', 'goes', 'going', 'gone', 'come', 'comes',
  'find', 'found', 'finding', 'see', 'seen', 'say', 'says', 'saying', 'said', 'give', 'gave', 'given', 'take',
  'keep', 'put', 'try', 'trying', 'happen', 'happens', 'happening', 'feel', 'feels', 'seem', 'seems', 'appear',
  'appears', 'appearing', 'show', 'shows', 'left', 'alone', 'done', 'doing', 'meant', 'sent', 'expect', 'able',
  // filler
  'people', 'everyone', 'someone', 'thing', 'things', 'something', 'lot', 'lots', 'kind', 'sort', 'difference',
  'versus', 'worth', 'needs', 'needed', 'sure', 'out', 'not', 'too', 'very', 'been', 'being', 'has', 'have', 'had',
  'stop', 'consider', 'considering', 'related', 'told', 'require', 'requires', 'type', 'types', 'full', 'ready',
  'quickly', 'slowly', 'already', 'ahead', 'practical', 'looking', 'wrong', 'right', 'start', 'whether', 'why',
  'hire', 'hiring', 'hired',
  // size and direction, as people describe what they see ("a big crack running down the wall")
  'big', 'bigger', 'small', 'smaller', 'huge', 'tiny', 'little', 'bit', 'large', 'running', 'runs', 'run', 'down', 'up',
  'along', 'across', 'point', 'points', 'mean', 'means', 'tell', 'tells',
]);

const COMMON_SHARE = 0.5;
const COMMON_WEIGHT = 0.3;
const BODY_REPEAT = 3;
const BODY_REPEAT_SUPPORT = 0.8;
const BODY_ONCE_SUPPORT = 0.3;
const SUBJECT_COVERAGE_SINGLE = 0.78;
const SUBJECT_COVERAGE_WOVEN = 0.7;
const RARE_GUIDES = 5;
const STRANGER_SUPPORT = 0.6;
const MULTI_ISSUE_WORDS = 3;
const CONTEXT_BODY_MENTIONS = 2;

function guideFullText(guide: GuideRecord): string {
  return [
    guide.title, guide.question, guide.summary, guide.answer, guide.topics.join(' '),
    ...guide.sections.map((section) => `${section.heading} ${section.markdown}`),
    ...guide.checklistCandidates.map((candidate) => candidate.text),
  ].join(' ');
}

let documentFrequency: Map<string, number> | undefined;
function corpusDocumentFrequency(): Map<string, number> {
  if (documentFrequency) return documentFrequency;
  const frequency = new Map<string, number>();
  for (const guide of guides) {
    for (const token of new Set(rawTokens(guideFullText(guide)))) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  documentFrequency = frequency;
  return frequency;
}

/** Singular and plural, with and without a verb ending: one word for counting purposes. */
function wordForms(token: string): string[] {
  return [...new Set([...tokenVariants(token), `${token}s`])];
}

function guidesUsing(token: string): number {
  const frequency = corpusDocumentFrequency();
  return Math.max(...[...wordForms(token), ...saidAs(token)].map((form) => frequency.get(form) ?? 0));
}

/** Edit distance counting a swap of neighbouring letters as one step, abandoned once it passes `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous: number[] = [];
  let current = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const before = previous;
    previous = current;
    current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2]! + 1);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
  }
  return current[b.length]!;
}

const misspellingCache = new Map<string, boolean>();
/**
 * A word no guide uses, but one slip away from a word they do use ("statment",
 * "minuets", "moister"): a misspelling, not another subject. Short words are
 * left out, because one letter turns too many of them into each other.
 */
function looksMisspelled(token: string): boolean {
  const cached = misspellingCache.get(token);
  if (cached !== undefined) return cached;
  const max = token.length >= 7 ? 2 : token.length >= 5 ? 1 : 0;
  let found = false;
  if (max > 0) {
    for (const word of corpusDocumentFrequency().keys()) {
      if (word[0] !== token[0] || word.length < 5) continue;
      if (editDistance(token, word, max) <= max && isTypingSlip(token, word)) { found = true; break; }
    }
  }
  misspellingCache.set(token, found);
  return found;
}

/**
 * A slip a person makes typing, not another word: a letter dropped, added or
 * swapped with its neighbour. A changed letter in a short word is usually a
 * different word ("police" and "policy"), so it counts only from eight letters.
 */
function isTypingSlip(token: string, word: string): boolean {
  if (token.length >= 8 || token.length !== word.length) return true;
  const differ: number[] = [];
  for (let index = 0; index < token.length; index += 1) if (token[index] !== word[index]) differ.push(index);
  return differ.length === 2 && differ[1] === differ[0]! + 1 && token[differ[0]!] === word[differ[1]!] && token[differ[1]!] === word[differ[0]!];
}

/** A word no guide uses in any form, misspellings aside. */
function unknownToCorpus(token: string): boolean {
  return !/^\d/.test(token) && guidesUsing(token) === 0 && !looksMisspelled(token);
}

/** A word used by at least half the guides is ordinary house vocabulary and counts less. */
function subjectWeight(token: string): number {
  return guidesUsing(token) / Math.max(1, guides.length) >= COMMON_SHARE ? COMMON_WEIGHT : 1;
}

const bodyCountCache = new Map<string, Map<string, number>>();
function guideBodyCounts(slug: string): Map<string, number> {
  const cached = bodyCountCache.get(slug);
  if (cached) return cached;
  const counts = new Map<string, number>();
  const guide = getGuide(slug);
  for (const token of rawTokens((guide?.sections ?? []).map((section) => `${section.heading} ${section.markdown}`).join(' '))) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  bodyCountCache.set(slug, counts);
  return counts;
}

function bodyMentions(token: string, result: GuideSearchResult): number {
  const counts = guideBodyCounts(result.slug);
  return [...new Set([...wordForms(token), ...saidAs(token)])].reduce((sum, form) => sum + (counts.get(form) ?? 0), 0);
}

// Words for a kind of home. A guide written for that kind, or for every kind,
// covers the word ("a townhouse in Queensland", "a detached house").
const KIND_WORDS: Record<string, PropertyKind | 'any'> = {
  detached: 'house', freestanding: 'house', townhouse: 'townhouse or unit', townhouses: 'townhouse or unit',
  villa: 'townhouse or unit', villas: 'townhouse or unit', unit: 'townhouse or unit', units: 'townhouse or unit',
  apartment: 'apartment', apartments: 'apartment', flat: 'apartment', flats: 'apartment',
};
function kindSupport(token: string, result: GuideSearchResult): number {
  const kind = KIND_WORDS[token];
  if (!kind) return 0;
  if (result.propertyTypes.some((value) => normalize(value) === 'all residential property')) return 0.8;
  return result.propertyTypes.some((value) => kindOf(normalize(value)).includes(kind as PropertyKind)) ? 0.8 : 0;
}

/**
 * The same word in another part of speech: "disclose" and "disclosure",
 * "inspect" and "inspection", "renovate" and "renovation". Only for words of
 * five letters or more, and only one step away.
 */
function familyForms(token: string): string[] {
  if (token.length < 5) return [];
  const root = token.replace(/(?:ation|ition|ion|ure|ment|ing|ed|es|e|s)$/, '');
  if (root.length < 4) return [];
  return [...new Set([root, `${root}e`, `${root}ure`, `${root}ion`, `${root}ation`, `${root}ment`, `${root}ing`, `${root}ed`, `${root}s`])].filter((form) => form !== token);
}

function subjectSupport(query: string, token: string, result: GuideSearchResult, readBody: boolean): number {
  let authority = Math.max(tokenSupportedByResult(query, token, result, false), kindSupport(token, result));
  if (authority < 0.8) for (const form of familyForms(token)) authority = Math.max(authority, Math.min(0.8, tokenSupportedByResult(query, form, result, false)));
  if (!readBody || authority >= BODY_REPEAT_SUPPORT) return authority;
  const mentions = bodyMentions(token, result);
  if (mentions >= BODY_REPEAT) return Math.max(authority, BODY_REPEAT_SUPPORT);
  if (mentions >= 1) return Math.max(authority, BODY_ONCE_SUPPORT);
  return authority;
}

// The words a question uses to ask for a verdict, a price or a recommendation.
// They are what requestedClaims acts on, not part of the subject.
const CLAIM_WORDS = new Set([
  'cost', 'costs', 'price', 'prices', 'priced', 'fee', 'fees', 'rate', 'rates', 'pay', 'paying', 'paid', 'value', 'valued',
  'safe', 'unsafe', 'toxic', 'sick', 'illness', 'compliant', 'compliance', 'approve', 'approval', 'permit', 'covered',
  'cover', 'coverage', 'liable', 'liability', 'legally', 'valid', 'binding', 'enforceable', 'void', 'illegal',
  'reasonable', 'fair', 'collapse', 'definitely', 'prove', 'proof', 'failed', 'failure', 'recommend', 'recommendation',
  'buy', 'rent', 'bid', 'offer', 'use', 'choose', 'insurer', 'insurance', 'council', 'code', 'stand', 'drill',
]);

function subjectTokens(query: string, withoutClaims = false): string[] {
  return [...new Set(contentTokensInOrder(query).filter((token) => !FRAMING_WORDS.has(token) && !(withoutClaims && CLAIM_WORDS.has(token))))];
}

export type SubjectCoverageDetail = { token: string; weight: number; support: number };

/** Per-word detail behind subjectCoverage, for tests and calibration. */
export function subjectCoverageDetail(query: string, results: GuideSearchResult[], topOnly = false, readBody = true, withoutClaims = false): SubjectCoverageDetail[] {
  const considered = topOnly ? results.slice(0, 1) : results.slice(0, 3);
  return subjectTokens(query, withoutClaims).map((token) => ({
    token,
    weight: subjectWeight(token),
    support: considered.reduce((best, result) => Math.max(best, subjectSupport(query, token, result, readBody)), 0),
  }));
}

/**
 * A stranger is a subject word the supporting guides do not discuss. One is
 * enough to change the subject ("cooling off period after exercise"), however
 * well the rest of the question is covered.
 *
 * For a question about the building, only a word few guides use at all is a
 * stranger: an ordinary word the winning guide happens not to use ("winter",
 * "upgrade") lowers coverage and no more. For a contract, auction or
 * disclosure question every subject word must be supported, because that
 * vocabulary is shared with too many other fields ("door to door sales").
 */
function hasStrangerWord(query: string, results: GuideSearchResult[], topOnly: boolean, physical: boolean): boolean {
  return subjectCoverageDetail(query, results, topOnly, physical)
    .some((entry) => entry.support < STRANGER_SUPPORT && (physical ? guidesUsing(entry.token) <= RARE_GUIDES : entry.weight > COMMON_WEIGHT));
}

export function subjectCoverage(query: string, results: GuideSearchResult[], topOnly = false, readBody = true): number {
  const detail = subjectCoverageDetail(query, results, topOnly, readBody);
  const total = detail.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return 0;
  return detail.reduce((sum, entry) => sum + entry.weight * entry.support, 0) / total;
}

const bodyTextCache = new Map<string, string>();
/** The question's subject, as a run of words, appears in the guide's own text. */
function subjectPhraseInBody(query: string, result: GuideSearchResult): boolean {
  const tokens = subjectTokens(query);
  if (tokens.length < 2) return false;
  let body = bodyTextCache.get(result.slug);
  if (body === undefined) {
    body = normalize((getGuide(result.slug)?.sections ?? []).map((section) => `${section.heading} ${section.markdown}`).join(' '));
    bodyTextCache.set(result.slug, body);
  }
  return includesTerm(body, tokens.join(' '));
}

/** Every subject word is in the guide's title, question, summary, headings or checklist: nothing rests on the body alone. */
function subjectNamedByGuide(query: string, result: GuideSearchResult): boolean {
  const tokens = subjectTokens(query);
  return tokens.length > 0 && tokens.every((token) => tokenSupportedByResult(query, token, result, false) >= 0.8);
}

// A contextual qualifier can change the subject of an otherwise familiar
// question. Require support for its meaning-bearing words independently of the
// overall average; extra residential vocabulary must not dilute an unknown
// setting. This uses corpus evidence rather than a list of excluded domains.
function hasUnsupportedContext(query: string, results: GuideSearchResult[]): boolean {
  for (const clause of requestClauses(query)) {
    const qualifiers = clause.matchAll(/\b(?:in|within|inside|under|for|as)\s+(.+?)(?=\b(?:in|within|inside|under|for|as|before|after|and|or|but)\b|$)/g);
    for (const match of qualifiers) {
      // Framing words ("in a house until they are serious") are not a setting.
      // A setting the returned guides write about in their own text is one
      // they cover, even when no title or heading names it.
      const tokens = contentTokensInOrder(match[1]!).filter((token) => !FRAMING_WORDS.has(token));
      if (tokens.some((token) => !results.slice(0, 3).some((result) => tokenSupportedByResult(query, token, result) > 0 || bodyMentions(token, result) >= CONTEXT_BODY_MENTIONS))) return true;
    }
  }
  return false;
}

function supportsQuantification(query: string, results: GuideSearchResult[]): boolean {
  const top = results[0];
  if (!top) return false;
  // Quantitative questions are strong only when the guide advertises that
  // quantitative task in its authored question/title, not merely because a
  // long article mentions a cost somewhere.
  const primary = normalize(`${top.title} ${top.question}`);
  if (!/\b(?:cost|costs|price|prices|fee|fees)\b/.test(primary)) return false;
  return authorityCoverage(query, results, true) >= 0.62;
}

function lacksDedicatedStateAuthority(query: string, results: GuideSearchResult[]): boolean {
  const jurisdictions = mentionedJurisdictions(query);
  if (jurisdictions.length !== 1) return false;
  const q = normalize(query);
  const stateDocumentQuestion = /\b(?:seller disclosure|vendor statement|contract disclosure|contract disclosures|disclosure requirement|disclosure requirements|contract for sale|sale contract)\b/.test(q);
  if (!stateDocumentQuestion) return false;
  const jurisdiction = jurisdictions[0]!;
  return !results.some((result) => result.cluster?.id === 'state-rules' && result.jurisdiction.includes(jurisdiction));
}

/**
 * Why a non-empty result should not be presented as a strong answer, or
 * undefined when it is one. Retrieval and authority are intentionally
 * different things, and so are the ways an answer can fall short:
 *
 *  - 'finance', 'determination', 'recommendation', 'price': the question asks
 *    for something the corpus never gives, whatever the guide's subject.
 *  - 'context', 'state': a qualifier or state the results do not cover.
 *  - 'coverage', 'phrase', 'relevance': the guides do not explain the question.
 */
export type WeakReason = 'finance' | 'determination' | 'recommendation' | 'price' | 'context' | 'state' | 'coverage' | 'phrase' | 'relevance';

export function weakReason(asked: string, results: GuideSearchResult[], context?: SearchContext): WeakReason | undefined {
  if (results.length === 0) return undefined;
  const query = readQuestion(asked).query;

  const claims = requestedClaims(query);
  if (FINANCIAL_ADVICE_PATTERN.test(normalize(query))) return 'finance';
  if (claims.determine) return 'determination';
  if (claims.recommend) return 'recommendation';
  if (claims.quantities.some((clause) => !supportsQuantification(clause, results))) return 'price';
  if (hasUnsupportedContext(query, results)) return 'context';
  if (lacksDedicatedStateAuthority(query, results)) return 'state';

  const canWeave = hasAffirmativeResidentialContext(query);
  // A residential property type or era supplied as a filter grounds a terse
  // building question ("shower waterproofing", "box gutters") that would
  // otherwise read as ungrounded. It relaxes only the authored-phrase check
  // below. It never permits weaving across guides: the top guide on its own
  // must still explain the whole question, so an off-topic word ("car",
  // "phone", "Corporations Act") keeps the answer weak.
  const filterGrounded = !canWeave && suppliedResidentialContext(context) && hasBuildingCue(query);
  // Ungrounded questions must be explained by the winning guide itself. This
  // prevents several loosely related guides from stitching incidental words
  // together into fake authority. Once the query is affirmatively residential,
  // multi-guide coverage is allowed because weaving is a feature of the corpus.
  if (filterGrounded) {
    // One guide must explain the whole question, from its full content (not
    // just its title): "termite damage" is explained by the termites guide's
    // body. Several guides are never stitched together.
    if (topGuideCoverage(query, results[0]!) < 0.75) return 'coverage';
    return relevanceDensity(query, results) < MIN_RELEVANCE_PER_TERM ? 'relevance' : undefined;
  }
  // A small relevance floor is the final retrieval-quality backstop. It does
  // not decide authority on its own.
  if (relevanceDensity(query, results) < MIN_RELEVANCE_PER_TERM) return 'relevance';

  // A word no guide uses anywhere is the plainest sign of another subject
  // ("a wall crack on a boat"). It outweighs everything else in the question,
  // on either reading. A misspelling of a word the guides do use is let by.
  if (subjectTokens(query).some(unknownToCorpus)) return 'coverage';

  // A general buying question, answered by the guides on how to buy, is
  // answered: its only subject is buying, and those guides are about nothing else.
  if (isGeneralBuyingQuestion(query) && GENERAL_BUYING_CLUSTERS.has(results[0]!.cluster?.id ?? '')) return undefined;
  if (isOldHomeQuestion(query) && ERA_WIDE_GUIDES.has(results[0]!.slug)) return undefined;
  // An age given as years ("a 100 year old house"), answered by that era's own guide.
  const ageEra = detectEra(query);
  if (ageEra && isAgeOnlyQuestion(query) && results[0]!.slug === CONSTRUCTION_ERA_GUIDE[ageEra]) return undefined;

  // First reading: the question against what the guides say they are about.
  const coverage = authorityCoverage(query, results, !canWeave);
  const exactAuthoredMatch = includesTerm(results[0]!.question, query) || includesTerm(results[0]!.title, query);
  const phraseShort = !canWeave && !exactAuthoredMatch && primaryPhraseCoverage(query, results[0]!) < 0.5;
  const first: WeakReason | undefined = coverage < (canWeave ? 0.70 : 0.78) ? 'coverage' : phraseShort ? 'phrase' : undefined;
  if (first === undefined) return undefined;

  // Second reading, for a question that is plainly about a home but asked in
  // everyday words: its subject against everything the guides contain. A
  // question with no residential or building word of its own never gets here.
  // A question is about the building itself when it names a building matter,
  // or when the guide that answers it is one of the building-fabric guides.
  const physical = hasBuildingCue(query) || BUILDING_CLUSTERS.has(results[0]!.cluster?.id ?? '');
  if (!canWeave && !physical && residentialDomainEvidence(query) < 1) return first;
  // The body is read only for a question about the building itself. Contract,
  // auction and disclosure wording turns up in too many other senses
  // ("business days", "exercise the right") to be taken from running text.
  // A question that names several building matters ("the roof leaks, there is
  // mould on the ceiling and some timber decay") is answered by several guides
  // together, as a question that says "house" is. Enough subject words about
  // the building may be woven across the top three.
  const woven = canWeave || (physical && subjectTokens(query).length >= MULTI_ISSUE_WORDS);
  if (subjectCoverage(query, results, !woven, physical) < (woven ? SUBJECT_COVERAGE_WOVEN : SUBJECT_COVERAGE_SINGLE)) return 'coverage';
  if (hasStrangerWord(query, results, !woven, physical)) return 'coverage';
  // Without a residential word, two guide words side by side can still mean
  // something else ("glass ceiling"). For a subject that short the guide must
  // name both words itself, or use them together as the question does.
  if (phraseShort && subjectTokens(query).length <= 2 && !subjectNamedByGuide(query, results[0]!) && !(physical && subjectPhraseInBody(query, results[0]!))) return 'phrase';
  return undefined;
}

/**
 * A result can be weak because the guides are not about the question, or
 * because of what the question asks of them: a verdict on a particular home,
 * a price, a recommendation. The second kind deserves saying differently.
 * "How much does restumping cost?" has a guide on restumping; telling the
 * caller that no guide matches would be untrue, and would hide it.
 *
 * Returns the limit when that is the only thing between the question and the
 * guides: the subject, with the asking words set aside, is one the returned
 * guides cover. The result is still weak either way.
 */
export type GuidanceLimit = 'determination' | 'price' | 'recommendation';

export function guidanceLimit(asked: string, results: GuideSearchResult[], context?: SearchContext): GuidanceLimit | undefined {
  const reason = weakReason(asked, results, context);
  const query = readQuestion(asked).query;
  if (reason !== 'determination' && reason !== 'price' && reason !== 'recommendation') return undefined;
  const physical = hasBuildingCue(query) || BUILDING_CLUSTERS.has(results[0]!.cluster?.id ?? '');
  if (!physical && !hasAffirmativeResidentialContext(query) && residentialDomainEvidence(query) < 1) return undefined;
  // Judged on what the guides say they are about, never their running text,
  // and only when the question names a real subject: a building matter, or a
  // word the guides own. A place, a year or "house" on its own is not one,
  // and a price question must be about the building ("house prices" is not).
  // A price word pulls the cost guides to the top whatever the subject, so a
  // price question is read against the first three; a verdict or a
  // recommendation against the winning guide alone.
  const detail = subjectCoverageDetail(query, results, reason !== 'price', false, true);
  const total = detail.reduce((sum, entry) => sum + entry.weight, 0);
  const named = detail.some((entry) => entry.weight === 1 && entry.support >= BODY_REPEAT_SUPPORT && !PLACE_WORDS.has(entry.token) && !/^\d+$/.test(entry.token));
  if (!hasBuildingCue(query) && (reason === 'price' || !named)) return undefined;
  if (detail.reduce((sum, entry) => sum + entry.weight * entry.support, 0) / total < SUBJECT_COVERAGE_WOVEN) return undefined;
  if (detail.some((entry) => entry.support < STRANGER_SUPPORT && (physical ? guidesUsing(entry.token) <= RARE_GUIDES : entry.weight > COMMON_WEIGHT))) return undefined;
  return reason;
}

const PLACE_WORDS = new Set([
  'australia', 'australian',
  ...Object.keys(STATE_ALIASES).map((code) => code.toLowerCase()),
  ...Object.values(STATE_ALIASES).flatMap((aliases) => aliases.flatMap((alias) => rawTokens(alias))),
]);

const LIMIT_PREAMBLE: Record<GuidanceLimit, string> = {
  determination: 'The guides below give general guidance on this subject. They cannot say whether a particular home, document or claim is safe, compliant, valid or covered: that takes someone who has seen it.',
  price: 'The guides below cover this subject. They do not price work or value a property: use them for what drives the scope and what to ask.',
  recommendation: 'The guides below cover what to check before deciding. They do not recommend a provider or say whether to buy.',
};

/**
 * True when relevant material exists but the corpus should not present it as a
 * strong answer.
 */
export function isWeakMatch(query: string, results: GuideSearchResult[], context?: SearchContext): boolean {
  return weakReason(query, results, context) !== undefined;
}

function hasStructuredRetrievalSignal(query: string, results: GuideSearchResult[]): boolean {
  const top = results[0];
  if (!top) return false;
  const era = detectEra(query);
  if (era && metadataMatches(top.eras, era)) return true;
  const canWeave = hasAffirmativeResidentialContext(query);
  return authorityCoverage(query, results, !canWeave) >= (canWeave ? 0.58 : 0.78);
}

export function searchGuides(requested: SearchOptions): GuideSearchResult[] {
  const limit = Math.max(1, Math.min(requested.limit ?? 5, 10));
  if (!requested.query.trim()) return [];
  if (isFinanceOnlyQuery(requested.query.trim())) return [];
  const read = readQuestion(requested.query.trim());
  const options: SearchOptions = { ...requested, query: read.query };
  const query = read.query;
  // A guide written only for a kind of property the question rules out is
  // not returned. A house filter also rules out the guides written only for
  // apartments: strata records and levies cannot apply to a freestanding house.
  // The other way round stays a nudge, not a rule: an apartment block is still
  // a building of its era and construction, and the era and brick guides
  // (tagged for houses) still describe it. Townhouses can be either.
  const filtered = requested.propertyType ? kindOf(normalize(requested.propertyType)) : [];
  const ruledOut = new Set<PropertyKind>(read.excludedKinds);
  if (filtered.length === 1 && filtered[0] === 'house') ruledOut.add('apartment');
  const kindRuledOut = (guide: GuideRecord) => {
    const kinds = guide.propertyTypes.flatMap((value) => kindOf(normalize(value)));
    return kinds.length > 0 && guide.propertyTypes.every((value) => normalize(value) !== 'all residential property') && kinds.every((kind) => ruledOut.has(kind));
  };
  const terms = expandedTerms(query);
  const jurisdictions = jurisdictionsForSearch(options);
  const { jurisdiction: _requestedJurisdiction, ...optionsWithoutJurisdiction } = options;
  const normalizedOptions: SearchOptions = jurisdictions.length === 1
    ? { ...optionsWithoutJurisdiction, jurisdiction: jurisdictions[0]! }
    : optionsWithoutJurisdiction;

  const candidates = guides.filter((guide) => {
    if (!(options.includePillar ?? false) && guide.pillar) return false;
    if (ruledOut.size > 0 && kindRuledOut(guide)) return false;
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
      // Scored first, and a snippet cut only for the three sections kept:
      // cutting one for every section of every guide, to discard nearly all
      // of them, was a fifth of the time a search took.
      const matchedSections = guide.sections
        .map((section) => ({ section, score: scoreSection(section, terms, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ section, score }) => ({
          id: section.id,
          heading: section.heading,
          snippet: snippet(section.markdown, matchedTerms.length ? matchedTerms : terms),
          score,
        }));

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
  if (relevanceDensity(query, ranked) < MIN_RELEVANCE_PER_TERM && !hasStructuredRetrievalSignal(query, ranked)) return [];
  return ranked;
}

function candidateScore(text: string, terms: string[], section: string): number {
  let score = authoredActionText(text) ? 8 : 0;
  for (const term of terms) {
    if (includesTerm(text, term)) score += term.includes(' ') ? 6 : 2;
  }
  if (text.endsWith('?')) score += 1;
  if (section === 'Questions to resolve') score -= 2;
  if (text.length > 240) score -= 1;
  return score;
}

const ACTION_VERBS = /^(?:ask|check|compare|confirm|consider|document|establish|find|inspect|investigate|look|map|obtain|read|record|review|send|set|start|test|verify|write|describe|insure|keep|make|note|trace|date|measure|clarify|define|identify|understand)\b/i;

function stripChecklistFormatting(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Return an action only when the author actually wrote one. A labelled evidence
 * row such as "Sydney: provider price..." or "1950s-70s: material..." is not
 * converted into an imperative. If the text has a descriptive label followed
 * by a genuinely authored directive, use the directive after the label.
 */
function authoredActionText(text: string): string | undefined {
  const clean = stripChecklistFormatting(text);
  if (!clean) return undefined;
  // A one- or two-word label followed by a capitalised sentence ("Start: The
  // build date…", "Look closer: Plans…", "Test: Only a laboratory…") is a
  // summary plate's heading and caption, not an instruction, even when the
  // label is a verb. Judge such an item by its sentence: keep it if it is
  // itself an action or a question, otherwise it is not a check. A label run
  // on in lower case ("Confirm identity: seller, address…") is left alone.
  const labelled = /^([^:?.!]{1,30}):\s+([A-Z].*)$/.exec(clean);
  if (labelled && labelled[1]!.trim().split(/[\s/]+/).filter((w) => /[a-z]/i.test(w)).length <= 2) {
    const detail = labelled[2]!.trim();
    if (ACTION_VERBS.test(detail)) return detail;
    if (/^(?:did|does|do|is|are|can|could|will|would|what|which|how|where|when|who)\b/i.test(detail) && detail.endsWith('?')) return detail;
    return undefined;
  }
  if (ACTION_VERBS.test(clean)) return clean;
  const colon = clean.indexOf(':');
  if (colon > 0 && colon < 90) {
    const label = clean.slice(0, colon).trim();
    if (/^(?:did|does|do|is|are|can|could|will|would|what|which|how|where|when|who)\b/i.test(label) && label.endsWith('?')) return label;
    const detail = clean.slice(colon + 1).trim();
    if (ACTION_VERBS.test(detail)) return detail;
    if (/^(?:did|does|do|is|are|can|could|will|would|what|which|how|where|when|who)\b/i.test(detail) && detail.endsWith('?')) return detail;
  }
  if (/^(?:did|does|do|is|are|can|could|will|would|what|which|how|where|when|who)\b/i.test(clean) && clean.endsWith('?')) return clean;
  return undefined;
}

function eraRange(value?: string): [number, number] | undefined {
  if (!value) return undefined;
  const q = normalize(value);
  if (/\bpre 1920s?\b/.test(q)) return [1800, 1919];
  if (/\b(?:1920s 1940s|1920s 40s|interwar)\b/.test(q)) return [1920, 1949];
  if (/\b(?:1950s 1970s|1950s 70s|postwar)\b/.test(q)) return [1950, 1979];
  if (/\b(?:1980s 1990s|1980s 90s)\b/.test(q)) return [1980, 1999];
  if (/\b(?:2000s on|2000s onward|2000s onwards|2000s|2010s|2020s|modern)\b/.test(q)) return [2000, 2039];
  return undefined;
}

function candidateEraRange(text: string): [number, number] | undefined {
  const q = normalize(text);
  if (/\bpre 1920s?\b/.test(q)) return [1800, 1919];
  if (/\b1920s 40s\b|\b1920s 1940s\b/.test(q)) return [1920, 1949];
  if (/\b1950s 70s\b|\b1950s 1970s\b/.test(q)) return [1950, 1979];
  if (/\b1980s 90s\b|\b1980s 1990s\b/.test(q)) return [1980, 1999];
  if (/\b2000s onward\b|\b2000s onwards\b/.test(q)) return [2000, 2039];
  return undefined;
}

function eraCompatible(candidateText: string, profileEra?: string): boolean {
  const candidate = candidateEraRange(candidateText);
  const wanted = eraRange(profileEra);
  if (!candidate || !wanted) return true;
  return candidate[0] <= wanted[1] && wanted[0] <= candidate[1];
}

function hasAuctionIntent(profile: ChecklistProfile): boolean {
  const text = normalize([profile.buyingStage, ...(profile.concerns ?? [])].filter(Boolean).join(' '));
  return /\b(?:auction|bid|bidding)\b/.test(text);
}

function normalizeChecklistText(text: string): string {
  const clean = authoredActionText(text) ?? stripChecklistFormatting(text);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

// A checklist item must stand on its own: "Read the wall in context" or
// "What happens next?" depend on the paragraph they were lifted from.
const MIN_CHECKLIST_WORDS = 6;
function standsAlone(text: string): boolean {
  const clean = authoredActionText(text) ?? stripChecklistFormatting(text);
  return clean.split(/\s+/).filter(Boolean).length >= MIN_CHECKLIST_WORDS;
}

/** An era guide (e.g. period homes) only contributes checks to a home of its era. */
function guideEraCompatible(guide: GuideRecord, profileEra?: string): boolean {
  const wanted = eraRange(profileEra);
  if (!wanted) return true;
  const ranges = (guide.eras ?? []).map((era) => eraRange(era)).filter((r): r is [number, number] => Boolean(r));
  // A guide written for every era (or with no era tags) is general.
  if (ranges.length === 0 || ranges.length >= 4) return true;
  return ranges.some((r) => r[0] <= wanted[1] && wanted[0] <= r[1]);
}

function authoredChecklistCandidates(guide: GuideRecord, profileEra?: string): GuideRecord['checklistCandidates'] {
  const usable = (candidate: GuideRecord['checklistCandidates'][number]) =>
    Boolean(authoredActionText(candidate.text)) && standsAlone(candidate.text) && eraCompatible(candidate.text, profileEra);
  const existing = guide.checklistCandidates.filter(usable);
  if (existing.length > 0) return existing;

  // The export's candidates come from lists/tables. Some guides express their
  // actions in prose instead. Use an authored opening sentence from a general
  // paragraph, preserving its wording and source section. Never turn a table
  // description or an illustrative example into an instruction.
  return guide.sections.flatMap((section) => {
    if (/\b(?:example|illustrative)\b/i.test(section.heading)) return [];
    return section.markdown.split(/\n\s*\n/).flatMap((paragraph) => {
      const raw = paragraph.trim();
      if (!raw || /^(?:#|\||>|[-*+]\s|\d+\.\s)/.test(raw)) return [];
      const text = stripChecklistFormatting(raw).split(/(?<=[.!?])\s+/)[0]!;
      // Only a leading directive: question labels and explanatory prose do not
      // provide enough context for this fallback.
      const candidate = { text, section: section.heading };
      return ACTION_VERBS.test(text) && usable(candidate) ? [candidate] : [];
    });
  });
}

function resultExplainsConcern(result: GuideSearchResult, concern: string): boolean {
  const authority = normalize(`${result.title} ${result.question} ${result.summary} ${result.topics.join(' ')}`);
  const terms = expandedTerms(concern);
  return terms.some((term) => includesTerm(authority, term));
}

function concernInHeadline(result: GuideSearchResult, concern: string): boolean {
  const headline = normalize(`${result.title} ${result.question}`);
  return expandedTerms(concern).some((term) => includesTerm(headline, term));
}

function preserveExplicitConcerns(
  matched: GuideSearchResult[],
  profile: ChecklistProfile,
  maxGuides: number,
): GuideSearchResult[] {
  const concerns = [...new Set((profile.concerns ?? []).map(normalize).filter(Boolean))].sort();
  const pool = new Map(matched.map((result) => [result.slug, result]));
  const coverage = new Map<string, Set<string>>();
  const requests = [...concerns];
  if (hasAuctionIntent(profile)) requests.push('auction due diligence before bidding');

  // Collect all representatives before selecting. Once a concern's source is
  // found it participates in the selection alongside every other concern;
  // later concerns cannot overwrite it in a reserved last slot.
  for (const concern of [...new Set(requests)].sort()) {
    const direct = searchGuides({
      query: `${profile.propertyType ?? 'residential property'} ${concern}`,
      limit: 3,
      ...(profile.jurisdiction ? { jurisdiction: profile.jurisdiction } : {}),
      ...(profile.propertyType ? { propertyType: profile.propertyType } : {}),
    }).filter((result) => {
      const guide = getGuide(result.slug);
      return resultExplainsConcern(result, concern) && guide !== undefined &&
        authoredChecklistCandidates(guide, profile.era).length > 0;
    })
      // A guide that names the concern in its own title or question is the
      // dedicated source; one that only touches it through inferred topics is
      // background. Prefer the dedicated guide, then keep the search order.
      .map((result, index) => ({ result, index, dedicated: concernInHeadline(result, concern) }))
      .sort((a, b) => Number(b.dedicated) - Number(a.dedicated) || a.index - b.index)[0]?.result;
    if (!direct) continue;
    pool.set(direct.slug, direct);
    const covered = coverage.get(direct.slug) ?? new Set<string>();
    covered.add(concern);
    coverage.set(direct.slug, covered);
  }

  const originalRank = new Map(matched.map((result, index) => [result.slug, index]));
  const priority = (a: GuideSearchResult, b: GuideSearchResult) =>
    (coverage.get(b.slug)?.size ?? 0) - (coverage.get(a.slug)?.size ?? 0) ||
    (originalRank.get(a.slug) ?? maxGuides) - (originalRank.get(b.slug) ?? maxGuides) ||
    a.slug.localeCompare(b.slug);
  return [...pool.values()].sort(priority).slice(0, maxGuides);
}

export function buildBuyerChecklist(profile: ChecklistProfile, limit = 12): BuyerChecklist {
  const concerns = [...new Set((profile.concerns ?? []).map(normalize).filter(Boolean))].sort();
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
  matched = preserveExplicitConcerns(matched, profile, 6);

  const terms = expandedTerms(query);
  const items: Array<BuyerChecklistItem & { score: number }> = [];

  for (const result of matched) {
    const guide = getGuide(result.slug);
    if (!guide || !guideEraCompatible(guide, profile.era)) continue;
    const candidates = authoredChecklistCandidates(guide, profile.era)
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
      `For guidance applied to a specific address, Homechecker provides an independent desktop property read. Visit https://homechecker.com.au for current pricing.`,
    matchedGuides: matched.map((result) => ({
      slug: result.slug,
      title: result.title,
      canonicalUrl: result.canonicalUrl,
      answer: result.answer,
    })),
    items: selected,
  };
}

// The catalogue projection used by the list_guides tool: identity, the
// question the guide answers, where it is published and the few facets needed
// to choose one. No prose. guideSummary below stays as it is: get_guide and the
// REST adapters return a single guide, where its summary and answer are the
// point.
export function guideCatalogueEntry(guide: GuideRecord): Record<string, unknown> {
  return {
    slug: guide.slug,
    title: guide.title,
    question: guide.question,
    canonicalUrl: guide.canonicalUrl,
    cluster: guide.cluster?.id ?? null,
    jurisdiction: guide.jurisdiction,
    updatedAt: guide.updatedAt,
    readingTimeMin: guide.readingTimeMin,
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

export function renderSearchResults(results: GuideSearchResult[], query = '', context?: SearchContext): string {
  if (!results.length) {
    return 'No Homechecker guide addresses that question. The corpus covers buying process, state disclosure rules, reading building and strata reports, building fabric and condition, and owning or changing a home. It does not cover finance, tax, valuation or agent selection.';
  }
  const limit = guidanceLimit(query, results, context);
  const preamble = limit
    ? `${LIMIT_PREAMBLE[limit]}\n\n`
    : isWeakMatch(query, results, context)
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
