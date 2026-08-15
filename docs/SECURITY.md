# Security model

## Threat surface kept deliberately small

The server is public and unauthenticated because every operation is read-only and the content is already public on Homechecker.

It has:

- no environment secrets;
- no database client;
- no outbound HTTP requests at runtime (the snapshot refresh fetches the public Homechecker guide export at build/CI time only — never while serving requests);
- no filesystem path supplied by users;
- no customer or account identifiers;
- no upload handling;
- no payment capability;
- no model call;
- no mutable state.

## Content pipeline

The bundled snapshot is rebuilt from `https://homechecker.com.au/guides/export.json` — a public publication of already-public guide content. This repository holds no credentials for, and requires no access to, the portal codebase or any private system. The refresh itself uses Node built-ins. CI installs the locked project dependencies with `npm ci --ignore-scripts` before running the full build and protocol regression suite, so a changed snapshot cannot bypass dependency-backed validation or pull an unpinned tree.

## Usage telemetry

Each tool call writes one JSON line to stderr (`evt: "tool_call"`) containing the tool name, query length or requested guide slug, coarse profile fields (state, property type, era, buying stage), result counts and a timestamp. Raw search text is not logged. The platform's function logs capture these lines under the platform's standard log retention.

There is no authentication, and the application does not record IP addresses, session identifiers, headers or client identity. The purpose is aggregate operational intelligence: which tools are used, whether retrieval succeeds, and which guides are returned. Logging is wrapped so that a telemetry failure can never affect a response.

## Input controls

- Tool arguments are validated by Zod.
- Search input is length-limited.
- Checklist concerns are count- and length-limited.
- HTTP request bodies are limited to 1 MB.
- Only `POST` and `OPTIONS` are accepted at `/mcp`.
- MCP responses remain non-mutable; public read-only REST/discovery responses use bounded cache headers where appropriate and all JSON responses set `X-Content-Type-Options: nosniff`.

## Content controls

The snapshot validator checks:

- unique guide slugs, resource URIs and section IDs;
- canonical Homechecker URLs and HTTPS source links;
- complete guide metadata, sections and valid review/publication dates;
- related-guide and cluster references resolve to published guides;
- the expected guide count;
- common production-secret marker strings across the complete serialized snapshot.

## Referral tagging

URLs in rendered text carry `utm_source=homechecker-mcp` for analytics attribution. Structured content always returns clean canonical URLs, and the guide pages declare their own `rel=canonical`, so the parameter has no indexing effect.

## Operational controls

- Keep platform/edge rate limiting and basic abuse monitoring enabled; do not add stateful in-process throttling to the stateless read service.
- Run `npm audit` and dependency review on every release.
- Keep uptime monitoring on `/health`.
- Keep the Homechecker privacy policy and support route current.
- Maintain a public security reporting route.
- Review tool descriptions and annotations when target-platform connector requirements change.

## Product boundary

Do not add portal credentials to this repository. Any later access to customer results should use OAuth and a separate, scoped product API with explicit user-level authorization.
