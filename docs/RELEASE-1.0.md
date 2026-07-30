# Homechecker Guides MCP 1.0.0

This release moves the server from the monolithic MCP TypeScript SDK v1 to the split v2 packages implementing the `2026-07-28` protocol revision.

## Included

- Stable `@modelcontextprotocol/server` v2, using its web-standard HTTP handler directly on Vercel.
- Stateless `createMcpHandler` HTTP serving.
- Automatic `server/discover` and per-request protocol handling.
- Legacy stateless compatibility for 2025-era HTTP clients.
- `serveStdio` for modern and legacy-compatible local clients.
- Standard `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` header support through the SDK.
- Public cache hints for discovery, tool lists, resource lists and resource reads.
- Zod v4 Standard Schema tool definitions.
- Telemetry moved to stderr so local stdio transport cannot be corrupted.
- Updated protocol, security, architecture and deployment documentation.

## Unchanged public contract

- `list_guides`
- `search_guides`
- `get_guide`
- `build_buyer_checklist`
- `homechecker://catalogue`
- `homechecker://guides/*`

The release does not add authentication, product ordering, address assessment, customer data, MCP Apps or Tasks.
