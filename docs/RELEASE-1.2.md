# Homechecker Guides MCP 1.2.0

Version 1.2 is a protocol-hardening and retrieval-quality release. It keeps the four-tool, read-only, deterministic architecture intact while tightening the public machine contract around it.

## What changed

- Rolls the pending machine-integrity work into the release: model-facing citations remain canonical, and authored relationships back to the `/guides` hub are preserved as the stable `guides` alias.
- Added SDK-native Host and Origin validation before the Streamable HTTP handler. Supplied invalid or unapproved Origins now receive `403`; non-browser clients that omit Origin are unaffected.
- Added explicit `outputSchema` definitions for all four tools so clients can discover the structure of successful `structuredContent` before invoking a tool.
- Added richer MCP server identity: title, description, website and a first-party Homechecker icon.
- Added an experimental-extension MCP Server Card at `/mcp/server-card`, containing identity and remote connection details only. The existing `/server-card.json` remains as richer Homechecker service metadata for compatibility.
- Added a dedicated official MCP conformance CI workflow, pinned by immutable source commit to the `@modelcontextprotocol/conformance@0.2.0-alpha.11` release, the `2026-07-28` protocol revision and the active server suite. A committed check-level expected-failures baseline records only 16 fixture/capability checks outside Homechecker's advertised surface; whole scenarios are not excluded, so wire-schema regressions remain live and both new failures and stale baseline entries fail CI.
- Expanded the retrieval benchmark from 14 to 114 cases covering every published spoke twice, typo and mixed-concept probes, state-rule isolation and conflicts, legislation-title ambiguity, weak/background handling and correct-empty off-topic behaviour.
- Added release metrics for top-1/top-3 recall, correct-empty rate, false-strong negatives and jurisdiction leakage.
- Fixed jurisdiction inference for negated and multi-state language, added Australian capital-city aliases, and stopped ordinary legislation wording such as “Conveyancing Act” or “Building Act” from being misread as the ACT. Explicit `ACT`, `in act`, `in the ACT`, `Canberra` and `Australian Capital Territory` remain supported.
- Made multi-state retrieval set-based whenever more than one non-negated jurisdiction is named, so queries spanning Victoria and Queensland retain both dedicated disclosure guides even without an explicit “compare” keyword.
- Tightened era confidence so bare calendar years and generic “modern” language cannot manufacture a strong Homechecker answer to market/finance questions; construction-linked years and genuine era questions continue to route correctly.
- Made operator-configured Origins exact by scheme, hostname and effective port while retaining hostname-based defaults for loopback/browser interoperability.
- Added monthly Dependabot monitoring for npm and GitHub Actions pins; updates remain review-gated and are never auto-merged.
- Enriched official Registry metadata with the bundled first-party icon.

## Intentionally unchanged

- Four public tools: `list_guides`, `search_guides`, `get_guide`, `build_buyer_checklist`.
- 35 MCP resources for the catalogue, guide hub and 33 published guide spokes.
- Deterministic bundled snapshot and retrieval logic.
- No auth, database, model calls, customer data, uploads, payments or writes.
- Stateless current protocol with the SDK's 2025-era compatibility path.

## Deployment note

No secret is required. Vercel's generated deployment, branch and project-production hostnames are accepted from `VERCEL_URL`, `VERCEL_BRANCH_URL` and `VERCEL_PROJECT_PRODUCTION_URL`; additional deployment hostnames can be allowed with `ALLOWED_HOSTS`. Browser clients can be restricted with the authoritative comma-separated `ALLOWED_ORIGINS` override; configured values are exact Origins, including scheme and effective port. If only legacy `ALLOWED_ORIGIN` is set, its old exact single-origin restriction is preserved; the historical `*` value falls back to the safe built-in allowlist rather than disabling Origin validation.

After deployment, update Homechecker's external AI Catalog / developer copy to point the MCP Server Card reference to `https://mcp.homechecker.com.au/mcp/server-card`. The old `https://mcp.homechecker.com.au/server-card.json` route remains available as extended service metadata, so this can be rolled out without breaking existing consumers.

The GitHub numeric `repository.id` Registry field is deliberately not fabricated in this patch. Add it only after reading the immutable repository ID from GitHub's API (for example `gh api repos/Steven3265/homechecker-guides-mcp --jq '.id'`).
