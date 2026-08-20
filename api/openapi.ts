import type { IncomingMessage, ServerResponse } from 'node:http';
import { TOOL_CONTRACTS } from '../src/contracts.js';
import { requireGet, sendJson } from '../src/http-json.js';
import { SERVER_VERSION } from '../src/identity.js';

type Schema = Record<string, unknown>;

const listProps = TOOL_CONTRACTS.list_guides.jsonInputSchema.properties;
const searchProps = TOOL_CONTRACTS.search_guides.jsonInputSchema.properties;
const guideProps = TOOL_CONTRACTS.get_guide.jsonInputSchema.properties;
const checklistProps = TOOL_CONTRACTS.build_buyer_checklist.jsonInputSchema.properties;

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  sendJson(res, 200, {
    openapi: '3.1.0',
    info: {
      title: 'Homechecker Guides Read API',
      version: SERVER_VERSION,
      description: 'Read-only HTTP access to the same professionally authored Australian residential-property guide snapshot exposed by the Homechecker MCP server.',
      contact: { name: 'Homechecker', url: 'https://homechecker.com.au/ai' },
      license: { name: 'MIT (server code); guide content subject to Homechecker content terms', url: 'https://github.com/Steven3265/homechecker-guides-mcp/blob/main/data/TERMS.md' },
    },
    servers: [{ url: 'https://mcp.homechecker.com.au' }],
    paths: {
      '/v1/guides': {
        get: {
          operationId: 'listGuides',
          summary: 'List Homechecker guides',
          parameters: [
            queryParameter('jurisdiction', listProps.jurisdiction),
            queryParameter('cluster', listProps.cluster),
            queryParameter('propertyType', listProps.propertyType),
            queryParameter('era', listProps.era),
            queryParameter('buyingStage', listProps.buyingStage),
            queryParameter('includePillar', listProps.includePillar),
            queryParameter('limit', { type: 'integer', minimum: 1, maximum: 100, default: 100 }),
          ],
          responses: responses('Guide catalogue', 'GuidesResponse'),
        },
      },
      '/v1/search': {
        get: {
          operationId: 'searchGuides',
          summary: 'Search Homechecker guidance',
          parameters: [
            queryParameter('query', searchProps.query, true),
            queryParameter('jurisdiction', searchProps.jurisdiction),
            queryParameter('propertyType', searchProps.propertyType),
            queryParameter('era', searchProps.era),
            queryParameter('buyingStage', searchProps.buyingStage),
            queryParameter('cluster', searchProps.cluster),
            queryParameter('limit', searchProps.limit),
          ],
          responses: responses('Search results', 'SearchResponse'),
        },
      },
      '/v1/guide': {
        get: {
          operationId: 'getGuide',
          summary: 'Get one canonical Homechecker guide',
          parameters: [queryParameter('slug', guideProps.slug, true)],
          responses: {
            ...responses('Canonical guide', 'GuideResponse'),
            '404': jsonResponse('Guide not found', 'Error'),
          },
        },
      },
      '/v1/checklist': {
        get: {
          operationId: 'buildBuyerChecklist',
          summary: 'Build a sourced buyer checklist',
          parameters: [
            queryParameter('jurisdiction', checklistProps.jurisdiction),
            queryParameter('propertyType', checklistProps.propertyType),
            queryParameter('era', checklistProps.era),
            queryParameter('buyingStage', checklistProps.buyingStage),
            { ...queryParameter('concern', checklistProps.concerns), style: 'form', explode: true },
            queryParameter('limit', checklistProps.limit),
          ],
          responses: responses('Buyer checklist', 'ChecklistResponse'),
        },
      },
    },
    components: { schemas: schemas() },
  });
}

function queryParameter(name: string, schema: Schema, required = false): Record<string, unknown> {
  return { name, in: 'query', required, schema };
}

function jsonResponse(description: string, schemaName: string): Record<string, unknown> {
  return {
    description,
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } },
  };
}

function responses(description: string, schemaName: string): Record<string, unknown> {
  return {
    '200': jsonResponse(description, schemaName),
    '400': jsonResponse('Invalid request', 'Error'),
  };
}

