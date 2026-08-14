import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [packageText, serverText, identityText, glamaText, contentTermsText, claudePluginText, claudeMcpText, agentPluginText, agentPluginMcpText, copilotMarketplaceText] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../server.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/identity.ts', import.meta.url), 'utf8'),
  readFile(new URL('../glama.json', import.meta.url), 'utf8'),
  readFile(new URL('../data/TERMS.md', import.meta.url), 'utf8'),
  readFile(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'),
  readFile(new URL('../.mcp.json', import.meta.url), 'utf8'),
  readFile(new URL('../plugin.json', import.meta.url), 'utf8'),
  readFile(new URL('../mcp.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/plugin/marketplace.json', import.meta.url), 'utf8'),
]);

const packageJson = JSON.parse(packageText);
const serverJson = JSON.parse(serverText);
const glamaJson = JSON.parse(glamaText);
const claudePlugin = JSON.parse(claudePluginText);
const claudeMcp = JSON.parse(claudeMcpText);
const agentPlugin = JSON.parse(agentPluginText);
const agentPluginMcp = JSON.parse(agentPluginMcpText);
const copilotMarketplace = JSON.parse(copilotMarketplaceText);
const versionMatch = identityText.match(/SERVER_VERSION\s*=\s*'([^']+)'/);
const protocolMatch = identityText.match(/MODERN_PROTOCOL_VERSION\s*=\s*'([^']+)'/);

const skillNames = [
  'australian-homebuyer-due-diligence',
  'australian-property-documents',
  'australian-building-risk-reader',
  'australian-home-ownership-planner',
];
for (const name of skillNames) {
  const [canonical, publicCopy, openaiCopy, agentFinderText] = await Promise.all([
    readFile(new URL(`../skills/${name}/SKILL.md`, import.meta.url), 'utf8'),
    readFile(new URL(`../public/skills/${name}/SKILL.md`, import.meta.url), 'utf8'),
    readFile(new URL(`../distribution/openai/homechecker/skills/${name}/SKILL.md`, import.meta.url), 'utf8'),
    readFile(new URL(`../distribution/github-agentfinder/Steven3265/${name}.json`, import.meta.url), 'utf8'),
  ]);
  assert.equal(publicCopy, canonical, `${name}: public SKILL.md drifted from canonical skills/ copy`);
  assert.equal(openaiCopy, canonical, `${name}: OpenAI SKILL.md drifted from canonical skills/ copy`);

  // GitHub Agent Finder deliberately uses its contributor schema here rather
  // than ARD's urn:air/type field names. Agent Finder generates its ARD
  // ingestion catalogue from these source records.
  const agentFinder = JSON.parse(agentFinderText);
  assert.match(agentFinder.identifier, /^urn:ai:github\.com:Steven3265:homechecker-guides-mcp:/, `${name}: unexpected Agent Finder identifier`);
  assert.equal(agentFinder.mediaType, 'application/ai-skill', `${name}: unexpected Agent Finder mediaType`);
  assert.equal(agentFinder.metadata?.sourceSet, 'homechecker-guides-mcp');
  assert.equal(agentFinder.metadata?.repoPath, `skills/${name}/SKILL.md`);
}


assert.ok(versionMatch, 'src/identity.ts must declare SERVER_VERSION');
assert.ok(protocolMatch, 'src/identity.ts must declare MODERN_PROTOCOL_VERSION');

assert.equal(packageJson.license, 'MIT', 'package.json must expose the code licence in SPDX form');
assert.equal(glamaJson.$schema, 'https://glama.ai/mcp/schemas/server.json');
assert.deepEqual(glamaJson.maintainers, ['Steven3265']);
assert.match(contentTermsText, /data\/guides\.json/, 'content terms must explicitly cover the bundled guide snapshot');
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
assert.equal(claudePlugin.version, packageJson.version, 'Claude plugin and package versions must match');
assert.equal(claudePlugin.mcpServers, './.mcp.json');
assert.equal(claudeMcp.mcpServers?.['homechecker-guides']?.url, 'https://mcp.homechecker.com.au/mcp');
assert.equal(claudeMcp.mcpServers?.['homechecker-guides']?.type, 'http');
assert.equal(agentPlugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
assert.equal(agentPlugin.name, 'homechecker');
assert.equal(agentPlugin.version, packageJson.version, 'Agent Plugins manifest and package versions must match');
assert.equal(agentPluginMcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
assert.equal(agentPluginMcp.mcpServers?.['homechecker-guides']?.type, 'streamable-http');
assert.equal(agentPluginMcp.mcpServers?.['homechecker-guides']?.url, 'https://mcp.homechecker.com.au/mcp');

assert.equal(copilotMarketplace.name, 'homechecker');
assert.equal(copilotMarketplace.metadata?.version, packageJson.version, 'Copilot marketplace and package versions must match');
assert.equal(copilotMarketplace.plugins?.length, 1, 'Copilot marketplace must expose exactly one Homechecker plugin');
assert.equal(copilotMarketplace.plugins?.[0]?.name, 'homechecker');
assert.equal(copilotMarketplace.plugins?.[0]?.version, packageJson.version);
assert.equal(copilotMarketplace.plugins?.[0]?.source, '.');

console.log(`Validated release metadata for ${packageJson.name} ${packageJson.version}.`);
