import { readFileSync } from 'node:fs';

const snapshotText = readFileSync(new URL('../data/guides.json', import.meta.url), 'utf8');
const snapshot = JSON.parse(snapshotText);
const errors = [];
const slugs = new Set();
const uris = new Set();

const SECRET_PATTERN = /(SUPABASE_(?:SERVICE_ROLE|ANON)_KEY|STRIPE_(?:SECRET|RESTRICTED)_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) PRIVATE KEY-----|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})/i;
const DATE_FIELDS = ['publishedAt', 'updatedAt', 'reviewedAt', 'reviewDue'];

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

if (snapshot.schemaVersion !== 1) errors.push('Unexpected snapshot schema version.');
if (snapshot.source.contentCount !== snapshot.guides.length) errors.push('contentCount does not match guide count.');
if (snapshot.guides.filter((guide) => !guide.pillar).length !== snapshot.source.spokeCount) errors.push('spokeCount does not match.');
if (SECRET_PATTERN.test(snapshotText)) errors.push('Potential secret marker found somewhere in the serialized snapshot.');
if (snapshot.source.readingTimeMethod?.wordsPerMinute !== 180 || snapshot.source.readingTimeMethod?.rounding !== 'ceil') {
  errors.push('Unexpected or missing deterministic reading-time method.');
}

for (const guide of snapshot.guides) {
  const key = guide.pillar ? '__pillar__' : guide.slug;
  if (slugs.has(key)) errors.push(`Duplicate slug: ${guide.slug}`);
  slugs.add(key);
  if (uris.has(guide.resourceUri)) errors.push(`Duplicate resource URI: ${guide.resourceUri}`);
  uris.add(guide.resourceUri);
  if (!guide.canonicalUrl.startsWith('https://homechecker.com.au/guides')) errors.push(`Non-canonical URL: ${guide.canonicalUrl}`);
  if (!guide.contentMarkdown.includes(guide.canonicalUrl)) errors.push(`Canonical URL missing from content: ${guide.slug}`);
  if (!guide.title || !guide.answer || !guide.summary) errors.push(`Incomplete guide metadata: ${guide.slug}`);
  if (!Number.isInteger(guide.wordCount) || guide.wordCount <= 0) errors.push(`Invalid wordCount: ${guide.slug}`);
  if (!Number.isInteger(guide.readingTimeMin) || guide.readingTimeMin <= 0) errors.push(`Invalid readingTimeMin: ${guide.slug}`);
  if (!Array.isArray(guide.sections) || !guide.sections.length) errors.push(`No sections: ${guide.slug}`);

  const sectionIds = new Set();
  for (const section of guide.sections ?? []) {
    if (!section.id?.trim()) errors.push(`Blank section ID: ${guide.slug}`);
    if (sectionIds.has(section.id)) errors.push(`Duplicate section ID in ${guide.slug}: ${section.id}`);
    sectionIds.add(section.id);
  }

  for (const field of DATE_FIELDS) {
    const value = guide[field];
    if (value !== null && value !== undefined && !validDate(value)) errors.push(`Invalid ${field} on ${guide.slug}: ${value}`);
  }

  for (const source of guide.sources ?? []) {
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:') errors.push(`Non-HTTPS source URL in ${guide.slug}: ${source.url}`);
    } catch {
      errors.push(`Invalid source URL in ${guide.slug}: ${source.url}`);
    }
    if (!validDate(source.accessed)) errors.push(`Invalid source accessed date in ${guide.slug}: ${source.accessed}`);
  }
}

const publishedSlugs = new Set(snapshot.guides.filter((guide) => !guide.pillar).map((guide) => guide.slug));
const hasPillar = snapshot.guides.some((guide) => guide.pillar);
const relatedTargets = new Set([...publishedSlugs, ...(hasPillar ? ['guides'] : [])]);
for (const guide of snapshot.guides) {
  for (const related of guide.related ?? []) {
    if (!related?.trim()) errors.push(`Blank related-guide slug: ${guide.slug}`);
    else if (!relatedTargets.has(related)) errors.push(`Unknown related-guide slug in ${guide.slug}: ${related}`);
  }
}

for (const cluster of snapshot.clusters ?? []) {
  const seenClusterSlugs = new Set();
  for (const slug of cluster.slugs ?? []) {
    if (seenClusterSlugs.has(slug)) errors.push(`Duplicate slug in cluster ${cluster.id}: ${slug}`);
    seenClusterSlugs.add(slug);
    if (!publishedSlugs.has(slug)) errors.push(`Unknown slug in cluster ${cluster.id}: ${slug}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${snapshot.guides.length} guide resources (${snapshot.source.spokeCount} spokes plus the hub), source links, dates, relationships and section IDs.`);
