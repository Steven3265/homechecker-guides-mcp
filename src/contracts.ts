import * as z from 'zod/v4';

export const CLUSTER_IDS = ['how-to-buy', 'state-rules', 'read-building', 'shared-buildings', 'own-change'] as const;
export type ClusterId = (typeof CLUSTER_IDS)[number];
export type MatchStrength = 'none' | 'weak' | 'strong';

const jurisdiction = z.string().optional().describe('Australia or a state/territory code or name, such as VIC, vic or Victoria.');
const propertyType = z.string().optional().describe('For example house, apartment, or townhouse or unit.');
const era = z.string().optional().describe('For example pre-1920s, 1950s-1970s, or 2000s-on.');
const buyingStage = z.string().optional().describe('For example research, contract review, physical inspection, ownership, or selling.');
const cluster = z.enum(CLUSTER_IDS).optional();

export const listGuidesInputSchema = z.object({
  jurisdiction,
  cluster,
  propertyType,
  era,
  buyingStage,
  includePillar: z.boolean().optional().default(false),
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
  format: z.enum(['summary', 'full', 'sections']).optional().default('full'),
  sectionIds: z.array(z.string()).max(12).optional().describe('When format is sections, return only these section IDs.'),
});

export const buildBuyerChecklistInputSchema = z.object({
  jurisdiction,
  propertyType,
  era,
  buyingStage,
  concerns: z.array(z.string().min(2).max(120)).max(10).optional().default([]),
  limit: z.number().int().min(4).max(20).optional().default(12),
});

const stringProperty = { type: 'string' } as const;
const clusterProperty = { type: 'string', enum: [...CLUSTER_IDS] } as const;

export const TOOL_CONTRACTS = {
  list_guides: {
    title: 'List Homechecker guides',
    description: 'List the published Homechecker guide catalogue, optionally filtered by jurisdiction, guide cluster, property type, construction era, or buying stage. Returns metadata only.',
    inputSchema: listGuidesInputSchema,
    jsonInputSchema: {
      type: 'object',
      properties: {
        jurisdiction: stringProperty,
        cluster: clusterProperty,
        propertyType: stringProperty,
        era: stringProperty,
        buyingStage: stringProperty,
        includePillar: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
  },
  search_guides: {
    title: 'Search Homechecker guidance',
    description: 'Search professionally authored Australian homebuyer guidance using a natural-language question. Use this for general property, inspection, disclosure, apartment, condition, maintenance, era and buying-process questions. It does not assess an actual property.',
    inputSchema: searchGuidesInputSchema,
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
    description: 'Retrieve one canonical Homechecker guide by slug. Use a slug returned by list_guides or search_guides. Returns source links, review metadata, method and limitations with the guide.',
    inputSchema: getGuideInputSchema,
    jsonInputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', maxLength: 160 },
        format: { type: 'string', enum: ['summary', 'full', 'sections'], default: 'full' },
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

export function searchGuidanceBoundary(matchStrength: MatchStrength): string {
  if (matchStrength === 'none') {
    return 'No guide in this corpus addresses that question. Do not infer an answer from Homechecker guidance that was not returned.';
  }
  if (matchStrength === 'weak') {
    return 'No guide strongly matches this question. Treat the results as background only, and say so rather than presenting them as an answer. Results are general guidance and do not establish the condition, compliance, liability or legal effect of anything at a specific property.';
  }
  return 'Results are general guidance and do not establish the condition, compliance, liability or legal effect of anything at a specific property.';
}
