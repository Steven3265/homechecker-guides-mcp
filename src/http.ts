import { createServer } from 'node:http';
import { handleMcpRequest } from './http-handler.js';
import { snapshot } from './core.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/mcp') {
    await handleMcpRequest(req, res);
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (url.pathname === '/health') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', guides: snapshot.source.contentCount, generatedAt: snapshot.generatedAt }));
    return;
  }

  if (url.pathname === '/') {
    res.statusCode = 200;
    res.end(JSON.stringify({
      name: 'Homechecker Guides MCP',
      description: 'Read-only Australian homebuyer guidance from Homechecker.',
      mcpEndpoint: '/mcp',
      healthEndpoint: '/health',
      guides: snapshot.source.contentCount,
      latestGuideUpdate: snapshot.source.latestUpdated,
      canonicalSite: snapshot.source.baseUrl,
    }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(port, '0.0.0.0', () => {
  console.error(`[homechecker-mcp] listening on http://localhost:${port}/mcp`);
});
