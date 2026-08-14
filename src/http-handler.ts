import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMcpServer } from './server.js';

const mcpHandler = createMcpHandler(createMcpServer, {
  // Serve the 2026-07-28 stateless protocol while retaining the SDK's
  // stateless compatibility path for 2025-era clients during rollout.
  legacy: 'stateless',
});

const ALLOWED_HEADERS = [
  'Content-Type',
  'Accept',
  'Authorization',
  'MCP-Protocol-Version',
  'Mcp-Method',
  'Mcp-Name',
  'Mcp-Session-Id',
  'Last-Event-ID',
].join(', ');

const EXPOSED_HEADERS = [
  'MCP-Protocol-Version',
  'Mcp-Method',
  'Mcp-Name',
  'Mcp-Session-Id',
].join(', ');

function corsHeaders(): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN?.trim() || '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function withCommonHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of corsHeaders()) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function rpcMethods(request: Request): string[] {
  // Modern MCP clients advertise the routed JSON-RPC method in the
  // Mcp-Method header. Read telemetry from that header only so observability
  // never clones, parses or otherwise touches the protocol request body.
  // Legacy clients may therefore produce an empty methods array, which is
  // preferable to increasing the request path's blast radius for logging.
  const method = request.headers.get('Mcp-Method')?.trim();
  return method ? [method] : [];
}

function logRequest(methods: string[], status: number, durationMs: number): void {
  try {
    console.error(JSON.stringify({ evt: 'mcp_request', methods, status, durationMs, at: new Date().toISOString() }));
  } catch {
    // Never let telemetry interfere with protocol handling.
  }
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    const headers = corsHeaders();
    headers.set('Allow', 'POST, OPTIONS');
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        message: 'This stateless MCP endpoint accepts POST requests. Use an MCP client rather than opening it as a webpage.',
      }),
      { status: 405, headers },
    );
  }

  const started = Date.now();
  const methods = rpcMethods(request);

  try {
    const response = withCommonHeaders(await mcpHandler.fetch(request));
    logRequest(methods, response.status, Date.now() - started);
    return response;
  } catch (error) {
    logRequest(methods, 500, Date.now() - started);
    console.error('[homechecker-mcp] request failed', error);
    const headers = corsHeaders();
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal MCP server error.' },
      }),
      { status: 500, headers },
    );
  }
}

