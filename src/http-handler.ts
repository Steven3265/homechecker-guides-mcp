import { createMcpHandler, hostHeaderValidationResponse } from '@modelcontextprotocol/server';
import { createMcpServer } from './server.js';
import { clientLabel, runWithClient } from './client-label.js';

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

const DEFAULT_ALLOWED_HOSTNAMES = ['mcp.homechecker.com.au'];
// The browser surfaces this server is known to be reached from. By default
// this list no longer gates anything: it is the reference set reported by
// allowedOriginHostnames() for diagnostics, and a starting point for an
// operator composing an ALLOWED_ORIGINS restriction.
//
// It is kept as a list rather than deleted because naming the known surfaces
// is useful; it is no longer enforced because enumerating them cannot be kept
// current. The ecosystem adds directories, monitors and inspectors faster than
// any allowlist can follow, and each omission presents as an outage rather
// than a refusal: a monitor that is refused reports the server as down, and a
// directory that is refused records it as unreachable and stops retrying.
const DEFAULT_ALLOWED_ORIGIN_HOSTNAMES = [
  'homechecker.com.au',
  'www.homechecker.com.au',
  'mcp.homechecker.com.au',
  'claude.ai',
  'claude.com',
  'chatgpt.com',
  'chat.openai.com',
  'localhost',
  '127.0.0.1',
  '[::1]',
  'glama.ai',
  'www.glama.ai',
  'smithery.ai',
  'www.smithery.ai',
  'mcp.so',
  'www.mcp.so',
  'pulsemcp.com',
  'www.pulsemcp.com',
  'modelcontextprotocol.io',
  'inspector.modelcontextprotocol.io',
  'registry.modelcontextprotocol.io',
];
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', 'test.local'];

function hostnameFromConfig(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return undefined;
  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return undefined;
  }
}

