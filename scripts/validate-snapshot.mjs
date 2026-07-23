import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync(new URL('../data/guides.json', import.meta.url), 'utf8'));
const errors = [];
const slugs = new Set();
const uris = new Set();

if (snapshot.schemaVersion !== 1) errors.push('Unexpected snapshot schema version.');
if (snapshot.source.contentCount !== snapshot.guides.length) errors.push('contentCount does not match guide count.');
if (snapshot.guides.filter((guide) => !guide.pillar).length !== snapshot.source.spokeCount) errors.push('spokeCount does not match.');

for (const guide of snapshot.guides) {
  const key = guide.pillar ? '__pillar__' : guide.slug;
  if (slugs.has(key)) errors.push(`Duplicate slug: ${guide.slug}`);
  slugs.add(key);
  if (uris.has(guide.resourceUri)) errors.push(`Duplicate resource URI: ${guide.resourceUri}`);
  uris.add(guide.resourceUri);
  if (!guide.canonicalUrl.startsWith('https://homechecker.com.au/guides')) errors.push(`Non-canonical URL: ${guide.canonicalUrl}`);
  if (!guide.contentMarkdown.includes(guide.canonicalUrl)) errors.push(`Canonical URL missing from content: ${guide.slug}`);
  if (!guide.title || !guide.answer || !guide.summary) errors.push(`Incomplete guide metadata: ${guide.slug}`);
  if (!Array.isArray(guide.sections) || !guide.sections.length) errors.push(`No sections: ${guide.slug}`);
  if (/SUPABASE|STRIPE_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY/i.test(guide.contentMarkdown)) errors.push(`Potential secret marker in content: ${guide.slug}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${snapshot.guides.length} guide resources (${snapshot.source.spokeCount} spokes plus the hub).`);
