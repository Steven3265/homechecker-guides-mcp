# Protocol support

## Supported

- MCP protocol revision `2026-07-28` over stateless Streamable HTTP.
- Stateless compatibility for 2025-era Streamable HTTP clients through the official TypeScript SDK v2 compatibility path.
- MCP `2026-07-28` and legacy-compatible stdio through `serveStdio`.
- `server/discover`, standard routing headers, server identity stamping and protocol cache hints supplied by the official SDK.
- Host and Origin validation in front of the bare fetch handler using the SDK's framework-agnostic validation helpers.
- Explicit `outputSchema` contracts for structured results from all four tools.
- Tools and resources only. Every tool is read-only, deterministic and idempotent.
- Experimental MCP Server Card discovery at `/mcp/server-card`, isolated from the core protocol so the extension can evolve without changing tool behaviour.

## Deliberately not supported

- Authentication or OAuth.
- MCP Apps.
- Tasks or long-running operations.
- Sampling, roots, elicitation or other server-to-client requests.
- Customer records, uploaded evidence, address-specific assessment or payment.
- Writes to Homechecker, Moyne Ross or any third-party system.

## Compatibility policy

The remote `/mcp` endpoint serves the current stateless protocol and retains the official SDK's stateless 2025 compatibility mode during ecosystem rollout. The tool names, arguments, structured results, canonical URLs and professional boundaries are the stable public contract.

Requests without an `Origin` header pass the Origin boundary, which preserves normal server-to-server MCP clients. A supplied Origin must pass the configured boundary: built-in browser defaults are hostname-based, while operator-configured Origins are exact scheme/host/port values. Invalid or unapproved Origins are rejected with `403`. Host validation is applied independently to protect the public fetch endpoint against DNS-rebinding-style requests.

Protocol-level behaviour belongs in the official SDK adapter. Search, checklist and corpus logic remain isolated from transport changes.

## Conformance

GitHub Actions runs the official active `@modelcontextprotocol/conformance` server suite against a local build and the frozen `2026-07-28` protocol revision. The runner source is pinned to immutable commit `c321dd32035556e6769d3724a8ee97d87c3faaac`, the release commit for npm `0.2.0-alpha.11`; CI builds that checkout using its committed lockfile instead of fetching an executable through `npx` at runtime.

The active runner also exercises fixed reference fixture tool/resource names and capabilities Homechecker deliberately does not advertise (prompts and completion). Those 16 known fixture/capability **checks** are committed individually in `conformance/expected-failures.yml` as `scenario:check-id` entries. Whole scenarios are not excluded, so wire-schema validation inside a fixture-mismatch scenario remains live. The conformance CLI treats that file as a burn-down baseline: a new failure fails CI, and a baselined check that starts passing also fails CI until the stale entry is removed. Release-metadata validation additionally pins the exact reviewed 16 identifiers, so a misspelled or silently added baseline entry cannot be committed without failing the aggregate check. `tools-list`, `resources-list`, wire-schema validation, SSE behaviour and DNS-rebinding protection remain unbaselined. The official runner is additive to Homechecker's own protocol regression tests rather than a replacement for them.