function configuredHostnames(...names: string[]): string[] {
  const values = names
    .flatMap((name) => (process.env[name] ?? '').split(','))
    .map(hostnameFromConfig)
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

export function allowedHostnames(): string[] {
  const local = process.env.VERCEL ? [] : LOCAL_HOSTNAMES;
  return [...new Set([
    ...DEFAULT_ALLOWED_HOSTNAMES,
    ...configuredHostnames(
      'VERCEL_URL',
      'VERCEL_BRANCH_URL',
      'VERCEL_PROJECT_PRODUCTION_URL',
      'ALLOWED_HOSTS',
    ),
    ...local,
  ])];
}

function originFromConfig(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return undefined;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (!/^https?:$/.test(url.protocol)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function configuredOrigins(...names: string[]): string[] {
  const values = names
    .flatMap((name) => (process.env[name] ?? '').split(','))
    .map(originFromConfig)
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

function configuredOriginOverride(): string[] | undefined {
  // ALLOWED_ORIGINS is authoritative and exact. Scheme and effective port are
  // part of an Origin, so `https://trusted.example:8443` does not implicitly
  // permit http://trusted.example:8443 or https://trusted.example:443.
  // An invalid non-empty value fails closed with an empty allowlist.
  if ((process.env.ALLOWED_ORIGINS ?? '').trim()) {
    return configuredOrigins('ALLOWED_ORIGINS');
  }

  // Preserve the old singular ALLOWED_ORIGIN restriction when operators
  // already have it configured. The historical wildcard means "use the safe
  // defaults"; it never disables Origin validation.
  const legacy = (process.env.ALLOWED_ORIGIN ?? '').trim();
  if (legacy && legacy !== '*') {
    return configuredOrigins('ALLOWED_ORIGIN');
  }
  return undefined;
}

export function allowedOrigins(): string[] | undefined {
  const configured = configuredOriginOverride();
  return configured === undefined ? undefined : [...configured];
}

export function allowedOriginHostnames(): string[] {
  const configured = configuredOriginOverride();
  if (configured !== undefined) {
    return [...new Set(configured.map((origin) => new URL(origin).hostname))];
  }

  return [...new Set([
    ...DEFAULT_ALLOWED_ORIGIN_HOSTNAMES,
    ...(process.env.VERCEL ? [] : ['test.local']),
  ])];
}

function originForbiddenResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message },
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
}

// Origin is validated only when an operator has configured an explicit
// allowlist. Without one, any Origin is admitted.
//
// Origin validation exists to blunt DNS rebinding, where a browser is steered
// into reaching a resource that is private to the victim's network or that
// trusts the browser's ambient credentials. Neither applies here. This
// endpoint is public, read-only, unauthenticated and carries no cookies, no
// session and no customer data; its whole corpus is already published as
// static files and mirrored in a public repository. A browser admitted by
// this function can reach nothing that `curl` could not already reach
// anonymously, so refusing it protects no secret.
//
// It also never protected one. Origin is set by browsers; any non-browser
// client can simply omit the header, and the request is then admitted
// unconditionally. An Origin allowlist is therefore a restriction only on
// callers honest enough to identify themselves, which inverts the intent: the
// well-behaved directory crawler and uptime monitor announce who they are and
// are refused, while an impolite client is waved through.
//
// Host validation is unchanged and still runs ahead of this, binding the
// endpoint to its own hostnames. That is the control that actually answers
// rebinding, and it does not depend on the caller's candour.
function exactOriginValidationResponse(request: Request): Response | undefined {
  const configured = configuredOriginOverride();
  if (configured === undefined) return undefined;

  const rawOrigin = request.headers.get('Origin')?.trim();
  if (!rawOrigin) return undefined;

  let origin: string;
  try {
    const parsed = new URL(rawOrigin);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('unsupported origin scheme');
    origin = parsed.origin;
  } catch {
    return originForbiddenResponse('Forbidden: invalid Origin');
  }

  return configured.includes(origin)
    ? undefined
    : originForbiddenResponse('Forbidden: Origin not allowed');
}

function corsHeaders(request?: Request): Headers {
  const headers = new Headers();
  const origin = request?.headers.get('Origin')?.trim();
  headers.set('Access-Control-Allow-Origin', origin || '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);
  headers.set('Vary', 'Origin');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function withCommonHeaders(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of corsHeaders(request)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function validateRequestBoundary(request: Request): Response | undefined {
  const rejected =
    hostHeaderValidationResponse(request, allowedHostnames()) ??
    exactOriginValidationResponse(request);

  // Do not reflect an untrusted Origin back in CORS headers on a rejected
  // request. The guard response remains deliberately minimal.
  return rejected ? withSecurityHeaders(rejected) : undefined;
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

// Discovery and handshake methods only. A client that names a protocol
// revision in MCP-Protocol-Version but sends a body shaped for an earlier one
// is rejected by the SDK's envelope check, which is correct: the two disagree.
// For these read-only methods the answer shape is stable across revisions, so
// the disagreement costs nothing and the request is retried on the legacy
// stateless path rather than refused. Public directories and index crawlers
// routinely mis-declare this way, and a refused tools/list is the difference
// between a listed connector and an unlisted one.
//
// tools/call is deliberately absent. There, a client that has misread its own
// revision may also misread the result, and guidance about a person's home is
// not worth serving into that uncertainty.
const LENIENT_METHODS = new Set([
  'initialize',
  // The notification that completes the handshake. Harmless, carries no id,
  // and a crawler whose initialize succeeded should not be refused here.
  'notifications/initialized',
  'server/discover',
  'tools/list',
  'resources/list',
  'resources/templates/list',
  'prompts/list',
]);

// Streamable HTTP requires a client to accept both media types. Simple HTTP
// clients and index crawlers frequently send neither, or only one.
const STREAMABLE_HTTP_ACCEPT = 'application/json, text/event-stream';

function acceptsStreamableHttp(request: Request): boolean {
  const accept = request.headers.get('Accept')?.toLowerCase() ?? '';
  return accept.includes('application/json') && accept.includes('text/event-stream');
}

// True when the SDK refused the request because the named revision and the
// body's envelope disagree, rather than for any other bad-request reason.
function isEnvelopeMismatch(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return false;

  const { code, data, message } = error as { code?: unknown; data?: unknown; message?: unknown };
  if (code !== -32602 && code !== -32020) return false;
  if (data && typeof data === 'object' && 'envelope' in (data as object)) return true;
  return typeof message === 'string' && /envelope|headers and body disagree/i.test(message);
}

// The request's JSON-RPC method names, but only when every message in it is
// one of the lenient methods. A batch mixing a tool call into a discovery
// batch is not retried.
function lenientMethodNames(body: string): string[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }

  const messages = Array.isArray(parsed) ? parsed : [parsed];
  if (messages.length === 0) return undefined;

  const names = messages.map((message) =>
    message && typeof message === 'object' ? (message as { method?: unknown }).method : undefined,
  );
  if (names.some((name) => typeof name !== 'string' || !LENIENT_METHODS.has(name))) return undefined;
  return names as string[];
}

function logRequest(methods: string[], client: string, endpoint: string, status: number, durationMs: number): void {
  try {
    console.error(JSON.stringify({ evt: 'mcp_request', methods, client, endpoint, status, durationMs, at: new Date().toISOString() }));
  } catch {
    // Never let telemetry interfere with protocol handling.
  }
}

export type McpEndpointOptions = {
  // 'openai' serves the OpenAI directory listing at /mcp/openai: the same
  // tools, corpus and answers, without the person-facing Read link.
  endpoint?: 'standard' | 'openai';
};

export async function handleMcpRequest(request: Request, options: McpEndpointOptions = {}): Promise<Response> {
  const endpoint = options.endpoint ?? 'standard';
  // Host validation defends the bare fetch endpoint against DNS-rebinding-style
  // requests and applies to every caller. Origin is additionally validated only
  // when ALLOWED_ORIGINS or a concrete legacy ALLOWED_ORIGIN is configured; by
  // default any Origin is admitted, because this endpoint is public, read-only
  // and unauthenticated. See exactOriginValidationResponse.
  const rejected = validateRequestBoundary(request);
  if (rejected) return rejected;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    const headers = corsHeaders(request);
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
  const client = clientLabel(request.headers.get('User-Agent'));
  // OpenAI's app directory does not allow promoting digital services, so the
  // Read link is left out on the OpenAI endpoint and for ChatGPT on /mcp.
  const readLinks = endpoint !== 'openai' && client !== 'chatgpt';

  // The body is buffered only when the request carries something that may need
  // correcting — a named protocol revision, or an Accept header that does not
  // meet streamable HTTP. A conformant client's request still goes straight to
  // the SDK without the handler touching its body.
  const declaresRevision = Boolean(request.headers.get('MCP-Protocol-Version')?.trim());
  const bufferedBody =
    declaresRevision || !acceptsStreamableHttp(request) ? await request.text() : undefined;
  const dispatch = (headers?: Headers): Promise<Response> =>
    mcpHandler.fetch(
      bufferedBody === undefined
        ? request
        : new Request(request.url, {
            method: request.method,
            headers: headers ?? request.headers,
            body: bufferedBody,
          }),
    );

  try {
    let result = await runWithClient(client, () => dispatch(), readLinks);

    // Corrections for read-only discovery calls, applied one at a time and
    // only after the request has actually been refused, so a client is never
    // adjusted for a fault it did not have. A request can carry both faults,
    // and fixing one reveals the other, so this re-reads the outcome after
    // each correction; two passes covers every combination the SDK raises.
    if (bufferedBody !== undefined && lenientMethodNames(bufferedBody)) {
      const corrected = new Headers(request.headers);

      for (let pass = 0; pass < 2; pass += 1) {
        const accept = corrected.get('Accept')?.toLowerCase() ?? '';
        const acceptIncomplete =
          !accept.includes('application/json') || !accept.includes('text/event-stream');

        if (result.status === 406 && acceptIncomplete) {
          corrected.set('Accept', STREAMABLE_HTTP_ACCEPT);
        } else if (
          result.status === 400 &&
          corrected.has('MCP-Protocol-Version') &&
          isEnvelopeMismatch(await result.clone().json().catch(() => undefined))
        ) {
          // Drop the disputed revision header and let the SDK's stateless
          // compatibility path serve the discovery call.
          corrected.delete('MCP-Protocol-Version');
        } else {
          break;
        }

        result = await runWithClient(client, () => dispatch(corrected), readLinks);
      }
    }

    const response = withCommonHeaders(result, request);
    logRequest(methods, client, endpoint, response.status, Date.now() - started);
    return response;
  } catch (error) {
    logRequest(methods, client, endpoint, 500, Date.now() - started);
    console.error('[homechecker-mcp] request failed', error);
    const headers = corsHeaders(request);
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
