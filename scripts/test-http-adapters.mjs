import assert from 'node:assert/strict';
import indexHandler from '../dist/api/index.js';
import serverCardHandler from '../dist/api/server-card.js';
import checklistHandler from '../dist/api/v1/checklist.js';
import searchHandler from '../dist/api/v1/search.js';

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

res = call(checklistHandler, request('GET', '/v1/checklist?jurisdiction=VIC', { 'x-homechecker-source': 'webmcp' }));
payload = body(res);
assert.match(payload.checklist.guidanceBoundary, /utm_source=homechecker-webmcp/);
assert.doesNotMatch(payload.checklist.guidanceBoundary, /utm_source=homechecker-mcp/);
assert.ok(payload.checklist.items.some((item) => /utm_source=homechecker-webmcp/.test(item.referralUrl || '')));

res = call(indexHandler, request('HEAD', '/'));
assert.equal(res.statusCode, 200);
assert.equal(res.body, '');
assert.match(String(res.headers.get('access-control-allow-methods')), /HEAD/);

res = call(serverCardHandler, request('GET', '/server-card.json'));
payload = body(res);
assert.equal(payload.tools.length, 4);
for (const tool of payload.tools) assert.equal(tool.inputSchema?.type, 'object', `${tool.name} must expose inputSchema`);
assert.ok(payload.tools.find((tool) => tool.name === 'search_guides').inputSchema.required.includes('query'));
assert.equal(payload.privacy.identifyingRequestHeadersLoggedByApplication, false);
assert.equal(payload.privacy.protocolMethodHeaderLoggedByApplication, true);
assert.equal('requestHeadersLoggedByApplication' in payload.privacy, false);

console.log('HTTP adapter, attribution, HEAD and server-card checks passed.');
