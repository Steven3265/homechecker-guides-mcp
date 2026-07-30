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

The bundled snapshot is rebuilt from `https://homechecker.com.au/guides/export.json` — a public publication of already-public guide content. This repository holds no credentials for, and requires no access to, the portal codebase or any private system. The refresh workflow runs on Node built-ins with no `npm install`, keeping the CI supply-chain surface at zero third-party packages.

## Usage telemetry

Each tool call writes one JSON line to stderr (`evt: "tool_call"`) containing the tool name, the search query truncated to 200 characters or the requested slug, coarse profile fields (state, property type, era, buying stage), result counts and a timestamp. The platform's function logs capture these lines under the platform's standard log retention.

There is no authentication, so no user identifier exists to log. No IP addresses, session identifiers or headers are recorded by the application. The purpose is aggregate product intelligence: which questions buyers actually ask, and which guides answer them. Logging is wrapped so that a telemetry failure can never affect a response.

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
