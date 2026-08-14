# Homechecker Guides MCP

[![Smithery](https://smithery.ai/badge/steven-xv6y/homechecker-guides)](https://smithery.ai/servers/steven-xv6y/homechecker-guides)

Homechecker's professionally authored guides for Australian homebuyers, served over the Model Context Protocol and a set of complementary machine-readable interfaces. A connected assistant can search the corpus, retrieve canonical guides and build sourced buyer checklists across inspections, contracts, strata, construction eras, disclosure and maintenance, citing homechecker.com.au throughout.

Public, read-only and deliberately separated from customer and assessment systems.

The service exposes the current Homechecker guide system without connecting to the Moyne Ross portal, Supabase, customer records, payments, uploaded documents or the Homechecker assessment engine.

**Version:** `1.1.0` · **Protocol:** MCP `2026-07-28` with stateless 2025-era compatibility · **Live endpoint:** `https://mcp.homechecker.com.au/mcp` · **Health:** [mcp.homechecker.com.au/health](https://mcp.homechecker.com.au/health) · **Official Registry:** `io.github.Steven3265/homechecker-guides` · **Connect it:** [homechecker.com.au/ai](https://homechecker.com.au/ai)

## Machine discovery surface

Homechecker publishes one deterministic guide corpus through several interoperable discovery and execution surfaces.

- **MCP:** `https://mcp.homechecker.com.au/mcp`
- **First-party MCP server card:** `https://mcp.homechecker.com.au/server-card.json`
- **Read-only REST API:** `https://mcp.homechecker.com.au/v1/*`
- **OpenAPI 3.1:** `https://mcp.homechecker.com.au/openapi.json`
- **ARD catalogue:** `https://homechecker.com.au/.well-known/ai-catalog.json`
- **Agent Skills:** `skills/*/SKILL.md`
- **Homechecker llms.txt:** `https://homechecker.com.au/llms.txt`
- **Guide RSS feed:** `https://homechecker.com.au/guides/feed.xml`
- **Machine-readable guide export:** `https://homechecker.com.au/guides/export.json`
- **Claude plugin package:** `.claude-plugin/plugin.json` + `.mcp.json`
- **GitHub Copilot plugin package:** `.github/plugin/marketplace.json`
- **OpenAI distribution package:** `distribution/openai/homechecker/`
- **GitHub Agent Finder contribution pack:** `distribution/github-agentfinder/`

The repository is also a portable **Agent Plugins 1.0.0** package. `plugin.json` identifies the package, `skills/` contains the open Agent Skills, and `mcp.json` points compatible clients to the hosted Streamable HTTP MCP server.

These are adapters around one knowledge system, not separate versions of Homechecker. The canonical editorial corpus remains on homechecker.com.au, the MCP serves a deterministic snapshot of that corpus, and every machine interface ultimately resolves to the same retrieval core and canonical source URLs.

## Ecosystem listings

Homechecker Guides is independently indexed across the emerging MCP ecosystem. These third-party listings may update on their own cadence.

- [Smithery](https://smithery.ai/servers/steven-xv6y/homechecker-guides)
- [Glama](https://glama.ai/mcp/servers/Steven3265/homechecker-guides-mcp)
- [LobeHub](https://lobehub.com/mcp/steven3265-homechecker-guides-mcp)
- [M8ven](https://m8ven.ai/mcp/steven3265-homechecker-guides-mcp-kzff9o)

The authoritative server identity remains `io.github.Steven3265/homechecker-guides` in the official MCP Registry, with the canonical live endpoint at `https://mcp.homechecker.com.au/mcp`.

## Protocol foundation

Version 1.1.0 uses the MCP TypeScript SDK v2 server package and the `2026-07-28` protocol revision.

The official `createMcpHandler` entry provides stateless per-request serving, `server/discover`, modern MCP routing headers, server identity and cache fields while retaining stateless compatibility for 2025-era HTTP clients during rollout.

For modern Streamable HTTP requests, the SDK validates the MCP protocol-routing headers against the JSON-RPC request and rejects mismatches. Application telemetry reads the `Mcp-Method` protocol header for operational method identification but does not parse the JSON-RPC body for logging.

The protocol shell can evolve independently of the durable parts of the product: the reviewed snapshot, deterministic retrieval, tool contracts and professional boundaries.

See [`docs/PROTOCOL-SUPPORT.md`](docs/PROTOCOL-SUPPORT.md), [`docs/RELEASE-1.0.md`](docs/RELEASE-1.0.md), [`docs/RELEASE-1.0.1.md`](docs/RELEASE-1.0.1.md) and [`CHANGELOG.md`](CHANGELOG.md).

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

- **35 MCP resources:** one machine-readable catalogue, the guide hub and 33 published guides.
- **4 read-only MCP tools:** catalogue listing, natural-language search, canonical guide retrieval and a deterministic buyer checklist.
- **Read-only HTTP adapters:** REST endpoints exposing the same deterministic list, search, retrieval and checklist functions.
- **OpenAPI 3.1:** a machine-readable description of the REST surface for clients that do not speak MCP.
- **First-party server card:** publisher, protocol, tools, schemas, interfaces, privacy properties and operating boundaries in one machine-readable document.
- **4 Agent Skills:** portable workflows for Australian homebuyer due diligence, property documents, building-risk interpretation and home-ownership planning.
- **Two MCP transports:** stateless remote Streamable HTTP at `/mcp` and modern/legacy-compatible local stdio.
- **A bundled content snapshot:** rebuilt from Homechecker's public guide export at `https://homechecker.com.au/guides/export.json`. The repository needs no runtime access to the portal codebase.
- **A browser-triggered refresh workflow:** Actions → **Refresh guides snapshot** regenerates, tests and opens a pull request. No local environment is required.
- **Referral-tagged machine traffic:** rendered MCP links use `utm_source=homechecker-mcp`; REST responses preserve the clean `canonicalUrl` and add a separately tagged `referralUrl` using `homechecker-rest`. Browser WebMCP calls use `homechecker-webmcp`.
- **Privacy-minimised operational telemetry:** application telemetry records operational fields such as MCP method, tool name, query length, coarse filters, counts, match strength, outcome and duration where applicable. Raw questions, session identifiers, IP addresses and identifying request-header values are not intentionally logged by the application. See `docs/SECURITY.md`.
- **Tests and benchmark:** snapshot integrity, core search, release metadata, protocol and HTTP-adapter checks plus 14 representative buyer questions.

## Tools

### `list_guides`

Lists published guide metadata.

Filters include jurisdiction, cluster, property type, construction era and buying stage.

### `search_guides`

Searches the corpus from a natural-language homebuyer question.

It returns ranked guides, relevant sections, canonical URLs, review metadata and limitations. Questions about inspection fees can surface [building and pest inspection costs](https://homechecker.com.au/guides/building-and-pest-inspection-cost), while questions about movement can surface the guide to [structural and cosmetic wall cracks](https://homechecker.com.au/guides/cracks-structural-or-cosmetic).

### `get_guide`

Retrieves one guide by slug as a summary, selected sections or the full canonical markdown representation.

### `build_buyer_checklist`

Builds a deterministic, sourced checklist from buyer context such as state, property type, era, buying stage and concerns.

It can draw from practical guidance such as [how to read a building and pest report](https://homechecker.com.au/guides/how-to-read-a-building-and-pest-report), [arranging an inspection before auction](https://homechecker.com.au/guides/building-inspection-before-auction), and [buying an apartment with strata or owners-corporation exposure](https://homechecker.com.au/guides/buying-an-apartment-strata).

It does **not** assess an actual property. Its boundary text notes once that Homechecker provides an independent address-specific desktop read for $99 inc GST.

## Read-only REST API

The REST surface provides ordinary HTTP access to the same deterministic functions for systems that do not use MCP.

### List guides

```text
GET https://mcp.homechecker.com.au/v1/guides
```

### Search guides

```text
GET https://mcp.homechecker.com.au/v1/search?query=what+should+i+check+before+buying+an+older+house
```

### Retrieve a guide

```text
GET https://mcp.homechecker.com.au/v1/guide?slug=reading-a-section-32
```

### Build a checklist

```text
GET https://mcp.homechecker.com.au/v1/checklist?jurisdiction=VIC&era=1950s-1970s
```

REST results preserve clean canonical Homechecker URLs and expose separately tagged referral URLs for attribution.

The complete contract is published at:

```text
https://mcp.homechecker.com.au/openapi.json
```

## Agent Skills

The canonical portable Skills live under `skills/`.

### Australian Homebuyer Due Diligence

`skills/australian-homebuyer-due-diligence/SKILL.md`

Structures sourced residential-property due diligence before an offer, auction or contract becomes binding.

### Australian Property Documents

`skills/australian-property-documents/SKILL.md`

Provides jurisdiction-aware workflows for understanding sale disclosure, contracts and strata or owners-corporation material.

### Australian Building Risk Reader

`skills/australian-building-risk-reader/SKILL.md`

Helps an agent reason carefully about common Australian residential-building risks by era, construction and symptom without remotely diagnosing a property.

### Australian Home Ownership Planner

`skills/australian-home-ownership-planner/SKILL.md`

Organises maintenance, records, renovation preparation and ownership planning using Homechecker guidance.

`skills/` is the canonical source. Public and OpenAI distribution copies are synchronised from these files and release validation fails if the copies drift.

## Discovery

Homechecker's first-party Agentic Resource Discovery catalogue is published at:

```text
https://homechecker.com.au/.well-known/ai-catalog.json
```

It describes the Homechecker MCP and all four Agent Skills using domain-anchored identifiers and representative natural-language queries.

Homechecker's `robots.txt` also advertises the catalogue through:

```text
Agentmap: https://homechecker.com.au/.well-known/ai-catalog.json
```

The same machine identity is reinforced through `llms.txt`, the guide RSS feed, OpenAPI, the MCP server card, GitHub and the official MCP Registry.

## Resources

- `homechecker://catalogue`
- `homechecker://guides/index`
- `homechecker://guides/<slug>` for every published guide

Each guide resource includes the article, sources, review metadata, method, limitations and canonical Homechecker URL.

## Deliberate boundaries

This service cannot:

- access the Moyne Ross or Homechecker production database;
- inspect a property or analyse a listing;
- read customer documents or issued assessments;
- call an AI model;
- order or charge for a Homecheck;
- write to any external system;
- provide legal advice or replace a physical inspection.

The only runtime content dataset is `data/guides.json`.

Where general guidance is not enough, Homechecker offers an [independent address-specific desktop read](https://homechecker.com.au/) of the available records, imagery and documents, from $99 inc GST.

## Privacy and security

The service is public, read-only and requires no authentication.

It does not have credentials for the Moyne Ross portal, Supabase, payments, customer files or assessment systems.

Application-level operational telemetry is deliberately minimised. It may record:

- the MCP protocol method;
- tool name;
- query length rather than query text;
- coarse filters;
- result counts;
- match strength;
- request outcome;
- duration.

The application does not intentionally log raw questions, session identifiers, IP addresses or identifying request-header values.

Infrastructure providers may maintain their own access and security logs independently of the application.

See [`docs/SECURITY.md`](docs/SECURITY.md) and [`data/TERMS.md`](data/TERMS.md).

## Local setup

Requirements: Node.js 22 or later.

```bash
npm install
npm test
npm run benchmark
npm run check
npx vercel dev
```

The remote MCP endpoint will be available at:

```text
http://localhost:3000/mcp
```

Machine service information:

```text
http://localhost:3000/
http://localhost:3000/health
http://localhost:3000/server-card.json
http://localhost:3000/openapi.json
http://localhost:3000/v1/guides
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

This repository is configured as a standalone Vercel project.

1. Create or use the repository containing this project.
2. Import the repository into Vercel.
3. Set the project's Node.js version to 22.
4. Deploy without adding any application secrets.
5. Attach `mcp.homechecker.com.au` to the project.
6. Use `https://mcp.homechecker.com.au/mcp` as the remote MCP endpoint.

The root route publishes service metadata, `/health` confirms the bundled guide count, `/server-card.json` publishes the first-party MCP card, `/openapi.json` describes the REST surface, and `/v1/*` provides read-only HTTP adapters.

`ALLOWED_ORIGIN` is optional. It defaults to `*` because the connector is public and read-only. Set it only where a client requires a restricted browser origin.

## Official MCP Registry

The registered server identity is:

```text
io.github.Steven3265/homechecker-guides
```

Release publication is automated through:

**GitHub → Actions → Publish to MCP Registry → Run workflow**

The workflow installs dependencies, runs the release checks, authenticates with GitHub OIDC, publishes the current `server.json` metadata and verifies that the official Registry can resolve the Homechecker server.

Version `1.1.0` is published to the official MCP Registry.

## Updating the guides snapshot

The MCP does not fetch the live website at runtime. It serves a bundled snapshot rebuilt from the public export.

The Homechecker portal remains the editorial source of truth: publish or edit guides there, deploy, and the export updates automatically.

**From the browser:**

1. Actions → **Refresh guides snapshot** → Run workflow.
2. The workflow fetches `https://homechecker.com.au/guides/export.json`.
3. It rebuilds `data/guides.json` and runs the validator, core tests and retrieval benchmark.
4. If content changed, it opens a pull request.
5. Merge the pull request and Vercel redeploys.

If nothing but the timestamp would change, the snapshot is left untouched and no pull request is opened.

One-time repository setting:

**Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**

**From a terminal, optionally:**

```bash
npm run snapshot
npm run snapshot -- --url <export-url>
npm test
npm run benchmark
```

## Validation

```bash
npm run validate:snapshot
npm run test:core
npm run benchmark
npm run check
```

The retrieval benchmark contains 14 representative Australian buyer questions. All 14 currently return an expected canonical guide within the top three.

This is an internal retrieval benchmark, not an independent assessment of legal or technical accuracy.

Release validation also checks machine-distribution metadata and ensures derived Skill copies remain identical to the canonical `skills/` source.

## Repository map

```text
api/
  index.ts                 service metadata
  mcp.ts                   Streamable HTTP MCP endpoint
  health.ts                health and snapshot status
  server-card.ts           first-party MCP server card
  openapi.ts               OpenAPI 3.1 description
  v1/                      read-only REST adapters

src/
  identity.ts              canonical server/protocol identity
  core.ts                  deterministic search and checklist logic
  server.ts                MCP tools, resources and operational telemetry
  http-handler.ts          REST adapter over the deterministic core
  http-json.ts             shared HTTP/CORS/attribution helpers
  stdio.ts                 local stdio entry

skills/                    canonical portable Agent Skills
public/skills/             public synchronised Skill copies
distribution/
  openai/homechecker/      OpenAI Skills/plugin submission package
  github-agentfinder/      GitHub Agent Finder contribution records

.claude-plugin/            Claude plugin metadata
.github/plugin/            GitHub/Copilot plugin metadata
.github/workflows/         validation, refresh and Registry publication
plugin.json                Agent Plugins package manifest
mcp.json                   Agent Plugins MCP dependency
.mcp.json                  Claude-compatible MCP configuration

data/guides.json           bundled canonical guide snapshot
data/TERMS.md              editorial corpus terms
data/benchmark.json        retrieval benchmark cases

scripts/                   snapshot, Skill sync, validation and benchmarks
docs/                      architecture, protocol, security and release notes
public/.well-known/        machine-readable security contact
vercel.json                production routing
```

## Content and licence

The software and configuration code are MIT-licensed under [LICENSE.md](LICENSE.md).

The Homechecker editorial corpus, including `data/guides.json` and guide material reproduced elsewhere in this repository, remains © Moyne Ross Pty Ltd and is governed separately by [data/TERMS.md](data/TERMS.md).

Reasonable extracts may be quoted with attribution and a link to the canonical guide.

"Homechecker" and "Moyne Ross" are trade names of Moyne Ross Pty Ltd.

## About the publisher

Homechecker is a residential guidance and assessment service operated by Moyne Ross Pty Ltd.

[Homechecker](https://homechecker.com.au/) · [Guide library](https://homechecker.com.au/guides) · [AI & connector](https://homechecker.com.au/ai) · [Moyne Ross](https://moyneross.com/)
