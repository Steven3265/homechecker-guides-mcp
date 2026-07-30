import type { IncomingMessage, ServerResponse } from 'node:http';
import { snapshot } from '../src/core.js';
import { SERVER_VERSION } from '../src/identity.js';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ status: 'ok', version: SERVER_VERSION, guides: snapshot.source.contentCount, generatedAt: snapshot.generatedAt }));
}
