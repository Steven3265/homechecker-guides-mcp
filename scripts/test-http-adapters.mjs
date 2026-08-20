import assert from 'node:assert/strict';
import healthHandler from '../dist/api/health.js';
import indexHandler from '../dist/api/index.js';
import openapiHandler from '../dist/api/openapi.js';
import serverCardHandler from '../dist/api/server-card.js';
import checklistHandler from '../dist/api/v1/checklist.js';
import guidesHandler from '../dist/api/v1/guides.js';
import searchHandler from '../dist/api/v1/search.js';
import { TOOL_CONTRACTS, searchGuidanceBoundary } from '../dist/src/contracts.js';

class MockResponse {
  constructor() {
    this.headers = new Map();
    this.statusCode = 0;
    this.body = '';
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); }
  end(body = '') { this.body = body ?? ''; }
}

function request(method, url, headers = {}) {
  return { method, url, headers: { host: 'mcp.homechecker.com.au', ...headers } };
}

function call(handler, req) {
  const res = new MockResponse();
  handler(req, res);
  return res;
}

function body(res) {
  return res.body ? JSON.parse(res.body) : null;
}

let res = call(searchHandler, request('GET', '/v1/search?query=section%2032'));
let payload = body(res);
assert.equal(res.statusCode, 200);
assert.ok(payload.results[0].canonicalUrl);
assert.doesNotMatch(payload.results[0].canonicalUrl, /utm_source=/);
assert.match(payload.results[0].referralUrl, /utm_source=homechecker-rest/);

res = call(searchHandler, request('GET', '/v1/search?query=section%2032', { 'x-homechecker-source': 'webmcp' }));
payload = body(res);
assert.match(payload.results[0].referralUrl, /utm_source=homechecker-webmcp/);
assert.match(String(res.headers.get('access-control-allow-headers')), /X-Homechecker-Source/);
assert.equal(String(res.headers.get('access-control-max-age')), '86400');

res = call(searchHandler, request('GET', '/v1/search?query=Should%20I%20buy%20or%20rent%20a%20home%20in%20Australia%20in%202026'));
payload = body(res);
assert.equal(payload.matchStrength, 'weak');
assert.equal(payload.boundary, searchGuidanceBoundary('weak'));
assert.match(payload.boundary, /Treat the results as background only/);

res = call(searchHandler, request('GET', '/v1/search?query=section%2032&limit=banana'));
assert.equal(res.statusCode, 400);
assert.match(body(res).error, /limit must be an integer/);
res = call(guidesHandler, request('GET', '/v1/guides?limit=101'));
assert.equal(res.statusCode, 400);
assert.match(body(res).error, /between 1 and 100/);
res = call(searchHandler, request('GET', '/v1/search?query=section%2032&cluster=not-a-cluster'));
assert.equal(res.statusCode, 400);
assert.match(body(res).error, /cluster must be one of/);
res = call(guidesHandler, request('GET', '/v1/guides?includePillar=yes'));
assert.equal(res.statusCode, 400);
assert.match(body(res).error, /includePillar must be true or false/);

res = call(checklistHandler, request('GET', '/v1/checklist?jurisdiction=VIC', { 'x-homechecker-source': 'webmcp' }));
payload = body(res);
assert.match(payload.checklist.guidanceBoundary, /https:\/\/homechecker\.com\.au/);
assert.doesNotMatch(payload.checklist.guidanceBoundary, /utm_source=/);
assert.ok(payload.checklist.items.some((item) => /utm_source=homechecker-webmcp/.test(item.referralUrl || '')));
res = call(checklistHandler, request('GET', '/v1/checklist?concern=x'));
assert.equal(res.statusCode, 400);
assert.match(body(res).error, /concern values must be between 2 and 120 characters/);
const tooManyConcerns = Array.from({ length: 11 }, (_, index) => `concern=item${index}`).join('&');
res = call(checklistHandler, request('GET', `/v1/checklist?${tooManyConcerns}`));
assert.equal(res.statusCode, 400);
assert.match(body(res).error, /concern may be supplied at most 10 times/);

res = call(indexHandler, request('HEAD', '/'));
assert.equal(res.statusCode, 200);
assert.equal(res.body, '');
assert.match(String(res.headers.get('access-control-allow-methods')), /HEAD/);

res = call(healthHandler, request('HEAD', '/health'));
assert.equal(res.statusCode, 200);
assert.equal(res.body, '');
assert.match(String(res.headers.get('access-control-allow-methods')), /OPTIONS/);
res = call(healthHandler, request('GET', '/health'));
payload = body(res);
assert.equal(payload.status, 'ok');
assert.match(payload.contentHash, /^[a-f0-9]{64}$/);
assert.ok(payload.snapshotGeneratedAt);
assert.ok(payload.latestGuideUpdatedAt);
assert.equal('generatedAt' in payload, false, 'health should use unambiguous snapshotGeneratedAt naming');

res = call(serverCardHandler, request('GET', '/server-card.json'));
payload = body(res);
assert.equal(payload.tools.length, 4);
for (const tool of payload.tools) {
  assert.equal(tool.inputSchema?.type, 'object', `${tool.name} must expose inputSchema`);
  assert.deepEqual(tool.inputSchema, TOOL_CONTRACTS[tool.name].jsonInputSchema, `${tool.name} server-card schema must come from the shared contract`);
}
assert.ok(payload.tools.find((tool) => tool.name === 'search_guides').inputSchema.required.includes('query'));
assert.equal(payload.privacy.identifyingRequestHeadersLoggedByApplication, false);
assert.equal(payload.privacy.protocolMethodHeaderLoggedByApplication, true);
assert.equal('requestHeadersLoggedByApplication' in payload.privacy, false);
assert.ok(payload.corpus.snapshotGeneratedAt);

res = call(openapiHandler, request('GET', '/openapi.json'));
payload = body(res);
const checklistParams = payload.paths['/v1/checklist'].get.parameters.map((parameter) => parameter.name);
assert.deepEqual(checklistParams, ['jurisdiction', 'propertyType', 'era', 'buyingStage', 'concern', 'limit']);
assert.equal(checklistParams.includes('cluster'), false, 'checklist OpenAPI must not advertise unsupported cluster filtering');
const searchParams = payload.paths['/v1/search'].get.parameters.map((parameter) => parameter.name);
assert.ok(searchParams.includes('cluster'));
assert.equal(payload.paths['/v1/search'].get.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/SearchResponse');
assert.ok(payload.components.schemas.GuideSummary.properties.canonicalUrl);
assert.equal(payload.components.schemas.SearchResult.required.includes('reviewDue'), false, 'search result schema must match the actual lean search result');
assert.equal(payload.components.schemas.SearchResult.required.includes('readingTimeMin'), false, 'search result schema must not inherit list-only fields');
assert.ok(payload.components.schemas.GuideDetail.properties.sections, 'full guide schema must extend summary fields without conflicting allOf restrictions');
assert.ok(payload.components.schemas.ChecklistResponse);

console.log('HTTP adapters: attribution, boundaries, strict params, health, shared contracts and OpenAPI checks passed.');
