import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireGet, sendJson } from '../src/http-json.js';
import {
  LEGACY_PROTOCOL_VERSION,
  MODERN_PROTOCOL_VERSION,
  SERVER_DESCRIPTION,
  SERVER_ENDPOINT_URL,
  SERVER_ICON_URL,
  SERVER_REGISTRY_NAME,
  SERVER_TITLE,
  SERVER_VERSION,
  SERVER_WEBSITE_URL,
} from '../src/identity.js';

const SERVER_CARD_SCHEMA = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  sendJson(res, 200, {
    $schema: SERVER_CARD_SCHEMA,
    name: SERVER_REGISTRY_NAME,
    version: SERVER_VERSION,
    title: SERVER_TITLE,
    description: SERVER_DESCRIPTION,
    websiteUrl: SERVER_WEBSITE_URL,
    repository: {
      url: 'https://github.com/Steven3265/homechecker-guides-mcp',
      source: 'github',
    },
    icons: [
      {
        src: SERVER_ICON_URL,
        mimeType: 'image/png',
        sizes: ['32x32'],
      },
    ],
    remotes: [
      {
        type: 'streamable-http',
        url: SERVER_ENDPOINT_URL,
        supportedProtocolVersions: [MODERN_PROTOCOL_VERSION, LEGACY_PROTOCOL_VERSION],
      },
    ],
    _meta: {
      'io.homechecker/discovery': {
        serviceMetadata: 'https://mcp.homechecker.com.au/server-card.json',
        openapi: 'https://mcp.homechecker.com.au/openapi.json',
        aiCatalogue: 'https://homechecker.com.au/.well-known/ard.json',
      },
    },
  }, 'public, max-age=300, s-maxage=3600', 'application/mcp-server-card+json; charset=utf-8');
}
