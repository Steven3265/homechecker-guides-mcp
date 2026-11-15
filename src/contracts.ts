import * as z from 'zod/v4';
import { READ_LINK_NOTE } from './identity.js';
import { readLinksEnabled } from './client-label.js';

export const CLUSTER_IDS = ['why', 'how-to-buy', 'state-rules', 'read-building', 'shared-buildings', 'own-change'] as const;
export type ClusterId = (typeof CLUSTER_IDS)[number];
export type MatchStrength = 'none' | 'weak' | 'strong';

const jurisdiction = z.string().optional().describe('Australia or a state/territory code or name, such as VIC, vic or Victoria.');
const propertyType = z.string().optional().describe('For example house, apartment, or townhouse or unit.');
const era = z.string().optional().describe('For example pre-1920s, 1950s-1970s, or 2000s-on.');
const buyingStage = z.string().optional().describe('For example research, contract review, physical inspection, ownership, or selling.');
const cluster = z.enum(CLUSTER_IDS).optional();

// A list_guides cursor is the zero-based position of the next page's first
// guide, as a plain decimal string. It is handed back as nextCursor and is only
// meaningful with the same filters it was issued for.
export const LIST_GUIDES_CURSOR_PATTERN = /^(0|[1-9][0-9]{0,5})$/;
export const LIST_GUIDES_DEFAULT_LIMIT = 25;
export const LIST_GUIDES_MAX_LIMIT = 50;

export const listGuidesInputSchema = z.object({
  jurisdiction,
  cluster,
  propertyType,
  era,
  buyingStage,
  includePillar: z.boolean().optional().default(false),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_GUIDES_MAX_LIMIT)
    .optional()
    .default(LIST_GUIDES_DEFAULT_LIMIT)
    .describe('Guides per page. Default 25, maximum 50.'),
  cursor: z
    .string()
    .regex(LIST_GUIDES_CURSOR_PATTERN)
    .optional()
    .describe('The nextCursor value from the previous page. Omit for the first page, and keep the same filters.'),
});

export const searchGuidesInputSchema = z.object({
  query: z.string().min(2).max(800).describe('The homebuyer question or issue to search for.'),
  jurisdiction: z.string().optional().describe('Optional state/territory code or name, such as WA, wa or Western Australia.'),
  propertyType,
  era,
  buyingStage,
  cluster,
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const getGuideInputSchema = z.object({
  slug: z.string().max(160).describe('Guide slug, for example reading-a-section-32. Use guides for the main hub.'),
  format: z
    .enum(['summary', 'full', 'sections'])
    .optional()
    .default('summary')
    .describe(
      'summary (default): the question, short answer, limitations, canonical URL and an index of the guide\'s sections by id and heading. sections: the markdown of the sections named in sectionIds, or every section when none are named. full: the complete guide, which on a long guide runs to tens of thousands of characters and can exhaust a small context.',
    ),
  sectionIds: z.array(z.string()).max(12).optional().describe('When format is sections, return only these section IDs. Take them from the sectionIndex a summary returns.'),
});

export const buildBuyerChecklistInputSchema = z.object({
  jurisdiction,
  propertyType,
  era,
  buyingStage,
  concerns: z.array(z.string().min(2).max(120)).max(10).optional().default([]),
  limit: z.number().int().min(4).max(20).optional().default(12),
});

// Shared result schemas are the machine contract for structuredContent. Keeping
// these next to the input contracts prevents the MCP registration, protocol
// tests and discovery metadata from drifting independently as the corpus grows.
const clusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  chip: z.string(),
  blurb: z.string(),
}).nullable();

const guideSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  markdown: z.string(),
});

const guideSourceSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  url: z.string(),
  accessed: z.string(),
});

const guideSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  question: z.string(),
  summary: z.string(),
  answer: z.string(),
  canonicalUrl: z.string(),
  resourceUri: z.string(),
  jurisdiction: z.array(z.string()),
  cluster: clusterSchema,
  topics: z.array(z.string()),
  propertyTypes: z.array(z.string()),
  eras: z.array(z.string()),
  buyingStages: z.array(z.string()),
  updatedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewDue: z.string().nullable(),
  wordCount: z.number().int().nullable(),
  readingTimeMin: z.number().int(),
  limitations: z.string().nullable(),
});

const guideRecordSchema = z.object({
  slug: z.string(),
  pillar: z.boolean(),
  resourceUri: z.string(),
  canonicalUrl: z.string(),
  question: z.string(),
  title: z.string(),
  summary: z.string(),
  answer: z.string(),
  updated: z.string(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewDue: z.string().nullable(),
  jurisdiction: z.array(z.string()),
  reviewedBy: z.string().nullable(),
  methodology: z.string().nullable(),
  limitations: z.string().nullable(),
  researchNote: z.string().nullable(),
  wordCount: z.number().int().nullable(),
  readingTimeMin: z.number().int(),
  cluster: clusterSchema,
  topics: z.array(z.string()),
  propertyTypes: z.array(z.string()),
  eras: z.array(z.string()),
  buyingStages: z.array(z.string()),
  sections: z.array(guideSectionSchema),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  checklistCandidates: z.array(z.object({ text: z.string(), section: z.string() })),
  sources: z.array(guideSourceSchema),
  related: z.array(z.string()),
  contentMarkdown: z.string(),
});

const matchedSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  snippet: z.string(),
  score: z.number(),
});

