# Security model

## Threat surface kept deliberately small

The server is public and unauthenticated because every operation is read-only and the content is already public on Homechecker.

It has:

- no environment secrets required for normal operation;
- no database client;
- no outbound HTTP requests at runtime (the snapshot refresh fetches the public Homechecker guide export at build/CI time only, never while serving requests);
- no filesystem path supplied by users;
- no customer or account identifiers;
- no upload handling;
- no payment capability;
- no model call;
- no mutable state.

## HTTP request boundary

The Streamable HTTP entry applies the MCP TypeScript SDK's framework-agnostic `Host` and `Origin` validation helpers before any protocol request is handled.

- Production Host is `mcp.homechecker.com.au`; Vercel's generated deployment (`VERCEL_URL`), branch alias (`VERCEL_BRANCH_URL`) and project production alias (`VERCEL_PROJECT_PRODUCTION_URL`) are accepted automatically when exposed by Vercel, plus optional comma-separated `ALLOWED_HOSTS`.
- Browser Origin hostnames for Homechecker, current Claude surfaces, ChatGPT and loopback MCP Inspector use are included by default.
- `ALLOWED_ORIGINS` is an authoritative comma-separated exact-origin override: when set, defaults are not silently added, and scheme plus effective port are preserved. Legacy singular `ALLOWED_ORIGIN` retains its prior exact restrictive meaning when set to a concrete origin. Its historical `*` value now selects the safe built-in allowlist rather than disabling the 2026-07-28 Origin guard.
- Built-in browser defaults use the SDK hostname guard so loopback Inspector ports remain usable; configured Origins are validated exactly, so `https://trusted.example:8443` does not permit HTTP or another port.
- Requests without an Origin header pass, preserving ordinary non-browser MCP clients.
- A present malformed, opaque or unapproved Origin is rejected with `403` before MCP handling.
- Wildcard Origin validation is deliberately not supported.

CORS response headers are transport metadata only; they are not used as a substitute for the request-boundary validation above.

## Content pipeline

The bundled snapshot is rebuilt from `https://homechecker.com.au/guides/export.json`, a public publication of already-public guide content. This repository holds no credentials for, and requires no access to, the portal codebase or any private system. The refresh uses Node built-ins. CI installs the locked project dependencies with `npm ci --ignore-scripts` before running the full build and protocol regression suite, so a changed snapshot cannot bypass dependency-backed validation or pull an unpinned tree.

## Usage telemetry

Each tool call writes one JSON line to stderr (`evt: "tool_call"`) containing the tool name, query length or requested guide slug, coarse profile fields (state, property type, era, buying stage), result counts and a timestamp. Raw search text is not logged. The platform's function logs capture these lines under the platform's standard log retention.

There is no authentication, and the application does not intentionally record IP addresses, session identifiers, identifying headers or client identity. The purpose is aggregate operational intelligence: which tools are used, whether retrieval succeeds, and which guides are returned. Logging is wrapped so that a telemetry failure can never affect a response.

## Input and contract controls

- Tool arguments are validated by Zod.
- Every tool advertises and validates an `outputSchema` for successful structured content.
- Search input is length-limited.
- Checklist concerns are count- and length-limited.
- HTTP request bodies are limited by the MCP SDK handler.
- Only `POST` and `OPTIONS` are accepted at `/mcp` after Host/Origin checks.
- MCP responses remain non-mutable; public read-only REST/discovery responses use bounded cache headers where appropriate and all JSON responses set `X-Content-Type-Options: nosniff`.

## Content controls

The snapshot validator checks:

- unique guide slugs, resource URIs and section IDs;
- canonical Homechecker URLs and HTTPS source links;
- complete guide metadata, sections and valid review/publication dates;
- related-guide and cluster references resolve to published guides;
- the expected guide count;
- common production-secret marker strings across the complete serialized snapshot.

The 114-case retrieval evaluation separately gates top-3 recall, weak/background handling, correct-empty behaviour, false-strong negatives and state-rule jurisdiction leakage, including legislation-title/ACT ambiguity.

## Supply-chain and conformance controls

- Runtime and build dependencies remain exact-pinned in `package-lock.json`.
- GitHub Actions are pinned by immutable commit SHA.
- The MCP Registry publisher binary is version- and checksum-pinned.
- The official MCP conformance runner is source-pinned by immutable Git commit; its own committed `package-lock.json` supplies npm integrity verification. Its install deliberately permits upstream lifecycle scripts so the reviewed source checkout is built exactly as released; the checkout is immutable, read-only and has persisted credentials disabled. A committed check-level expected-failures baseline permits only the exact 16 reviewed fixture/capability checks and fails on both new regressions and stale entries; wire-schema checks inside those scenarios are not excluded.
- Dependabot watches npm and GitHub Actions monthly, but does not auto-merge updates; changes still pass the normal release gates.

## Referral attribution

Model-facing MCP text and `canonicalUrl` fields always return clean canonical Homechecker URLs. REST and browser WebMCP adapters may add a separate `referralUrl` field for attribution; they do not rewrite the canonical URL or the URL an assistant is instructed to cite.

## Operational controls

- Keep platform/edge rate limiting and basic abuse monitoring enabled; do not add stateful in-process throttling to the stateless read service.
- Run `npm audit` and dependency review on every release.
- Keep uptime monitoring on `/health`.
- Keep the Homechecker privacy policy and support route current.
- Maintain a public security reporting route.
- Review tool descriptions, annotations, output contracts and discovery metadata when target-platform requirements change.

## Product boundary

Do not add portal credentials to this repository. Any later access to customer results should use OAuth and a separate, scoped product API with explicit user-level authorization.
