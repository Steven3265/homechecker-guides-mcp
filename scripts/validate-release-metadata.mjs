import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [packageText, serverText, identityText] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../server.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/identity.ts', import.meta.url), 'utf8'),
]);

const packageJson = JSON.parse(packageText);
const serverJson = JSON.parse(serverText);
const versionMatch = identityText.match(/SERVER_VERSION\s*=\s*'([^']+)'/);
const protocolMatch = identityText.match(/MODERN_PROTOCOL_VERSION\s*=\s*'([^']+)'/);

assert.ok(versionMatch, 'src/identity.ts must declare SERVER_VERSION');
assert.ok(protocolMatch, 'src/identity.ts must declare MODERN_PROTOCOL_VERSION');
assert.equal(packageJson.version, serverJson.version, 'package.json and server.json versions must match');
assert.equal(packageJson.version, versionMatch[1], 'package.json and MCP server identity versions must match');
assert.equal(protocolMatch[1], '2026-07-28', 'unexpected modern MCP protocol version');
assert.equal(
  serverJson.$schema,
  'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
  'server.json must use the current Registry schema',
);
// Registry field limits from the 2025-12-11 server.schema.json (description and
// title: maxLength 100; name: maxLength 200). The Registry API enforces these
// with a 422 at publish time; asserting them here keeps that failure inside CI.
assert.ok(serverJson.description.length > 0 && serverJson.description.length <= 100,
  `server.json description must be 1-100 characters (currently ${serverJson.description.length})`);
assert.ok(serverJson.title && serverJson.title.length <= 100, 'server.json title must be 1-100 characters');
assert.ok(serverJson.name.length <= 200, 'server.json name must be at most 200 characters');
assert.equal(serverJson.remotes?.[0]?.url, 'https://mcp.homechecker.com.au/mcp');
assert.equal(serverJson.remotes?.[0]?.type, 'streamable-http');

console.log(`Validated release metadata for ${packageJson.name} ${packageJson.version}.`);
