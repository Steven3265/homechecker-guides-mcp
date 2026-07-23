import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleMcpRequest } from '../src/http-handler.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await handleMcpRequest(req, res);
}
