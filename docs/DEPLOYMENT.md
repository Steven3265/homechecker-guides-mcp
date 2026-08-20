# Deployment checklist

## Prerequisite: the public guide export

- [ ] The portal serves `https://homechecker.com.au/guides/export.json` (deploy `app/guides/export.json/route.ts` in the portal first).
- [ ] The export returns `schemaVersion: 1` with `publishedGuides` and `guideClusters` arrays and the expected guide count.

## Before deployment

- [ ] Run the **Refresh guides snapshot** workflow once against the live export and merge its pull request, so `data/guides.json` records the export as its origin.
- [ ] Confirm **Validate MCP release** passed: snapshot, core tests, benchmark, TypeScript build and protocol regression suite.
- [ ] Confirm the repository contains no `.env` file or portal credentials.
- [ ] Review `npm audit` after installing dependencies.
- [ ] One-time repo setting: Settings → Actions → General → tick **Allow GitHub Actions to create and approve pull requests**.

## Vercel

- [ ] Create a standalone Vercel project (never attach the portal's environment variables).
- [ ] Set the project's Node.js version to **22** — the source uses JSON import attributes and will not build on 20.
- [ ] Deploy the repository root.
- [ ] Open `/health` and confirm `guides: 34`, version `1.1.1`, a 64-character `contentHash`, and the expected snapshot/latest-guide timestamps.
- [ ] Open `/` and confirm the public service metadata.
- [ ] Test `https://<project>.vercel.app/mcp` with an MCP client or the MCP Inspector.

## Domain

- [ ] Add `mcp.homechecker.com.au` to the Vercel project (Settings → Domains).
- [ ] Create the CNAME record Vercel displays at the DNS host.
- [ ] Confirm `https://mcp.homechecker.com.au/health` responds.

## Client acceptance tests

- [ ] The client lists exactly four tools.
- [ ] The client lists 35 resources: the catalogue plus 34 guide resources.
- [ ] `search_guides("Section 32 Victoria")` returns `reading-a-section-32` first.
- [ ] `get_guide("reading-a-section-32")` returns the full guide; both rendered text and structured `canonicalUrl` use the clean canonical URL with no referral parameter.
- [ ] A buyer checklist includes the non-assessment boundary and the single $99 address-specific line.
- [ ] Tool calls appear as `evt: "tool_call"` JSON lines in Vercel logs without raw search text.
- [ ] No tool requests payment, authentication or customer information.

## After deployment

- [ ] Confirm uptime monitoring is active on `/health`.
- [ ] Confirm the scheduled **Refresh guides snapshot** workflow is enabled and succeeding daily.
- [ ] Confirm platform/edge abuse protection or rate limiting is enabled for `/mcp` and `/v1/*`.
- [ ] Record the deployed endpoint, snapshot timestamp and content hash.
- [ ] Confirm REST/WebMCP `referralUrl` attribution behaves as expected without altering canonical citation URLs.
- [ ] Test from each intended MCP host separately.
- [ ] Keep directory submission until after real client testing and documentation review.
