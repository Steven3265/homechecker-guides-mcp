# Protocol support

## Supported

- MCP protocol revision `2026-07-28` over stateless Streamable HTTP.
- Stateless compatibility for 2025-era Streamable HTTP clients through the official TypeScript SDK v2 compatibility path.
- MCP `2026-07-28` and legacy-compatible stdio through `serveStdio`.
- `server/discover`, standard request headers, server identity stamping and protocol cache hints supplied by the official SDK.
- Tools and resources only. Every tool is read-only, deterministic and idempotent.

## Deliberately not supported

- Authentication or OAuth.
- MCP Apps.
- Tasks or long-running operations.
- Sampling, roots, elicitation or other server-to-client requests.
- Customer records, uploaded evidence, address-specific assessment or payment.
- Writes to Homechecker, Moyne Ross or any third-party system.

## Compatibility policy

The remote `/mcp` endpoint serves the current stateless protocol and retains the official SDK's stateless 2025 compatibility mode during ecosystem rollout. The tool names, arguments, structured results, canonical URLs and professional boundaries are the stable public contract.

Protocol-level behaviour belongs in the official SDK adapter. Search, checklist and corpus logic remain isolated from transport changes.
