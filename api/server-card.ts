import type { IncomingMessage, ServerResponse } from 'node:http';
import { snapshot } from '../src/core.js';
import { requireGet, sendJson } from '../src/http-json.js';
import { MODERN_PROTOCOL_VERSION, SERVER_VERSION } from '../src/identity.js';

const clusterEnum = ['how-to-buy', 'state-rules', 'read-building', 'shared-buildings', 'own-change'];

const tools = [
  {
    name: 'list_guides',
    description: 'List published Homechecker guidance by jurisdiction, topic cluster, property type, era or buying stage.',
    inputSchema: {
      type: 'object',
      properties: {
        jurisdiction: { type: 'string' },
        cluster: { type: 'string', enum: clusterEnum },
        propertyType: { type: 'string' },
        era: { type: 'string' },
        buyingStage: { type: 'string' },
        includePillar: { type: 'boolean', default: false },
      },
    },
    readOnly: true,
  },
  {
    name: 'search_guides',
    description: 'Search the professionally authored Australian residential-property guide corpus with a natural-language question.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 2, maxLength: 800 },
        jurisdiction: { type: 'string' },
        propertyType: { type: 'string' },
        era: { type: 'string' },
        buyingStage: { type: 'string' },
        cluster: { type: 'string', enum: clusterEnum },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
      required: ['query'],
    },
    readOnly: true,
  },
  {
    name: 'get_guide',
    description: 'Retrieve one canonical Homechecker guide with review metadata, sources, method and limitations.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', maxLength: 160 },
        format: { type: 'string', enum: ['summary', 'full', 'sections'], default: 'full' },
        sectionIds: { type: 'array', items: { type: 'string' }, maxItems: 12 },
      },
      required: ['slug'],
    },
    readOnly: true,
  },
  {
    name: 'build_buyer_checklist',
    description: 'Build a deterministic sourced checklist from the guide corpus for a buyer context.',
    inputSchema: {
      type: 'object',
      properties: {
        jurisdiction: { type: 'string' },
        propertyType: { type: 'string' },
        era: { type: 'string' },
        buyingStage: { type: 'string' },
        concerns: { type: 'array', items: { type: 'string', minLength: 2, maxLength: 120 }, maxItems: 10 },
        limit: { type: 'integer', minimum: 4, maximum: 20, default: 12 },
      },
    },
    readOnly: true,
  },
];

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  sendJson(res, 200, {
    name: 'Homechecker Guides',
    version: SERVER_VERSION,
    description: "Professionally authored Australian residential-property guidance for buyers and owners.",
    tools,
    protocol: {
      name: 'Model Context Protocol',
      version: MODERN_PROTOCOL_VERSION,
      transport: 'streamable-http',
      endpoint: 'https://mcp.homechecker.com.au/mcp',
      authentication: 'none',
    },
    publisher: {
      name: 'Homechecker by Moyne Ross',
      website: 'https://homechecker.com.au',
      aiDocumentation: 'https://homechecker.com.au/ai',
      repository: 'https://github.com/Steven3265/homechecker-guides-mcp',
    },
    capabilities: {
      tools: tools.map(({ name, description, readOnly }) => ({ name, description, readOnly })),
      resources: true,
      deterministicSnapshot: true,
      readOnly: true,
      openWorld: false,
    },
    corpus: {
      guides: snapshot.source.contentCount,
      latestGuideUpdate: snapshot.source.latestUpdated,
      catalogue: 'https://homechecker.com.au/guides/export.json',
    },
    interfaces: {
      rest: 'https://mcp.homechecker.com.au/v1',
      openapi: 'https://mcp.homechecker.com.au/openapi.json',
      ard: 'https://homechecker.com.au/.well-known/ai-catalog.json',
    },
    privacy: {
      rawQuestionsLogged: false,
      ipAddressesLoggedByApplication: false,
      sessionIdentifiersLoggedByApplication: false,
      identifyingRequestHeadersLoggedByApplication: false,
      protocolMethodHeaderLoggedByApplication: true,
      operationalTelemetry: 'Mcp-Method protocol method, tool name, query length, filters, counts, match strength, outcome and duration where applicable',
    },
    boundaries: [
      'General guidance only; does not inspect or assess a specific property.',
      'Does not provide legal, engineering, valuation, tax or financial advice.',
      'Does not access customer data or modify any external system.',
    ],
  }, undefined, 'application/mcp-server-card+json; charset=utf-8');
}
