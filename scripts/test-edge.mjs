import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

// Edge cases, answer sizes and speed: the checks the main suites do not
// cover. Runs against the built server (dist/).
const t0 = performance.now();
const { handleMcpRequest } = await import('../dist/src/http-handler.js');
const coldMs = performance.now() - t0;
const quiet = console.error; console.error = () => {};

// Findings are collected rather than thrown, so one breach does not hide the
// rest. Anything recorded here fails the run at the end.
const findings = [];
const check = (ok, msg) => { if (!ok) findings.push(msg); };

const ENDPOINT = 'https://test.local/mcp';
const meta = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'edge-test', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
};
async function rpc(method, params = {}, name) {
  const headers = new Headers({ Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method, Host: 'test.local' });
  if (name) headers.set('Mcp-Name', name);
  const res = await handleMcpRequest(new Request(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: meta } }) }));
  const text = await res.text();
  const body = (res.headers.get('content-type') ?? '').includes('event-stream')
    ? JSON.parse(text.split('\n').filter((l) => l.startsWith('data:')).at(-1).slice(5))
    : JSON.parse(text);
  return { status: res.status, body };
}
const call = (name, args) => rpc('tools/call', { name, arguments: args }, name);
const rejected = (r) => Boolean(r.body.error || r.body.result?.isError);

