# Homechecker discovery and operations repairs — 9 September 2026

Apply this patch to the supplied homechecker-guides-mcp repository. ZIP paths start at the repository root. It contains 18 files: 17 implementation/test/workflow/documentation files and this note. These changes are prepared and tested, not deployed.

## Repairs included

- Allow crawlers to fetch /mcp/server-card while retaining the transport exclusion.
- Set successful attributed REST responses to Cache-Control: no-store. Their bodies vary with X-Homechecker-Source, so they must not be reused across clients by shared caches. Discovery documents retain their existing public caching. Trade-off: REST calls reach the function instead of receiving cached responses; the bundled corpus needs no upstream fetch.
- Run HEAD through the same route validation and headers as GET, suppressing only the response body. Missing guides and invalid requests now keep their correct status.
- Replace raw REST profile-filter telemetry with presence flags; log a guide slug only after it resolves to a known corpus record.
- Reuse automation/guides-snapshot-refresh and its open PR. Identical pending snapshots are skipped; changed snapshots update that branch with force-with-lease. Serialize refresh runs and pass the optional export URL through an environment variable. Existing timestamped PRs are not automatically closed. Refresh still requires merging to update production.
- Verify the exact Registry version and remote connection against server.json, with bounded retries. An older release or wrong endpoint now fails verification. No new Registry version is introduced.

## Validation completed

- npm ci --ignore-scripts completed; npm run check passed.
- Release metadata and all 34 snapshot resources validated.
- 46 core tests passed; zero failed.
- 199-case benchmark gate passed: top-3 90/90; weak/background 13/13; correct-empty 11/11; open-world-safe 85/85; false-strong negatives 0/109; jurisdiction leakage 0/13.
- TypeScript build, HTTP adapter regressions and protocol checks passed.
- Targeted regressions cover all four REST attribution routes, GET/HEAD status and header parity, raw-filter log exclusion, and rejecting wrong Registry names, versions or endpoints.
- Refresh workflow exercised using a temporary local Git remote and simulated GitHub PR commands: initial PR, identical-repeat suppression, existing-PR update, and unchanged-main no-op. Exactly one PR creation was requested. This was not a live GitHub Actions run.
- Both edited workflow YAML files parsed, and their shell steps passed bash syntax checks.
- The live exact-version Registry URL returned HTTP 200 through curl; its response passed the new name/version/remote assertions. Direct Node fetching timed out in this environment, so this is not an end-to-end hosted workflow certification.
- src/core.ts, src/server.ts, src/contracts.ts, protocol handlers, snapshot data, core tests, skill files, package.json and package-lock.json remain byte-identical to the supplied repository. Version remains 1.2.1.

## Coordinated ARD migration

This updated connector patch supersedes Homechecker-1.2.1-Discovery-Operations-Repair-Patch.zip and includes all of its repairs. It additionally changes the advertised ARD URL in api/index.ts, api/server-card.ts, api/mcp-server-card.ts and README.md to https://homechecker.com.au/.well-known/ard.json.

Deploy the companion Homechecker-Website-ARD-Patch.zip FIRST. It adds ard.json as an alias of the existing maintained catalogue, retains ai-catalog.json, and updates host gating, HTML discovery markup, robots Agentmap, llms.txt and the developer page. Then verify the website's new URL returns 200 JSON before deploying this connector patch.

The website patch was checked against the supplied portal repository: shared GET identity, identical catalogue payloads (5 entries / 21 representative queries), apex/www and forwarded-host handling, off-host 404s, middleware routing with a NextResponse test double, guide validation, context privacy validation and focused route/corpus TypeScript checking. A full Next.js production build was not run locally.

After updating the connector links, release metadata validation, TypeScript build and HTTP tests passed again. The full 46-test/199-case/protocol run documented above passed before these URL-only changes.

Reference: https://agenticresourcediscovery.org/spec/#51-discovery-mechanisms (v0.91 proposal).

## Deployment

Copy the ZIP contents into the connector repository, preserving the folders, and merge through the existing release checks. After deployment, check /mcp/server-card, /robots.txt and REST GET/HEAD behaviour. Previously cached REST responses can remain until invalidated or expired; verify responses through the deployed cache. The prior guide response policy allowed up to one hour of shared-cache freshness.

Deployment order: website first, connector second. No production changes were made from this workspace.

## Timestamp-only pending PR correction (v2 patch)

The pending-branch comparison now parses both snapshots and ignores ONLY the top-level generatedAt field. Every other field, including nested timestamps, still participates. Parse and Git errors fail the workflow rather than being treated as equality.

Added scripts/compare-pending-snapshot.mjs and scripts/test-pending-snapshot.mjs. The existing metadata gate runs the new regression, so npm run check includes it without changing package.json. The test builds the same export at two different timestamps from unchanged main with a pending refresh commit, confirms equality against that pending commit, and checks genuine changes and malformed JSON. Metadata validation and the regression passed. An additional execution of the actual workflow shell against a temporary Git remote confirmed the pending branch commit stayed unchanged on the timestamp-only second run and changed on a real third update; GitHub PR commands were simulated.

This v2 ZIP supersedes both previous connector repair ZIPs. It keeps the earlier complete repairs and ARD link updates. The website ARD ZIP is unchanged. Core/retrieval, corpus, dependencies and version remain unchanged. No further full benchmark/protocol rerun was needed for this workflow-only correction; the earlier results remain recorded above.
