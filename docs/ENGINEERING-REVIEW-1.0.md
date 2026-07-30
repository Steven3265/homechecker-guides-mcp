# Engineering review — 1.0.0

Version 1.0.0 was reviewed against the official MCP TypeScript SDK v2 migration material for protocol revision `2026-07-28`.

## Preserved without change

The migration does not alter the Homechecker knowledge or retrieval layer:

- `src/core.ts`
- `src/types.ts`
- `data/guides.json`
- `data/benchmark.json`
- core and benchmark test cases

The search, ranking, checklist, guide snapshot and public tool contracts therefore remain unchanged.

## Release corrections

- Uses the stable `@modelcontextprotocol/server` v2 package.
- Uses the SDK's web-standard `createMcpHandler` directly in the Vercel function, avoiding the separately published Node adapter.
- Retains the SDK's stateless compatibility path for 2025-era clients.
- Keeps legacy CORS request headers in the allow-list during the transition.
- Uses `serveStdio` for modern and legacy-compatible stdio connections.
- Logs telemetry to stderr so it cannot corrupt the stdio JSON-RPC channel.
- Removes compiled scratch output and stale local-server code from the release archive.

## Validation completed

- Snapshot validator: 34 resources passed.
- Core tests: 17/17 passed.
- Retrieval benchmark: 14/14 passed in the top three.

The GitHub validation workflow installs the released dependencies, runs the same checks and performs the full TypeScript build on every push to `main`.
