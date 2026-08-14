import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireGet, sendJson } from '../src/http-json.js';
import { SERVER_VERSION } from '../src/identity.js';

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
      '/v1/guides': { get: { operationId: 'listGuides', summary: 'List Homechecker guides', parameters: filterParameters(true), responses: okResponse('Guide catalogue') } },
      '/v1/search': { get: { operationId: 'searchGuides', summary: 'Search Homechecker guidance', parameters: [{ name: 'query', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 800 } }, ...filterParameters(false), { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10, default: 5 } }], responses: okResponse('Search results') } },
      '/v1/guide': { get: { operationId: 'getGuide', summary: 'Get one canonical Homechecker guide', parameters: [{ name: 'slug', in: 'query', required: true, schema: { type: 'string' } }], responses: { ...okResponse('Canonical guide'), '404': { description: 'Guide not found' } } } },
      '/v1/checklist': { get: { operationId: 'buildBuyerChecklist', summary: 'Build a sourced buyer checklist', parameters: [...filterParameters(false), { name: 'concern', in: 'query', schema: { type: 'array', items: { type: 'string' }, maxItems: 10 }, style: 'form', explode: true }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 4, maximum: 20, default: 12 } }], responses: okResponse('Buyer checklist') } },
    },
  });
}

function filterParameters(includeLimit: boolean): unknown[] {
  const fields = ['jurisdiction', 'cluster', 'propertyType', 'era', 'buyingStage'].map((name) => ({ name, in: 'query', required: false, schema: { type: 'string' } }));
  return includeLimit ? [...fields, { name: 'includePillar', in: 'query', schema: { type: 'boolean', default: false } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 100 } }] : fields;
}

function okResponse(description: string): Record<string, unknown> {
  return { '200': { description, content: { 'application/json': { schema: { type: 'object' } } } }, '400': { description: 'Invalid request' } };
}
