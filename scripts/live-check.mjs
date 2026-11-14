#!/usr/bin/env node
// A robustness check against a running server (production by default):
//   npm run live-check                       https://mcp.homechecker.com.au
//   npm run live-check -- http://localhost:3000
// Not part of npm run check: it makes well over a thousand requests over the
// network. It throws malformed and hostile protocol traffic at /mcp, fetches
// every guide, section and resource, checks determinism and that /mcp,
// /mcp/openai and REST agree, confirms the discovery surfaces answer, and puts
// the server under a short burst of load. Exits non-zero on any finding.
const BASE = (process.argv[2] || 'https://mcp.homechecker.com.au').replace(/\/$/, '');
const findings = [];
const fail = (area, msg) => findings.push(`${area}: ${msg}`);
const ms = [];
const LEAK = /(node_modules|\.ts:\d+|\bat [A-Za-z_.]+ \(|TypeError|ReferenceError)/;

async function raw(path, init = {}) {
  const t0 = performance.now();
  try {
    const r = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await r.text(); ms.push(performance.now() - t0);
    if (r.status >= 500) fail('5xx', `${init.method ?? 'GET'} ${path} ${r.status}`);
    if (r.status >= 400 && LEAK.test(text)) fail('leak', `${path}: ${text.slice(0, 120)}`);
    return { status: r.status, text, headers: r.headers };
  } catch (e) { fail('network', `${path}: ${e}`); return { status: 0, text: '', headers: new Headers() }; }
}
const parse = (t) => { try { return t.trim().startsWith('{') ? JSON.parse(t) : JSON.parse((t.split('\n').find((l) => l.startsWith('data:')) ?? 'data:null').slice(5)); } catch { return undefined; } };
let seq = 0;
async function rpc(method, params = {}, { path = '/mcp', headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'User-Agent': 'homechecker-live-check/1.0', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method, ...headers };
  const name = params.name ?? params.uri; if (name && !('Mcp-Name' in headers)) h['Mcp-Name'] = name;
  const body = JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'live-check', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} } } });
  const r = await raw(path, { method: 'POST', headers: h, body });
  return { ...r, json: parse(r.text) };
}
const tool = (name, args, opts) => rpc('tools/call', { name, arguments: args }, opts);
const sc = (r) => r.json?.result?.structuredContent;
const isErr = (r) => Boolean(r.json?.error || r.json?.result?.isError);
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k]); } })); }

