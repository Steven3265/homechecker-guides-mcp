import type { IncomingMessage, ServerResponse } from 'node:http';
import { snapshot } from '../src/core.js';
import { TOOL_CONTRACTS } from '../src/contracts.js';
import { requireGet, sendJson } from '../src/http-json.js';
import { MODERN_PROTOCOL_VERSION, SERVER_VERSION } from '../src/identity.js';

const tools = Object.entries(TOOL_CONTRACTS).map(([name, contract]) => ({
  name,
  description: contract.description,
  inputSchema: contract.jsonInputSchema,
  readOnly: true,
}));

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  sendJson(res, 200, {
    name: 'Homechecker Guides',
    version: SERVER_VERSION,
    description: 'Professionally authored Australian residential-property guidance for buyers and owners.',
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
      snapshotGeneratedAt: snapshot.generatedAt,
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