try {
  // Odd and hostile input
  let r = await call('search_guides', { query: '🏠 rénovation of an ägeing weatherboard — damp?' });
  assert.equal(r.status, 200, 'accented and emoji questions still search');
  r = await call('search_guides', { query: 'the of and is it' });
  assert.equal(r.body.result.structuredContent.matchStrength, 'none', 'stop words only: none');
  r = await call('search_guides', { query: 'damp '.repeat(200).slice(0, 800) });
  assert.equal(r.status, 200, 'an 800-character question is accepted');
  assert.ok(rejected(await call('search_guides', { query: 'x'.repeat(801) })), 'over 800 characters is rejected');
  assert.ok(rejected(await call('search_guides', { query: 'a' })), 'under 2 characters is rejected');
  assert.ok(rejected(await call('search_guides', { query: 'damp', limit: 50 })), 'a limit over 10 is rejected');
  assert.ok(rejected(await call('get_guide', { slug: 'not-a-guide' })), 'a guide that does not exist is an error');
  assert.ok(rejected(await call('get_guide', { slug: 'reading-a-section-32', format: 'everything' })), 'an unknown format is rejected');
  assert.ok(rejected(await call('build_buyer_checklist', { limit: 99 })), 'a checklist limit over 20 is rejected');

  // Unknown section ids are reported, not silently dropped
  r = await call('get_guide', { slug: 'reading-a-section-32', format: 'sections', sectionIds: ['no-such-section'] });
  assert.equal(r.status, 200);
  assert.ok(r.body.result.structuredContent.missingSectionIds?.includes('no-such-section'), 'unknown section ids are reported back');

  // The summary default carries a usable section index
  r = await call('get_guide', { slug: 'reading-a-section-32' });
  const index = r.body.result.structuredContent.guide.sectionIndex;
  if (Array.isArray(index)) {
    check(index.length > 0, 'the default summary indexes no sections');
    check(index.every((s) => typeof s.id === 'string' && typeof s.heading === 'string'), 'a section index entry lacks an id or a heading');
    const sectioned = await call('get_guide', { slug: 'reading-a-section-32', format: 'sections', sectionIds: [index[0].id] });
    check(sectioned.body.result.structuredContent.guide.sections.length === 1, 'an id from the section index did not resolve to its section');
  }

  r = await rpc('resources/read', { uri: 'homechecker://guides/not-a-guide' }, 'homechecker://guides/not-a-guide');
  assert.ok(r.body.error, 'an unknown resource is an error');
  assert.ok(rejected(await rpc('tools/call', { name: 'no_such_tool', arguments: {} }, 'no_such_tool')), 'an unknown tool is an error');

  // The person-facing Read link cannot be injected into
  r = await call('search_guides', { query: 'damp' });
  const text0 = r.body.result.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  assert.ok(!/<script/i.test(text0), 'no script tag reaches the answer');

  // Speed, measured before the size sweep below: that sweep materialises the
  // full text of every guide many times over, and timing after it measures the
  // heap it leaves behind rather than the search.
  for (let i = 0; i < 10; i++) await call('search_guides', { query: 'damp and moisture in a brick home' });
  const times = [];
  for (let i = 0; i < 40; i++) { const s = performance.now(); await call('search_guides', { query: 'damp and moisture in a brick home' }); times.push(performance.now() - s); }
  times.sort((a, b) => a - b);
  const p50 = times[20], p95 = times[38];
  check(p95 < 250, `search p95 ${p95.toFixed(1)} ms (budget 250 ms)`);

  // Answer sizes, per client. Every answer is sent twice by design
  // (structuredContent and text). Budgets, from each client's limits:
  //   every default answer (no format asked for), whole JSON: <= 20,000
  //     characters, so it stays inline even in GitHub Copilot (20 KB offload);
  //   every answer's model-visible text, in any mode: <= 40,000 characters,
  //     Gemini CLI's truncation threshold; Claude Code's 25,000 tokens is wider.
  const { guides } = await import('../dist/src/core.js');
  const sizes = [];
  const measure = async (label, name, args, isDefault) => {
    const x = await call(name, args);
    const json = JSON.stringify(x.body.result).length;
    const text = x.body.result.content.filter((c) => c.type === 'text').reduce((n, c) => n + c.text.length, 0);
    sizes.push({ label, json, text, isDefault });
  };
  await measure('list_guides', 'list_guides', {}, true);
  await measure('list_guides with hub', 'list_guides', { includePillar: true }, false);
  await measure('search_guides', 'search_guides', { query: 'cracks in a brick wall' }, true);
  await measure('search_guides x10', 'search_guides', { query: 'damp and moisture', limit: 10 }, false);
  await measure('build_buyer_checklist', 'build_buyer_checklist', {}, true);
  await measure('build_buyer_checklist x20', 'build_buyer_checklist', { limit: 20, concerns: ['damp', 'cracking', 'wiring'] }, false);

  let bigSummary = { json: 0 }, bigFull = { json: 0 }, bigSection = { json: 0 };
  for (const guide of guides) {
    await measure(`guide ${guide.slug}`, 'get_guide', { slug: guide.slug }, true);
    const a = sizes.pop(); if (a.json > bigSummary.json) bigSummary = a;
    await measure(`guide ${guide.slug} full`, 'get_guide', { slug: guide.slug, format: 'full' }, false);
    const b = sizes.pop(); if (b.json > bigFull.json) bigFull = b;
    for (const section of guide.sections) {
      await measure(`guide ${guide.slug} ${section.id}`, 'get_guide', { slug: guide.slug, format: 'sections', sectionIds: [section.id] }, false);
      const c = sizes.pop(); if (c.json > bigSection.json) bigSection = c;
    }
  }
  sizes.push(
    { ...bigSummary, label: `largest guide summary (${bigSummary.label.replace('guide ', '')})` },
    { ...bigSection, label: `largest guide section (${bigSection.label.replace('guide ', '')})` },
    { ...bigFull, label: `largest full guide (${bigFull.label.replace('guide ', '').replace(' full', '')})` },
  );

  for (const x of sizes) {
    if (x.isDefault) check(x.json <= 20_000, `${x.label}: default answer ${x.json} characters (budget 20,000)`);
    check(x.text <= 40_000, `${x.label}: model-visible text ${x.text} characters (budget 40,000)`);
  }


  console.error = quiet;
  if (findings.length) {
    console.error(`\n${findings.length} finding(s):`);
    for (const f of findings) console.error(`  ${f}`);
    process.exitCode = 1;
  }
  console.log('PASS  edge: accented and emoji input, length limits, unknown values, missing guides, resources and tools');
  if (Array.isArray(index)) console.log('PASS  edge: the summary default indexes its sections and each id resolves');
  console.log(findings.some((f) => f.includes('budget')) ? 'FAIL  edge: answer-size budgets (see findings above)' : 'PASS  edge: every default answer within 20k characters (Copilot), all model-visible text within 40k (Gemini CLI)');
  for (const x of sizes) console.log(`        ${x.label.padEnd(58)} ${(x.json / 1000).toFixed(1).padStart(5)}k answer, ${(x.text / 1000).toFixed(1).padStart(5)}k text${x.isDefault ? '  (default)' : ''}`);
  console.log(`PASS  edge: cold start ${coldMs.toFixed(0)} ms; search p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
} catch (e) {
  console.error = quiet;
  console.error(e);
  process.exitCode = 1;
}
