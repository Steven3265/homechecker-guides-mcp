import assert from 'node:assert/strict';
import { allowedHostnames, allowedOriginHostnames, allowedOrigins, handleMcpRequest } from '../dist/src/http-handler.js';
import { TOOL_CONTRACTS } from '../dist/src/contracts.js';

const ENDPOINT = 'https://test.local/mcp';
const MODERN_VERSION = '2026-07-28';

function modernMeta() {
  return {
    'io.modelcontextprotocol/protocolVersion': MODERN_VERSION,
    'io.modelcontextprotocol/clientInfo': {
      name: 'homechecker-release-test',
      version: '1.0.1',
    },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

async function parseJsonRpc(response) {
  const text = await response.text();
  assert.ok(text, `expected a response body for HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    const payloads = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    assert.ok(payloads.length > 0, `expected an SSE data frame, received: ${text}`);
    return JSON.parse(payloads.at(-1));
  }

  return JSON.parse(text);
}

async function postModern({ id, method, params = {}, name }) {
  const headers = new Headers({
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': MODERN_VERSION,
    'Mcp-Method': method,
    Host: 'test.local',
  });
  if (name) headers.set('Mcp-Name', name);

  const request = new Request(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: { ...params, _meta: modernMeta() },
    }),
  });
  const response = await handleMcpRequest(request);
  return { response, payload: await parseJsonRpc(response) };
}

async function main() {
  const envKeys = [
    'VERCEL',
    'VERCEL_URL',
    'VERCEL_BRANCH_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'ALLOWED_HOSTS',
    'ALLOWED_ORIGIN',
    'ALLOWED_ORIGINS',
  ];
  const envBefore = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    process.env.VERCEL = '1';
    process.env.VERCEL_URL = 'homechecker-guides-mcp-9f2a1bc.vercel.app';
    process.env.VERCEL_BRANCH_URL = 'homechecker-guides-mcp-git-main-steven3265.vercel.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'homechecker-guides-mcp.vercel.app';
    delete process.env.ALLOWED_HOSTS;
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.ALLOWED_ORIGINS;

    const vercelHosts = allowedHostnames();
    for (const hostname of [
      'mcp.homechecker.com.au',
      'homechecker-guides-mcp-9f2a1bc.vercel.app',
      'homechecker-guides-mcp-git-main-steven3265.vercel.app',
      'homechecker-guides-mcp.vercel.app',
    ]) {
      assert.ok(vercelHosts.includes(hostname), `production Host allowlist is missing ${hostname}`);
    }

    const defaultOrigins = allowedOriginHostnames();
    assert.ok(defaultOrigins.includes('claude.com'), 'Claude current web origin must be allowed');
    assert.ok(defaultOrigins.includes('localhost'), 'loopback MCP Inspector origin must be allowed against production');

    for (const hostname of [
      'homechecker-guides-mcp-git-main-steven3265.vercel.app',
      'homechecker-guides-mcp.vercel.app',
    ]) {
      const vercelPreflight = await handleMcpRequest(
        new Request(ENDPOINT, {
          method: 'OPTIONS',
          headers: {
            Host: hostname,
            Origin: 'https://claude.com',
            'Access-Control-Request-Method': 'POST',
          },
        }),
      );
      assert.equal(vercelPreflight.status, 204, `${hostname} must pass the production request boundary`);
    }

    process.env.ALLOWED_ORIGIN = 'https://legacy-only.example';
    assert.deepEqual(allowedOriginHostnames(), ['legacy-only.example'], 'legacy ALLOWED_ORIGIN must remain restrictive');
    assert.deepEqual(allowedOrigins(), ['https://legacy-only.example'], 'legacy ALLOWED_ORIGIN must preserve its exact origin');

    process.env.ALLOWED_ORIGINS = 'https://trusted.example:8443';
    assert.deepEqual(allowedOriginHostnames(), ['trusted.example'], 'ALLOWED_ORIGINS hostname view must remain available for diagnostics');
    assert.deepEqual(allowedOrigins(), ['https://trusted.example:8443'], 'ALLOWED_ORIGINS must preserve scheme and port');

    const exactOrigin = await handleMcpRequest(
      new Request(ENDPOINT, {
        method: 'OPTIONS',
        headers: {
          Host: 'mcp.homechecker.com.au',
          Origin: 'https://trusted.example:8443',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    );
    assert.equal(exactOrigin.status, 204, 'configured exact Origin must pass');

    for (const origin of ['https://trusted.example', 'https://trusted.example:9443', 'http://trusted.example:8443']) {
      const widenedOrigin = await handleMcpRequest(
        new Request(ENDPOINT, {
          method: 'OPTIONS',
          headers: {
            Host: 'mcp.homechecker.com.au',
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
          },
        }),
      );
      assert.equal(widenedOrigin.status, 403, `${origin} must not be admitted by https://trusted.example:8443`);
      assert.equal(widenedOrigin.headers.has('access-control-allow-origin'), false);
      assert.match(widenedOrigin.headers.get('content-type') ?? '', /^application\/json\b/i);
      const widenedPayload = await widenedOrigin.json();
      assert.equal(widenedPayload.jsonrpc, '2.0');
      assert.equal(widenedPayload.id, null);
      assert.equal(widenedPayload.error?.code, -32000);
    }
  } finally {
    for (const key of envKeys) {
      const value = envBefore[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const preflight = await handleMcpRequest(
    new Request(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        Host: 'test.local',
        Origin: 'https://claude.ai',
        'Access-Control-Request-Method': 'POST',
      },
    }),
  );
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /POST/);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://claude.ai');

  const rejectedOrigin = await handleMcpRequest(
    new Request(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        Host: 'test.local',
        Origin: 'https://attacker.example',
        'Access-Control-Request-Method': 'POST',
      },
    }),
  );
  assert.equal(rejectedOrigin.status, 403);
  assert.equal(rejectedOrigin.headers.has('access-control-allow-origin'), false);

  const rejectedHost = await handleMcpRequest(
    new Request(ENDPOINT, { method: 'POST', headers: { Host: 'attacker.example' } }),
  );
  assert.equal(rejectedHost.status, 403);
  assert.equal(rejectedHost.headers.has('access-control-allow-origin'), false);

  const getResponse = await handleMcpRequest(new Request(ENDPOINT, { headers: { Host: 'test.local' } }));
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get('allow'), 'POST, OPTIONS');

  const discover = await postModern({ id: 'discover', method: 'server/discover' });
  assert.equal(discover.response.status, 200);
  assert.ok(discover.payload.result.supportedVersions.includes(MODERN_VERSION));
  assert.ok(discover.payload.result.capabilities.tools);
  assert.ok(discover.payload.result.capabilities.resources);
  assert.equal(discover.payload.result.cacheScope, 'public');
  assert.ok(discover.payload.result.ttlMs > 0);

  const tools = await postModern({ id: 'tools', method: 'tools/list' });
  assert.equal(tools.response.status, 200);
  assert.deepEqual(
    tools.payload.result.tools.map((tool) => tool.name).sort(),
    ['build_buyer_checklist', 'get_guide', 'list_guides', 'search_guides'],
  );
  assert.ok(tools.payload.result.tools.every((tool) => tool.annotations?.readOnlyHint === true));
  assert.equal(tools.payload.result.cacheScope, 'public');
  for (const tool of tools.payload.result.tools) {
    const expected = TOOL_CONTRACTS[tool.name]?.jsonInputSchema;
    assert.ok(expected, `missing shared contract for ${tool.name}`);
    assert.deepEqual(
      Object.keys(tool.inputSchema?.properties ?? {}).sort(),
      Object.keys(expected.properties ?? {}).sort(),
      `${tool.name} MCP input fields drifted from the shared contract`,
    );
    assert.deepEqual(
      [...(tool.inputSchema?.required ?? [])].sort(),
      [...(expected.required ?? [])].sort(),
      `${tool.name} MCP required fields drifted from the shared contract`,
    );
    for (const [field, expectedSchema] of Object.entries(expected.properties ?? {})) {
      const actualSchema = tool.inputSchema.properties[field];
      for (const key of ['type', 'minimum', 'maximum', 'minLength', 'maxLength', 'maxItems']) {
        if (key in expectedSchema) assert.deepEqual(actualSchema?.[key], expectedSchema[key], `${tool.name}.${field} ${key} drifted`);
      }
      if ('enum' in expectedSchema) assert.deepEqual(actualSchema?.enum, expectedSchema.enum, `${tool.name}.${field} enum drifted`);
    }
    assert.equal(tool.outputSchema?.type, 'object', `${tool.name} must advertise an outputSchema`);
    const advertisedOutputFields = Object.keys(tool.outputSchema?.properties ?? {});
    for (const field of TOOL_CONTRACTS[tool.name].outputFields) {
      assert.ok(advertisedOutputFields.includes(field), `${tool.name} outputSchema is missing ${field}`);
    }
  }

  const listed = await postModern({
    id: 'list',
    method: 'tools/call',
    name: 'list_guides',
    params: { name: 'list_guides', arguments: { jurisdiction: 'VIC' } },
  });
  assert.equal(listed.response.status, 200);
  assert.ok(listed.payload.result.structuredContent.count > 0);
  assert.ok(Array.isArray(listed.payload.result.structuredContent.guides));

  const search = await postModern({
    id: 'search',
    method: 'tools/call',
    name: 'search_guides',
    params: {
      name: 'search_guides',
      arguments: { query: 'What should I look for in a Section 32 in Victoria?' },
    },
  });
  assert.equal(search.response.status, 200);
  assert.equal(search.payload.result.structuredContent.results[0].slug, 'reading-a-section-32');
  assert.equal(
    search.payload.result.structuredContent.results[0].canonicalUrl,
    'https://homechecker.com.au/guides/reading-a-section-32',
  );

  const fullGuide = await postModern({
    id: 'full-guide',
    method: 'tools/call',
    name: 'get_guide',
    params: {
      name: 'get_guide',
      arguments: { slug: 'reading-a-section-32', format: 'full' },
    },
  });
  assert.equal(fullGuide.response.status, 200);
  assert.equal(fullGuide.payload.result.structuredContent.guide.slug, 'reading-a-section-32');
  assert.ok(Array.isArray(fullGuide.payload.result.structuredContent.guide.sources));

  const checklist = await postModern({
    id: 'checklist',
    method: 'tools/call',
    name: 'build_buyer_checklist',
    params: {
      name: 'build_buyer_checklist',
      arguments: { jurisdiction: 'VIC', buyingStage: 'contract review', concerns: ['Section 32'], limit: 4 },
    },
  });
  assert.equal(checklist.response.status, 200);
  assert.ok(checklist.payload.result.structuredContent.checklist.items.length > 0);

  const sectionWarning = await postModern({
    id: 'section-warning',
    method: 'tools/call',
    name: 'get_guide',
    params: {
      name: 'get_guide',
      arguments: { slug: 'reading-a-section-32', format: 'sections', sectionIds: ['not-a-real-section'] },
    },
  });
  assert.equal(sectionWarning.response.status, 200);
  assert.deepEqual(sectionWarning.payload.result.structuredContent.missingSectionIds, ['not-a-real-section']);
  assert.match(sectionWarning.payload.result.structuredContent.warning, /Unknown section IDs were ignored/);

  const resources = await postModern({ id: 'resources', method: 'resources/list' });
  assert.equal(resources.response.status, 200);
  assert.equal(resources.payload.result.resources.length, 35);
  assert.ok(resources.payload.result.resources.some((resource) => resource.uri === 'homechecker://catalogue'));
  assert.ok(
    resources.payload.result.resources.some(
      (resource) => resource.uri === 'homechecker://guides/reading-a-section-32',
    ),
  );

  const resourceRead = await postModern({
    id: 'resource-read',
    method: 'resources/read',
    name: 'homechecker://guides/reading-a-section-32',
    params: { uri: 'homechecker://guides/reading-a-section-32' },
  });
  assert.equal(resourceRead.response.status, 200);
  assert.match(resourceRead.payload.result.contents[0].text, /Sale of Land Act 1962/);
  assert.equal(resourceRead.payload.result.cacheScope, 'public');

  const mismatchRequest = new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': MODERN_VERSION,
      'Mcp-Method': 'tools/call',
      'Mcp-Name': 'wrong_tool',
      Host: 'test.local',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'mismatch',
      method: 'tools/call',
      params: {
        name: 'search_guides',
        arguments: { query: 'Section 32 Victoria' },
        _meta: modernMeta(),
      },
    }),
  });
  const mismatchResponse = await handleMcpRequest(mismatchRequest);
  const mismatchPayload = await parseJsonRpc(mismatchResponse);
  assert.equal(mismatchResponse.status, 400);
  assert.equal(mismatchPayload.error.code, -32020);

  const legacyRequest = new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      Host: 'test.local',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'legacy-initialize',
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'homechecker-legacy-test', version: '1.0.1' },
      },
    }),
  });
  const legacyResponse = await handleMcpRequest(legacyRequest);
  const legacyPayload = await parseJsonRpc(legacyResponse);
  assert.equal(legacyResponse.status, 200);
  assert.equal(legacyPayload.result.protocolVersion, '2025-11-25');
  assert.equal(legacyPayload.result.serverInfo.name, 'homechecker-guides');
  assert.equal(legacyPayload.result.serverInfo.title, 'Homechecker Guides');
  assert.equal(legacyPayload.result.serverInfo.websiteUrl, 'https://homechecker.com.au/ai');
  assert.equal(legacyPayload.result.serverInfo.icons?.[0]?.mimeType, 'image/png');

  console.log('PASS  protocol: Host/Origin guards, CORS and method controls');
  console.log('PASS  protocol: 2026-07-28 discovery, tools, calls and resources');
  console.log('PASS  protocol: routing-header mismatch rejection');
  console.log('PASS  protocol: 2025-era initialize compatibility');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
