import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireGet, sendJson } from '../src/http-json.js';

// The AI Catalog for this host (the MCP server-card working group's discovery
// draft): where a client that knows only mcp.homechecker.com.au finds the
// server card and the agent skills. Entries carry identifier, type and url;
// titles and descriptions live in the documents themselves, so nothing here
// can drift from them.
const BODY = {
  specVersion: '1.0',
  host: {
    displayName: 'Homechecker',
    identifier: 'homechecker.com.au',
    documentationUrl: 'https://homechecker.com.au/ai',
  },
  entries: [
    {
      identifier: 'urn:air:homechecker.com.au:server:homechecker-guides',
      type: 'application/mcp-server-card+json',
      url: 'https://mcp.homechecker.com.au/mcp/server-card',
    },
    {
      identifier: 'urn:air:homechecker.com.au:skill:australian-homebuyer-due-diligence',
      type: 'application/ai-skill+md',
      url: 'https://mcp.homechecker.com.au/skills/australian-homebuyer-due-diligence/SKILL.md',
    },
    {
      identifier: 'urn:air:homechecker.com.au:skill:australian-property-documents',
      type: 'application/ai-skill+md',
      url: 'https://mcp.homechecker.com.au/skills/australian-property-documents/SKILL.md',
    },
    {
      identifier: 'urn:air:homechecker.com.au:skill:australian-building-risk-reader',
      type: 'application/ai-skill+md',
      url: 'https://mcp.homechecker.com.au/skills/australian-building-risk-reader/SKILL.md',
    },
    {
      identifier: 'urn:air:homechecker.com.au:skill:australian-home-ownership-planner',
      type: 'application/ai-skill+md',
      url: 'https://mcp.homechecker.com.au/skills/australian-home-ownership-planner/SKILL.md',
    },
  ],
};
const ETAG = `"${createHash('sha256').update(JSON.stringify(BODY)).digest('hex').slice(0, 16)}"`;

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  res.setHeader('ETag', ETAG);
  if (req.headers['if-none-match'] === ETAG) {
    res.statusCode = 304;
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.end();
    return;
  }
  sendJson(res, 200, BODY, 'public, max-age=3600, s-maxage=3600', 'application/ai-catalog+json; charset=utf-8');
}
