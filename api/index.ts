import type { IncomingMessage, ServerResponse } from 'node:http';
import { snapshot } from '../src/core.js';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify({
    name: 'Homechecker Guides MCP',
    description: 'Read-only Australian homebuyer guidance from Homechecker.',
    mcpEndpoint: '/mcp',
    healthEndpoint: '/health',
    guides: snapshot.source.contentCount,
    latestGuideUpdate: snapshot.source.latestUpdated,
    canonicalSite: snapshot.source.baseUrl,
  }));
}
