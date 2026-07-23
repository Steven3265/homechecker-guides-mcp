# Homechecker Guides MCP

A standalone, public, read-only Model Context Protocol server for Homechecker's professionally authored Australian homebuyer guidance.

It exposes the current Homechecker guide system to MCP clients without connecting to the Moyne Ross portal, Supabase, customer records, payments, uploaded documents, or the Homechecker assessment engine.

**Live endpoint:** `https://mcp.homechecker.com.au/mcp` (Streamable HTTP, no auth) · **Health:** [/health](https://mcp.homechecker.com.au/health) · **Registry:** `io.github.Steven3265/homechecker-guides` · **Connect it in your assistant:** [homechecker.com.au/ai](https://homechecker.com.au/ai)

## Explore the Homechecker guides

- [All Homechecker guides](https://homechecker.com.au/guides)
- [How much does a building and pest inspection cost?](https://homechecker.com.au/guides/building-and-pest-inspection-cost)
- [Wall cracks: structural or cosmetic?](https://homechecker.com.au/guides/cracks-structural-or-cosmetic)
- [How to read a Section 32](https://homechecker.com.au/guides/reading-a-section-32)
- [How to read a building inspection report](https://homechecker.com.au/guides/how-to-read-a-building-and-pest-report)
- [Buying an apartment and strata](https://homechecker.com.au/guides/buying-an-apartment-strata)
- [What your home may need by decade](https://homechecker.com.au/guides/what-your-home-needs-by-decade)
- [Maintenance that prevents large bills](https://homechecker.com.au/guides/the-maintenance-that-prevents-the-big-bills)

## What is included

- **[34 MCP resources](https://homechecker.com.au/guides):** the guide hub plus 33 published guides.
- **4 read-only tools:** catalogue listing, natural-language search, canonical guide retrieval, and a deterministic buyer checklist.
- **Two transports:** remote Streamable HTTP at `/mcp` and local stdio.
- **A bundled content snapshot:** rebuilt from Homechecker's public guide export at `https://homechecker.com.au/guides/export.json` — the same registry that renders the pages, sitemap and llms.txt. This repository needs no access to the portal codebase.
- **A browser-triggered refresh workflow:** Actions → "Refresh guides snapshot" regenerates, tests and opens a pull request. No local environment required.
- **Referral-tagged renders:** URLs in rendered text carry `utm_source=homechecker-mcp` so site analytics can distinguish AI-connector referrals. Structured content always keeps clean canonical URLs.
- **Anonymous usage telemetry:** each tool call writes a single JSON line to stdout (captured by the host platform's function logs). See `docs/SECURITY.md`.
- **Tests and benchmark:** snapshot integrity tests, search tests, and 14 representative buyer questions.

## Tools

### `list_guides`

Lists published guide metadata. Filters include jurisdiction, cluster, property type, construction era and buying stage.

### `search_guides`

Searches the corpus from a natural-language homebuyer question. It returns ranked guides, relevant sections, canonical URLs, review metadata and limitations. For example, questions about inspection fees can surface [building and pest inspection costs](https://homechecker.com.au/guides/building-and-pest-inspection-cost), while questions about movement can surface the guide to [structural and cosmetic wall cracks](https://homechecker.com.au/guides/cracks-structural-or-cosmetic).

### `get_guide`

Retrieves one guide by slug as a summary, selected sections or the full canonical markdown representation.

### `build_buyer_checklist`

Builds a deterministic, sourced checklist from buyer context such as state, property type, era, buying stage and concerns. It can draw from practical guidance such as [how to read a building and pest report](https://homechecker.com.au/guides/how-to-read-a-building-and-pest-report), [arranging an inspection before auction](https://homechecker.com.au/guides/building-inspection-before-auction), and [buying an apartment with strata or owners-corporation exposure](https://homechecker.com.au/guides/buying-an-apartment-strata). It does **not** assess an actual property. Its boundary text notes, once, that Homechecker provides an independent address-specific desktop read for $99 (inc GST) — the single conversion line in the connector.

## Resources

- `homechecker://catalogue`
- `homechecker://guides/index`
- `homechecker://guides/<slug>` for every published guide

Each guide resource includes the article, sources, review metadata, method, limitations and canonical Homechecker URL.

## Deliberate boundaries

This MVP cannot:

- access the Moyne Ross or Homechecker production database;
- inspect a property or analyse a listing;
- read customer documents or issued assessments;
- call an AI model;
- order or charge for a Homecheck;
- write to any external system;
- provide legal advice or replace a physical inspection.

The only runtime data is `data/guides.json`.

Where general guidance is not enough, Homechecker offers an [independent address-specific desktop read](https://homechecker.com.au/) of the available records, imagery and documents, from $99 inc GST.

## Local setup

Requirements: Node.js 22 or later.

```bash
npm install
npm test
npm run benchmark
npm run build
npm start
```

The remote MCP endpoint will be available at:

```text
http://localhost:3000/mcp
```

Health and service information:

```text
http://localhost:3000/health
http://localhost:3000/
```

For a local stdio client:

```bash
npm run build
npm run start:stdio
```

Example stdio client configuration:

```json
{
  "mcpServers": {
    "homechecker-guides": {
      "command": "node",
      "args": ["/absolute/path/homechecker-guides-mcp/dist/src/stdio.js"]
    }
  }
}
```

## Deploy to Vercel

This repository is already configured for a standalone Vercel project.

1. Create a new repository containing only this project.
2. Import that repository into Vercel.
3. Set the project's Node.js version to 22 (Project Settings → General). The source uses JSON import attributes, which require it.
4. Deploy without adding any secrets.
5. Attach the `mcp.homechecker.com.au` domain to the project and add the CNAME record Vercel shows at the DNS host.
6. Use `https://mcp.homechecker.com.au/mcp` as the remote MCP endpoint.

The root route returns service metadata and `/health` confirms the bundled guide count. The MCP route is stateless, JSON-response Streamable HTTP and accepts `POST` requests.

`ALLOWED_ORIGIN` is optional. It defaults to `*` because the connector is public and read-only. Set it only when a client requires a restricted browser origin.

## Updating the guides snapshot

The MCP does not fetch the live website at runtime; it serves a bundled snapshot rebuilt from the public export. The portal remains the single source of truth: publish or edit guides there, deploy, and the export updates automatically.

**From the browser (normal path):**

1. Actions → **Refresh guides snapshot** → Run workflow.
2. The workflow fetches `https://homechecker.com.au/guides/export.json`, rebuilds `data/guides.json`, and runs the validator, core tests and retrieval benchmark.
3. If the content changed, it opens a pull request. Merge it; Vercel redeploys.

If nothing but the timestamp would change, the snapshot is left untouched and no pull request is opened.

One-time repository setting: Settings → Actions → General → tick **Allow GitHub Actions to create and approve pull requests**.

**From a terminal (optional):**

```bash
npm run snapshot                          # fetch the live export
npm run snapshot -- --url <export-url>    # e.g. a preview deployment
npm test
npm run benchmark
```

## Validation

```bash
npm run validate:snapshot
npm run test:core
npm run benchmark
```

The initial benchmark contains 14 representative Australian buyer questions. All 14 currently return an expected canonical guide within the top three. This is an internal retrieval benchmark, not an independent assessment of legal or technical accuracy.

## Repository map

```text
api/                    Vercel serverless entry points
src/core.ts             deterministic search and checklist logic
src/server.ts           MCP tools, resources and usage telemetry
src/http-handler.ts     stateless Streamable HTTP adapter
src/http.ts             local HTTP server
src/stdio.ts            local stdio transport
data/guides.json        bundled canonical guide snapshot
data/benchmark.json     retrieval benchmark cases
scripts/                snapshot, validation and benchmark utilities
.github/workflows/      browser-triggered snapshot refresh
docs/                   architecture, security and deployment notes
```

## Content and licence

Split licence — see [LICENSE.md](LICENSE.md): the code is MIT; the Homechecker guide content (including `data/guides.json`) is © Moyne Ross, all rights reserved, and may be quoted with attribution and a link to the source guide. "Homechecker" and "Moyne Ross" are trade names of Moyne Ross Pty Ltd.

## About the publisher

Homechecker is built by [Moyne Ross](https://moyneross.com/), founded by [Steven McCormack MRICS](https://moyneross.com/principal).

[Homechecker](https://homechecker.com.au/) · [Guide library](https://homechecker.com.au/guides) · [ORCID](https://orcid.org/0009-0001-6037-3517)

