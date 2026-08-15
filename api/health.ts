import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { snapshot } from '../src/core.js';
import { requireGet, sendJson } from '../src/http-json.js';
import { SERVER_VERSION } from '../src/identity.js';

const { generatedAt: _snapshotGeneratedAt, ...contentSnapshot } = snapshot;
const contentHash = createHash('sha256').update(JSON.stringify(contentSnapshot)).digest('hex');

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  sendJson(res, 200, {
    status: 'ok',
    version: SERVER_VERSION,
    guides: snapshot.source.contentCount,
    snapshotGeneratedAt: snapshot.generatedAt,
    latestGuideUpdatedAt: snapshot.source.latestUpdated,
    contentHash,
  }, 'public, max-age=60, s-maxage=300');
}