const searchResultSchema = z.object({
  slug: z.string(),
  title: z.string(),
  question: z.string(),
  summary: z.string(),
  answer: z.string(),
  canonicalUrl: z.string(),
  resourceUri: z.string(),
  jurisdiction: z.array(z.string()),
  cluster: clusterSchema,
  topics: z.array(z.string()),
  propertyTypes: z.array(z.string()),
  eras: z.array(z.string()),
  buyingStages: z.array(z.string()),
  updatedAt: z.string(),
  reviewedAt: z.string().nullable(),
  limitations: z.string().nullable(),
  score: z.number(),
  matchedTerms: z.array(z.string()),
  matchedSections: z.array(matchedSectionSchema),
});

const checklistProfileSchema = z.object({
  jurisdiction: z.string().optional(),
  propertyType: z.string().optional(),
  era: z.string().optional(),
  buyingStage: z.string().optional(),
  concerns: z.array(z.string()).optional(),
});

const buyerChecklistSchema = z.object({
  profile: checklistProfileSchema,
  guidanceBoundary: z.string(),
  matchedGuides: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    canonicalUrl: z.string(),
    answer: z.string(),
  })),
  items: z.array(z.object({
    check: z.string(),
    section: z.string(),
    guideSlug: z.string(),
    guideTitle: z.string(),
    canonicalUrl: z.string(),
  })),
});

// list_guides is a catalogue: it exists so a caller can see what is published
// and choose a slug. It is not a way to read the guides, and it never was
// advertised as one ("Returns metadata only").
//
// It previously returned the full shared summary for every guide in a single
// answer, so one unfiltered call carried every guide's answer, summary and
// limitations: around 99,000 characters to answer "what have you got?". Two
// things changed. Each row is now a catalogue entry rather than a summary, and
// the catalogue is returned a page at a time, so the size of an answer no
// longer grows with the corpus.
//
// The prose (summary, answer, limitations) belongs to get_guide and
// search_guides, which return it for the one guide that was asked for.
// cluster is carried as its id alone: the full cluster object repeats the same
// label, chip and blurb on every row that shares a cluster. The facets a
// caller filters BY (topics, propertyTypes, eras, buyingStages) are inputs to
// this tool and are not echoed back on every row.
const guideCatalogueEntrySchema = z.object({
  slug: z.string(),
  title: z.string(),
  question: z.string(),
  canonicalUrl: z.string(),
  cluster: z.string().nullable(),
  jurisdiction: z.array(z.string()),
  updatedAt: z.string(),
  readingTimeMin: z.number().int(),
});

// count is the number of guides in this page; total is how many match the
// filters across every page. nextCursor is always present: a string while more
// pages remain, null on the last page.
export const listGuidesOutputSchema = z.object({
  count: z.number().int().min(0),
  total: z.number().int().min(0),
  nextCursor: z.string().nullable(),
  generatedAt: z.string(),
  guides: z.array(guideCatalogueEntrySchema),
});

export const searchGuidesOutputSchema = z.object({
  query: z.string(),
  count: z.number().int().min(0),
  matchStrength: z.enum(['none', 'weak', 'strong']),
  results: z.array(searchResultSchema),
  boundary: z.string(),
});

const guideSectionsResultSchema = guideSummarySchema.extend({
  sections: z.array(guideSectionSchema),
});

// A summary carries an index of the guide's sections so a reader can ask for
// the one it needs by id, instead of pulling the whole guide to find out what
// is in it. The index is deliberately absent from the shared summary used by
// list_guides and search_guides, where it would repeat per result.
const guideSummaryWithIndexSchema = guideSummarySchema.extend({
  sectionIndex: z.array(z.object({ id: z.string(), heading: z.string() })),
});

export const getGuideOutputSchema = z.object({
  guide: z.union([
    guideSummaryWithIndexSchema,
    guideSummarySchema,
    guideSectionsResultSchema,
    guideRecordSchema,
  ]),
  warning: z.string().optional(),
  missingSectionIds: z.array(z.string()).optional(),
});

export const buildBuyerChecklistOutputSchema = z.object({
  checklist: buyerChecklistSchema,
});

const stringProperty = { type: 'string' } as const;
const clusterProperty = { type: 'string', enum: [...CLUSTER_IDS] } as const;

