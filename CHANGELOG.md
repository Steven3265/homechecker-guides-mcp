# Changelog

## 0.2.2

### Added
- Relevance floors on `search_guides`. Keyword scoring always produced a
  best-ranked guide, so questions outside the corpus — finance, tax,
  valuation, agent selection — returned a confident-looking guide with a
  canonical URL attached. Results below an absolute score floor are now
  suppressed entirely, and a `matchStrength` of `none`, `weak` or `strong`
  is returned so a calling model can tell "this is the answer" from "this
  is the closest thing we have".
- A relative floor that trims weak tail results, so one strong guide is no
  longer padded with two marginal ones that get blended into the answer.
- Empty and weak responses now state what the corpus does and does not
  cover rather than returning a bare list.

### Notes
- The floors are calibrated against the benchmark set and a panel of
  off-topic finance queries; the margin between the two bands is thin and
  pinned by tests. Re-run `scripts/run-benchmark.mjs` after any
  substantial change to the guide set.

## 0.2.1 — 25 July 2026

- Normalised jurisdiction filter values so codes, lowercase codes and full state or territory names produce the same catalogue, search and checklist results.
- Added regression coverage for `Victoria`, `WA`, `wa` and `Western Australia`.

## 0.2.0 — 23 July 2026

- Inverted the content pipeline: the snapshot now rebuilds from the public Homechecker guide export (`/guides/export.json`) instead of compiling portal source. The repository needs no access to the portal codebase at all.
- Added a browser-triggered **Refresh guides snapshot** workflow: fetch, rebuild, validate, test, benchmark, and open a pull request only when content actually changed. Dependency-free (no `npm install`, no third-party actions beyond checkout/setup-node).
- The snapshot script now preserves the previous `generatedAt` when nothing but the timestamp would change, so refresh runs are no-ops until guides genuinely move.
- Added referral tagging (`utm_source=homechecker-mcp`) to URLs in rendered text. Structured content keeps clean canonical URLs.
- Added the single conversion line to the buyer-checklist boundary: an independent address-specific desktop read for $99 (inc GST) at homechecker.com.au.
- Added anonymous tool-call telemetry as JSON lines on stdout (tool, truncated query or slug, coarse profile, counts). Documented in `docs/SECURITY.md`.
- Fixed the build: relaxed `exactOptionalPropertyTypes` — v0.1.0 was never compiled against the installed MCP SDK (its build environment had no registry access) and did not typecheck against SDK 1.29. The full `tsc` build now passes.
- Snapshot metadata records its true origin (the export URL).
- Version 0.2.0 in `package.json` and the MCP server identity.

## 0.1.0 — 23 July 2026

- Created standalone Homechecker Guides MCP repository.
- Bundled 34 published resources from the current portal guide registry.
- Added four read-only tools.
- Added stateless Streamable HTTP and stdio transports.
- Added deterministic search, checklist assembly, validation and a 14-question benchmark.
- Added Vercel deployment configuration.
