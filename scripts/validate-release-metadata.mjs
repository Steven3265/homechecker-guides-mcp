import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  packageText,
  serverText,
  identityText,
  glamaText,
  contentTermsText,
  readmeText,
  claudePluginText,
  claudeMarketplaceText,
  claudeMcpText,
  agentPluginText,
  agentPluginMcpText,
  copilotMarketplaceText,
  openaiPluginText,
  validateWorkflowText,
  refreshWorkflowText,
  publishWorkflowText,
  conformanceWorkflowText,
  conformanceBaselineText,
  dependabotText,
  mcpServerCardText,
  vercelText,
  iconBytes,
] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../server.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/identity.ts', import.meta.url), 'utf8'),
  readFile(new URL('../glama.json', import.meta.url), 'utf8'),
  readFile(new URL('../data/TERMS.md', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'),
  readFile(new URL('../.claude-plugin/marketplace.json', import.meta.url), 'utf8'),
  readFile(new URL('../.mcp.json', import.meta.url), 'utf8'),
  readFile(new URL('../plugin.json', import.meta.url), 'utf8'),
  readFile(new URL('../mcp.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/plugin/marketplace.json', import.meta.url), 'utf8'),
  readFile(new URL('../distribution/openai/homechecker/.codex-plugin/plugin.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/validate-release.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/refresh-snapshot.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/publish-registry.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/conformance.yml', import.meta.url), 'utf8'),
  readFile(new URL('../conformance/expected-failures.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'),
  readFile(new URL('../api/mcp-server-card.ts', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/homechecker-icon-32.png', import.meta.url)),
]);

const packageJson = JSON.parse(packageText);
const serverJson = JSON.parse(serverText);
const vercelJson = JSON.parse(vercelText);
const glamaJson = JSON.parse(glamaText);
const claudePlugin = JSON.parse(claudePluginText);
const claudeMarketplace = JSON.parse(claudeMarketplaceText);
const claudeMcp = JSON.parse(claudeMcpText);
const agentPlugin = JSON.parse(agentPluginText);
const agentPluginMcp = JSON.parse(agentPluginMcpText);
const copilotMarketplace = JSON.parse(copilotMarketplaceText);
const openaiPlugin = JSON.parse(openaiPluginText);
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
assert.match(contentTermsText, /Steven McCormack \(ABN 18 890 160 412\)/, 'content terms must identify the current operator');
assert.doesNotMatch(contentTermsText, /Moyne Ross Pty Ltd/, 'content terms must not identify the unformed company as operator');
assert.doesNotMatch(readmeText, /Moyne Ross Pty Ltd/, 'README must not identify the unformed company as operator');

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
assert.equal(serverJson.icons?.[0]?.src, 'https://mcp.homechecker.com.au/homechecker-icon-32.png');
assert.equal(serverJson.icons?.[0]?.mimeType, 'image/png');
assert.deepEqual(serverJson.icons?.[0]?.sizes, ['32x32']);
if (serverJson.repository?.id !== undefined) {
  assert.match(String(serverJson.repository.id), /^\d+$/, 'GitHub repository.id must be the immutable numeric repository ID');
}
assert.ok(iconBytes.length > 100, 'Homechecker MCP icon must be bundled');
assert.deepEqual([...iconBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Homechecker MCP icon must be a PNG');

assert.match(mcpServerCardText, /server-card\.schema\.json/, 'standards-track MCP server card must declare the v1 schema');
assert.match(mcpServerCardText, /supportedProtocolVersions/, 'MCP server card must advertise supported protocol versions');
assert.doesNotMatch(mcpServerCardText, /TOOL_CONTRACTS/, 'standards-track MCP server card must leave tool discovery to MCP runtime discovery');
assert.ok(vercelJson.rewrites.some((rewrite) => rewrite.source === '/mcp/server-card' && rewrite.destination === '/api/mcp-server-card'), 'Vercel must route the standards-track MCP server card');

assert.equal(claudePlugin.version, packageJson.version, 'Claude plugin and package versions must match');
assert.equal(claudePlugin.mcpServers, './.mcp.json');
assert.equal(claudeMarketplace.plugins?.[0]?.version, packageJson.version, 'Claude marketplace and package versions must match');
assert.equal(claudeMcp.mcpServers?.['homechecker-guides']?.url, 'https://mcp.homechecker.com.au/mcp');
assert.equal(claudeMcp.mcpServers?.['homechecker-guides']?.type, 'http');
assert.equal(agentPlugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
assert.equal(agentPlugin.name, 'homechecker');
assert.equal(agentPlugin.version, packageJson.version, 'Agent Plugins manifest and package versions must match');
assert.equal(agentPluginMcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
assert.equal(agentPluginMcp.mcpServers?.['homechecker-guides']?.type, 'streamable-http');
assert.equal(agentPluginMcp.mcpServers?.['homechecker-guides']?.url, 'https://mcp.homechecker.com.au/mcp');
assert.equal(openaiPlugin.version, packageJson.version, 'OpenAI plugin package and root package versions must match');

assert.equal(copilotMarketplace.name, 'homechecker');
assert.equal(copilotMarketplace.metadata?.version, packageJson.version, 'Copilot marketplace and package versions must match');
assert.equal(copilotMarketplace.plugins?.length, 1, 'Copilot marketplace must expose exactly one Homechecker plugin');
assert.equal(copilotMarketplace.plugins?.[0]?.name, 'homechecker');
assert.equal(copilotMarketplace.plugins?.[0]?.version, packageJson.version);
assert.equal(copilotMarketplace.plugins?.[0]?.source, '.');

const checkoutPin = 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
const setupNodePin = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
for (const [name, workflow] of [
  ['validate-release', validateWorkflowText],
  ['refresh-snapshot', refreshWorkflowText],
  ['publish-registry', publishWorkflowText],
  ['conformance', conformanceWorkflowText],
]) {
  assert.match(workflow, new RegExp(checkoutPin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} must pin checkout by immutable SHA`);
  assert.match(workflow, new RegExp(setupNodePin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} must pin setup-node by immutable SHA`);
  assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v\d+/i, `${name} must not float GitHub Action major tags`);
  assert.match(workflow, /runs-on:\s+ubuntu-24\.04/, `${name} must pin the hosted runner image`);
}
assert.match(refreshWorkflowText, /cron:\s*'17 18 \* \* \*'/, 'snapshot refresh must run daily as well as manually');
assert.match(publishWorkflowText, /MCP_PUBLISHER_VERSION:\s+v1\.8\.1/, 'Registry publisher version must be pinned');
assert.match(publishWorkflowText, /MCP_PUBLISHER_SHA256:\s+a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc/, 'Registry publisher checksum must be pinned');
assert.match(publishWorkflowText, /sha256sum --check --strict/, 'Registry publisher archive must be checksum-verified before execution');
const conformanceCommit = 'c321dd32035556e6769d3724a8ee97d87c3faaac';
assert.match(conformanceWorkflowText, new RegExp(conformanceCommit), 'MCP conformance source must be pinned to the reviewed alpha.11 release commit');
assert.match(conformanceWorkflowText, /npm ci && npm run build/, 'pinned MCP conformance source must build from its committed lockfile');
assert.match(conformanceWorkflowText, /Deliberate exception to this repo's --ignore-scripts policy/, 'conformance lifecycle-script exception must remain explicitly documented');
assert.doesNotMatch(conformanceWorkflowText, /npx\s+--yes|npx\s+-y/, 'MCP conformance CI must not fetch an executable through npx at runtime');
assert.match(conformanceWorkflowText, /--spec-version 2026-07-28/, 'MCP conformance must target the current frozen protocol revision');
assert.match(conformanceWorkflowText, /--suite active/, 'MCP conformance must run the active server suite');
assert.match(conformanceWorkflowText, /--expected-failures conformance\/expected-failures\.yml/, 'MCP conformance must apply the committed expected-failures baseline');
const expectedConformanceFailures = [
  'tools-call-with-progress:tools-call-with-progress',
  'tools-call-simple-text:tools-call-simple-text',
  'tools-call-mixed-content:tools-call-mixed-content',
  'tools-call-image:tools-call-image',
  'tools-call-error:tools-call-error',
  'tools-call-embedded-resource:tools-call-embedded-resource',
  'tools-call-audio:tools-call-audio',
  'resources-read-text:resources-read-text',
  'resources-read-binary:resources-read-binary',
  'resources-templates-read:resources-templates-read',
  'prompts-list:prompts-list',
  'prompts-get-simple:prompts-get-simple',
  'prompts-get-with-args:prompts-get-with-args',
  'prompts-get-embedded-resource:prompts-get-embedded-resource',
  'prompts-get-with-image:prompts-get-with-image',
  'completion-complete:completion-complete',
];
for (const check of expectedConformanceFailures) {
  assert.match(
    conformanceBaselineText,
    new RegExp(`^\\s*-\\s+${check.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'),
    `conformance baseline is missing ${check}`,
  );
}
const baselinedServerChecks = conformanceBaselineText
  .split(/\r?\n/)
  .filter((line) => /^\s{2}-\s+/.test(line));
assert.equal(baselinedServerChecks.length, expectedConformanceFailures.length, 'conformance baseline must contain exactly the reviewed 16 server checks');
assert.ok(
  baselinedServerChecks.every((line) => /^\s{2}-\s+[^#\s]+:[^#\s]+\s*$/.test(line)),
  'conformance baseline must use check-level scenario:check-id entries rather than whole-scenario exclusions',
);
assert.doesNotMatch(conformanceBaselineText, /^\s*-\s+[^#\s]+:wire-schema-(?:valid|harness-error)\s*$/m, 'wire-schema checks must never be baselined');
assert.match(dependabotText, /package-ecosystem:\s*npm/, 'Dependabot must watch npm dependencies');
assert.match(dependabotText, /package-ecosystem:\s*github-actions/, 'Dependabot must watch GitHub Actions pins');

console.log(`Validated release metadata, publisher identity, discovery surfaces and pinned CI supply chain for ${packageJson.name} ${packageJson.version}.`);
