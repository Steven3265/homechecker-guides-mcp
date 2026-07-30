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
- Responses set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## Content controls

The snapshot validator checks:

- unique guide slugs and resource URIs;
- canonical Homechecker URLs;
- complete guide metadata and sections;
- the expected guide count;
- common production-secret marker strings.

## Referral tagging

URLs in rendered text carry `utm_source=homechecker-mcp` for analytics attribution. Structured content always returns clean canonical URLs, and the guide pages declare their own `rel=canonical`, so the parameter has no indexing effect.

## Operational controls recommended before public directory submission

- Add platform rate limiting and basic abuse monitoring.
- Run `npm audit` and dependency review on every release.
- Add uptime monitoring for `/health`.
- Publish a Homechecker privacy policy and support contact.
- Add a security contact or `SECURITY.md` reporting address before making the repository public.
- Review tool descriptions and annotations against each target platform's current connector requirements.

## Product boundary

Do not add portal credentials to this repository. Any later access to customer results should use OAuth and a separate, scoped product API with explicit user-level authorization.
