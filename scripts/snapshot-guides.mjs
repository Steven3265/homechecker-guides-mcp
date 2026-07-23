// Rebuild data/guides.json from the public Homechecker guide export.
//
// The portal publishes its guide registry at
//   https://homechecker.com.au/guides/export.json
// — the same registry that renders the pages, sitemap and llms.txt. This
// script fetches that public artefact and rebuilds the bundled snapshot.
// The MCP repository needs no access to the portal repository at all: it
// consumes a public publication, like any other member of the public.
//
// Usage:
//   npm run snapshot                          # fetch the live export
//   npm run snapshot -- --url <export-url>    # e.g. a preview deployment
//
// If nothing but the timestamp would change, the existing file is left
// untouched so the refresh workflow only opens a pull request for real
// content changes.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from './snapshot-lib.mjs';

const DEFAULT_URL = 'https://homechecker.com.au/guides/export.json';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const url = argument('--url') ?? DEFAULT_URL;
const outputPath = fileURLToPath(new URL('../data/guides.json', import.meta.url));

let response;
try {
  response = await fetch(url, { headers: { accept: 'application/json' } });
} catch (error) {
  console.error(`Could not reach the guide export at ${url}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`Guide export request failed: ${response.status} ${response.statusText} (${url})`);
  process.exit(1);
}

const exportData = await response.json();
if (
  exportData?.schemaVersion !== 1 ||
  !Array.isArray(exportData.publishedGuides) ||
  !Array.isArray(exportData.guideClusters)
) {
  console.error('Guide export did not match the expected shape (schemaVersion 1 with publishedGuides and guideClusters arrays).');
  process.exit(1);
}

const snapshot = buildSnapshot(
  { publishedGuides: exportData.publishedGuides, guideClusters: exportData.guideClusters },
  {
    generatedAt: new Date().toISOString(),
    baseUrl: exportData.baseUrl,
    origin: url,
  },
);

if (existsSync(outputPath)) {
  try {
    const previous = JSON.parse(readFileSync(outputPath, 'utf8'));
    const withoutTimestamp = (s) => JSON.stringify({ ...s, generatedAt: null });
    if (withoutTimestamp(previous) === withoutTimestamp(snapshot)) {
      console.log(`No content changes against ${url} — snapshot left untouched (generatedAt ${previous.generatedAt}).`);
      process.exit(0);
    }
  } catch {
    // Unreadable previous file: fall through to a full rewrite.
  }
}

writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${snapshot.guides.length} resources from ${url} (export generated ${exportData.generatedAt ?? 'unknown'}).`,
);