function schemas(): Record<string, unknown> {
  const nullableString = { type: ['string', 'null'] };
  const stringArray = { type: 'array', items: { type: 'string' } };
  const canonicalFields = {
    canonicalUrl: { type: 'string', format: 'uri' },
    referralUrl: { type: 'string', format: 'uri' },
  };
  const guideSummaryRequired = [
    'slug', 'title', 'question', 'summary', 'answer', 'canonicalUrl', 'referralUrl', 'resourceUri',
    'jurisdiction', 'cluster', 'topics', 'propertyTypes', 'eras', 'buyingStages', 'updatedAt',
    'reviewedAt', 'reviewDue', 'wordCount', 'readingTimeMin', 'limitations',
  ];
  const guideSummaryProperties = {
    slug: { type: 'string' },
    title: { type: 'string' },
    question: { type: 'string' },
    summary: { type: 'string' },
    answer: { type: 'string' },
    ...canonicalFields,
    resourceUri: { type: 'string' },
    jurisdiction: stringArray,
    cluster: { $ref: '#/components/schemas/Cluster' },
    topics: stringArray,
    propertyTypes: stringArray,
    eras: stringArray,
    buyingStages: stringArray,
    updatedAt: { type: 'string', format: 'date' },
    reviewedAt: nullableString,
    reviewDue: nullableString,
    wordCount: { type: 'integer', minimum: 1 },
    readingTimeMin: { type: 'integer', minimum: 1 },
    limitations: nullableString,
  };
  const searchResultRequired = [
    'slug', 'title', 'question', 'summary', 'answer', 'canonicalUrl', 'referralUrl', 'resourceUri',
    'jurisdiction', 'cluster', 'topics', 'propertyTypes', 'eras', 'buyingStages', 'updatedAt',
    'reviewedAt', 'limitations', 'score', 'matchedTerms', 'matchedSections',
  ];
  const searchResultProperties = {
    slug: { type: 'string' },
    title: { type: 'string' },
    question: { type: 'string' },
    summary: { type: 'string' },
    answer: { type: 'string' },
    ...canonicalFields,
    resourceUri: { type: 'string' },
    jurisdiction: stringArray,
    cluster: { $ref: '#/components/schemas/Cluster' },
    topics: stringArray,
    propertyTypes: stringArray,
    eras: stringArray,
    buyingStages: stringArray,
    updatedAt: { type: 'string', format: 'date' },
    reviewedAt: nullableString,
    limitations: nullableString,
    score: { type: 'number' },
    matchedTerms: stringArray,
    matchedSections: { type: 'array', items: { $ref: '#/components/schemas/MatchedSection' } },
  };

  return {
    Error: {
      type: 'object',
      required: ['error'],
      properties: { error: { type: 'string' }, slug: { type: 'string' } },
      additionalProperties: true,
    },
    Cluster: {
      anyOf: [
        {
          type: 'object',
          required: ['id', 'label', 'chip', 'blurb'],
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            chip: { type: 'string' },
            blurb: { type: 'string' },
          },
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    GuideSummary: {
      type: 'object',
      required: guideSummaryRequired,
      properties: guideSummaryProperties,
      additionalProperties: false,
    },
    GuideSection: {
      type: 'object',
      required: ['id', 'heading', 'markdown'],
      properties: { id: { type: 'string' }, heading: { type: 'string' }, markdown: { type: 'string' } },
      additionalProperties: false,
    },
    GuideFaq: {
      type: 'object',
      required: ['question', 'answer'],
      properties: { question: { type: 'string' }, answer: { type: 'string' } },
      additionalProperties: false,
    },
    GuideSource: {
      type: 'object',
      required: ['title', 'publisher', 'url', 'accessed'],
      properties: {
        title: { type: 'string' },
        publisher: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        accessed: { type: 'string', format: 'date' },
      },
      additionalProperties: false,
    },
    GuideDetail: {
      type: 'object',
      required: [...guideSummaryRequired, 'sections', 'faqs', 'sources', 'contentMarkdown'],
      properties: {
        ...guideSummaryProperties,
        sections: { type: 'array', items: { $ref: '#/components/schemas/GuideSection' } },
        faqs: { type: 'array', items: { $ref: '#/components/schemas/GuideFaq' } },
        sources: { type: 'array', items: { $ref: '#/components/schemas/GuideSource' } },
        contentMarkdown: { type: 'string' },
      },
      additionalProperties: false,
    },
    GuidesResponse: {
      type: 'object',
      required: ['generatedAt', 'count', 'guides'],
      properties: {
        generatedAt: { type: 'string', format: 'date-time' },
        count: { type: 'integer', minimum: 0 },
        guides: { type: 'array', items: { $ref: '#/components/schemas/GuideSummary' } },
      },
      additionalProperties: false,
    },
    MatchedSection: {
      type: 'object',
      required: ['id', 'heading', 'snippet', 'score'],
      properties: { id: { type: 'string' }, heading: { type: 'string' }, snippet: { type: 'string' }, score: { type: 'number' } },
      additionalProperties: false,
    },
    SearchResult: {
      type: 'object',
      required: searchResultRequired,
      properties: searchResultProperties,
      additionalProperties: false,
    },
    SearchResponse: {
      type: 'object',
      required: ['query', 'count', 'matchStrength', 'results', 'boundary'],
      properties: {
        query: { type: 'string' },
        count: { type: 'integer', minimum: 0 },
        matchStrength: { type: 'string', enum: ['none', 'weak', 'strong'] },
        results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
        boundary: { type: 'string' },
      },
      additionalProperties: false,
    },
    GuideResponse: {
      type: 'object',
      required: ['guide'],
      properties: { guide: { $ref: '#/components/schemas/GuideDetail' } },
      additionalProperties: false,
    },
    ChecklistProfile: {
      type: 'object',
      properties: {
        jurisdiction: { type: 'string' },
        propertyType: { type: 'string' },
        era: { type: 'string' },
        buyingStage: { type: 'string' },
        concerns: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    ChecklistGuide: {
      type: 'object',
      required: ['slug', 'title', 'canonicalUrl', 'referralUrl', 'answer'],
      properties: { slug: { type: 'string' }, title: { type: 'string' }, ...canonicalFields, answer: { type: 'string' } },
      additionalProperties: false,
    },
    ChecklistItem: {
      type: 'object',
      required: ['check', 'section', 'guideSlug', 'guideTitle', 'canonicalUrl', 'referralUrl'],
      properties: {
        check: { type: 'string' },
        section: { type: 'string' },
        guideSlug: { type: 'string' },
        guideTitle: { type: 'string' },
        ...canonicalFields,
      },
      additionalProperties: false,
    },
    BuyerChecklist: {
      type: 'object',
      required: ['profile', 'guidanceBoundary', 'matchedGuides', 'items'],
      properties: {
        profile: { $ref: '#/components/schemas/ChecklistProfile' },
        guidanceBoundary: { type: 'string' },
        matchedGuides: { type: 'array', items: { $ref: '#/components/schemas/ChecklistGuide' } },
        items: { type: 'array', items: { $ref: '#/components/schemas/ChecklistItem' } },
      },
      additionalProperties: false,
    },
    ChecklistResponse: {
      type: 'object',
      required: ['checklist'],
      properties: { checklist: { $ref: '#/components/schemas/BuyerChecklist' } },
      additionalProperties: false,
    },
  };
}