// 1. Hostile and malformed traffic: refused cleanly, never a 5xx or a leak.
const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/list' };
for (const body of ['{"jsonrpc":', '', '42', '{"id":1,"method":"tools/list"}']) {
  const r = await raw('/mcp', { method: 'POST', headers: H, body });
  if (r.status !== 400) fail('protocol', `malformed body ${JSON.stringify(body)} -> ${r.status}`);
}
for (const origin of ['https://evil.example', 'null', 'https://homechecker.com.au.evil.example']) {
  const r = await raw('/mcp', { method: 'POST', headers: { ...H, Origin: origin }, body: '{}' });
  if (r.status !== 403) fail('boundary', `Origin ${origin} -> ${r.status}`);
}
if ((await rpc('tools/list', {}, { headers: { Origin: 'https://claude.ai' } })).status !== 200) fail('boundary', 'claude.ai origin refused');
// The directory inspectors must be able to preflight and enumerate.
for (const origin of ['https://glama.ai', 'https://smithery.ai']) {
  const pre = await raw('/mcp', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
  if (pre.status !== 204) fail('directories', `preflight from ${origin} -> ${pre.status}`);
  if ((await rpc('tools/list', {}, { headers: { Origin: origin } })).status !== 200) fail('directories', `tools/list from ${origin} refused`);
}
// A crawler that mis-declares its revision, or sends a thin Accept, must still
// be able to read the tool list; a tool call must still be refused.
if ((await raw('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2026-07-28' }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' })).status !== 200) fail('tolerance', 'tools/list refused for a mis-declaring crawler');
if ((await raw('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2026-07-28' }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_guides","arguments":{}}}' })).status === 200) fail('tolerance', 'tools/call accepted from a mis-declaring crawler');
if ((await raw('/mcp', { method: 'GET' })).status !== 405) fail('protocol', 'GET /mcp is not 405');

for (const [args, label] of [[{ query: 12345 }, 'wrong type'], [{ query: 'x'.repeat(5000) }, 'too long'], [{ query: 'damp', limit: 0 }, 'limit 0'], [{ query: 'damp', limit: 99 }, 'limit 99']]) {
  if (!isErr(await tool('search_guides', args))) fail('validation', `search_guides ${label} accepted`);
}
for (const uri of ['homechecker://guides/../../etc/passwd', 'file:///etc/passwd', 'homechecker://guides/no-such-guide']) {
  const r = await rpc('resources/read', { uri });
  if (!r.json?.error) fail('resources', `${uri} -> ${JSON.stringify(r.json?.error ?? 'contents')}`);
}
const pages = sc(await tool('list_guides', { limit: 25 }));
const paged = pages && 'nextCursor' in pages;
if (paged) for (const cursor of ['-999', 'zz', 'NaN']) if (!isErr(await tool('list_guides', { cursor }))) fail('paging', `list_guides accepted cursor ${cursor}`);
if (!isErr(await tool('get_guide', { slug: 'reading-a-section-32', format: 'sections', sectionIds: [] })) === false) { /* empty ids means all sections: allowed */ }
if (!isErr(await tool('get_guide', { slug: 'no-such-guide' }))) fail('validation', 'an unknown slug was accepted');

// 2. The person-facing Read link cannot be injected into.
const linkText = (await tool('search_guides', { query: 'damp' })).text;
if (/%0D|%0A/i.test(linkText)) fail('read-link', 'control characters carried into the answer');
// ChatGPT must not be offered the Read link on /mcp, and /mcp/openai never offers it.
const cg = await tool('search_guides', { query: 'damp' }, { headers: { 'User-Agent': 'openai-mcp/1.0 (ChatGPT)' } });
if (/homechecker\.com\.au\/read\?/.test(cg.text)) fail('openai', 'Read link offered to ChatGPT on /mcp');
if (/homechecker\.com\.au\/read\?/.test((await tool('search_guides', { query: 'damp' }, { path: '/mcp/openai' })).text)) fail('openai', 'Read link offered on /mcp/openai');

// 3. Every guide, every section, every resource.
const rows = [];
for (let cursor; ;) {
  const s = sc(await tool('list_guides', { includePillar: true, ...(paged ? { limit: 25 } : {}), ...(cursor ? { cursor } : {}) }));
  rows.push(...(s?.guides ?? []));
  if (!s?.nextCursor) break;
  cursor = s.nextCursor;
}
if (rows.length < 20) fail('corpus', `list_guides paged to only ${rows.length} guides`);
await pool(rows, 6, async (row) => {
  const summary = await tool('get_guide', { slug: row.slug });
  const full = sc(await tool('get_guide', { slug: row.slug, format: 'full' }));
  const index = sc(summary)?.guide?.sectionIndex
    ?? (full?.guide?.sections ?? []).map((s) => ({ id: s.id, heading: s.heading }));
  if (!index.length) { fail('guide', `${row.slug}: no sections found`); return; }
  if (JSON.stringify(sc(summary)) !== JSON.stringify(sc(await tool('get_guide', { slug: row.slug })))) fail('determinism', `${row.slug} summary differs between identical calls`);
  for (const section of index) {
    const r = await tool('get_guide', { slug: row.slug, format: 'sections', sectionIds: [section.id] });
    if (isErr(r)) fail('section', `${row.slug} ${section.id} failed`);
  }
  if (!full) fail('guide', `${row.slug} full failed`);
  const res = await rpc('resources/read', { uri: `homechecker://guides/${row.slug}` });
  if (!res.json?.result?.contents?.[0]?.text) fail('resources', `homechecker://guides/${row.slug} returned nothing`);
});

// 4. Discovery surfaces and REST agree with the protocol.
for (const [path, check] of [
  ['/health', (j) => j?.status === 'ok'],
  ['/openapi.json', (j) => Boolean(j?.paths)],
  ['/mcp/server-card', (j) => Boolean(j)],
  ['/server-card.json', (j) => Boolean(j)],
  ['/.well-known/ai-catalog.json', (j) => Array.isArray(j?.entries) && j.entries.length > 0],
]) {
  const r = await raw(path);
  if (r.status !== 200 || !check(parse(r.text))) fail('discovery', `${path} -> ${r.status}`);
}
const restSearch = parse((await raw('/v1/search?query=damp')).text);
const mcpSearch = sc(await tool('search_guides', { query: 'damp' }));
if ((restSearch?.results?.[0]?.slug ?? null) !== (mcpSearch?.results?.[0]?.slug ?? null)) fail('agreement', 'REST and MCP disagree on the top search result');

// 5. A short burst of load.
const burst = Array.from({ length: 120 }, (_, i) => i);
const t0 = performance.now();
await pool(burst, 12, async (i) => { if (isErr(await tool('search_guides', { query: `damp ${i % 7}` }))) fail('load', `search failed under load at ${i}`); });
const burstMs = performance.now() - t0;

ms.sort((a, b) => a - b);
const p50 = ms[Math.floor(ms.length * 0.5)] ?? 0;
const p95 = ms[Math.floor(ms.length * 0.95)] ?? 0;
console.log(`live-check ${BASE}: ${ms.length} requests, p50 ${p50.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms; burst of 120 searches in ${burstMs.toFixed(0)} ms`);
if (findings.length) {
  console.error(`\n${findings.length} finding(s):`);
  for (const f of findings) console.error(`  ${f}`);
  process.exitCode = 1;
} else {
  console.log('PASS  live-check: protocol boundary, directory preflight, crawler tolerance, validation, every guide and section, resources, discovery surfaces, REST agreement, determinism and load');
}