export const TOOL_CONTRACTS = {
  list_guides: {
    title: 'List Homechecker guides',
    description: 'List the published Homechecker guide catalogue a page at a time, optionally filtered by jurisdiction, guide cluster, property type, construction era, or buying stage. Returns catalogue metadata only: each entry carries the slug, title, the question the guide answers, its canonical URL, cluster, jurisdiction and when it was last updated. A page holds 25 guides by default (limit, up to 50); total is the number that match, and while more remain nextCursor carries the value to pass as cursor, with the same filters, for the next page. To read a guide, pass its slug to get_guide; to find the guide that answers a question, use search_guides.',
    inputSchema: listGuidesInputSchema,
    outputSchema: listGuidesOutputSchema,
    outputFields: ['count', 'total', 'nextCursor', 'generatedAt', 'guides'],
    jsonInputSchema: {
      type: 'object',
      properties: {
        jurisdiction: stringProperty,
        cluster: clusterProperty,
        propertyType: stringProperty,
        era: stringProperty,
        buyingStage: stringProperty,
        includePillar: { type: 'boolean', default: false },
        limit: { type: 'integer', minimum: 1, maximum: LIST_GUIDES_MAX_LIMIT, default: LIST_GUIDES_DEFAULT_LIMIT },
        cursor: { type: 'string', pattern: LIST_GUIDES_CURSOR_PATTERN.source },
      },
      additionalProperties: false,
    },
  },
  search_guides: {
    title: 'Search Homechecker guidance',
    description: 'Search professionally authored Australian homebuyer guidance using a natural-language question. Use this for general property, inspection, disclosure, apartment, condition, maintenance, era and buying-process questions. It does not assess an actual property.',
    inputSchema: searchGuidesInputSchema,
    outputSchema: searchGuidesOutputSchema,
    outputFields: ['query', 'count', 'matchStrength', 'results', 'boundary'],
    jsonInputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 2, maxLength: 800 },
        jurisdiction: stringProperty,
        propertyType: stringProperty,
        era: stringProperty,
        buyingStage: stringProperty,
        cluster: clusterProperty,
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  get_guide: {
    title: 'Get a Homechecker guide',
    description: 'Retrieve one canonical Homechecker guide by slug. Use a slug returned by list_guides or search_guides. By default a summary: the question the guide answers, its short answer, its limitations, the canonical URL, and an index of its sections by id and heading. Read the section you need with format sections and its id, rather than pulling the whole guide; format full returns the complete guide and on a long one runs to tens of thousands of characters. Source links, review metadata and method come with the guide. Carry the limitations through when relying on it: the guides are general Australian residential guidance and never describe the condition of a particular property.',
    inputSchema: getGuideInputSchema,
    outputSchema: getGuideOutputSchema,
    outputFields: ['guide', 'warning', 'missingSectionIds'],
    jsonInputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', maxLength: 160 },
        format: {
          type: 'string',
          enum: ['summary', 'full', 'sections'],
          default: 'summary',
          description:
            'summary (default): question, short answer, limitations, canonical URL and a section index. sections: the markdown of the sections in sectionIds, or all of them. full: the complete guide, tens of thousands of characters on a long guide.',
        },
        sectionIds: { type: 'array', items: { type: 'string' }, maxItems: 12 },
      },
      required: ['slug'],
      additionalProperties: false,
    },
  },
  build_buyer_checklist: {
    title: 'Build a Homechecker buyer checklist',
    description: 'Build a deterministic, sourced checklist from the Homechecker guide corpus for a buyer context. This assembles general questions and checks; it does not analyse a listing, document or actual building.',
    inputSchema: buildBuyerChecklistInputSchema,
    outputSchema: buildBuyerChecklistOutputSchema,
    outputFields: ['checklist'],
    jsonInputSchema: {
      type: 'object',
      properties: {
        jurisdiction: stringProperty,
        propertyType: stringProperty,
        era: stringProperty,
        buyingStage: stringProperty,
        concerns: { type: 'array', items: { type: 'string', minLength: 2, maxLength: 120 }, maxItems: 10, default: [] },
        limit: { type: 'integer', minimum: 4, maximum: 20, default: 12 },
      },
      additionalProperties: false,
    },
  },
} as const;

export type ToolName = keyof typeof TOOL_CONTRACTS;

// The Read note for the current request, or an empty string where Read links
// are switched off (the OpenAI endpoint and ChatGPT traffic).
export function readLinkNote(): string {
  return readLinksEnabled() ? READ_LINK_NOTE : '';
}

export function searchGuidanceBoundary(matchStrength: MatchStrength): string {
  if (matchStrength === 'none') {
    return 'No guide in this corpus addresses that question. Do not infer an answer from Homechecker guidance that was not returned.';
  }
  if (matchStrength === 'weak') {
    return `No guide strongly matches this question. Treat the results as background only, and say so rather than presenting them as an answer. Results are general guidance and do not establish the condition, compliance, liability or legal effect of anything at a specific property. ${readLinkNote()}`.trim();
  }
  // The guides are general; the Read is the property-specific next step.
  // Carrying the link here gives REST and tool callers the same hand-off the
  // MCP server instructions already describe.
  return `Results are general guidance and do not establish the condition, compliance, liability or legal effect of anything at a specific property. ${readLinkNote()}`.trim();
}
