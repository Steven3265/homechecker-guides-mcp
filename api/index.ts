import type { IncomingMessage, ServerResponse } from 'node:http';
import { snapshot } from '../src/core.js';
import { requireGet, sendJson } from '../src/http-json.js';
import { MODERN_PROTOCOL_VERSION, SERVER_VERSION } from '../src/identity.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  sendJson(res, 200, {
    name: 'Homechecker Guides MCP',
    version: SERVER_VERSION,
    protocol: MODERN_PROTOCOL_VERSION,
    description: "Homechecker's professionally authored Australian residential-property guides: search, cite, build checklists.",
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      serverCard: '/server-card.json',
      openapi: '/openapi.json',
      rest: {
        guides: '/v1/guides',
        search: '/v1/search',
        guide: '/v1/guide',
        checklist: '/v1/checklist',
      },
    },
    discovery: {
      ard: 'https://homechecker.com.au/.well-known/ai-catalog.json',
      llms: 'https://homechecker.com.au/llms.txt',
      aiDocumentation: 'https://homechecker.com.au/ai',
      repository: 'https://github.com/Steven3265/homechecker-guides-mcp',
    },
    guides: snapshot.source.contentCount,
    latestGuideUpdate: snapshot.source.latestUpdated,
    canonicalSite: snapshot.source.baseUrl,
  });
}
