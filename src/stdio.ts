import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './server.js';

async function main(): Promise<void> {
  console.error('[homechecker-mcp] starting stdio transport');
  await serveStdio(createMcpServer);
}

main().catch((error: unknown) => {
  console.error('[homechecker-mcp] fatal stdio error', error);
  process.exitCode = 1;
});
