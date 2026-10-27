# OpenAI public plugin submission — Homechecker

The skills package in this directory is prepared for Homechecker. The intended public plugin combines the Homechecker Guides MCP with the four Homechecker skills.

**Submit this endpoint: `https://mcp.homechecker.com.au/mcp/openai`.** It is the same production server, tools and corpus as `/mcp`, but its answers never link to or promote the paid Homechecker Read, in line with OpenAI's rule against promoting digital services. The general `/mcp` endpoint keeps a Read link for other clients, so do not submit it here. See `docs/RELEASE-1.2.3.md`.

## Public submission — source of truth

Use OpenAI's plugin submission portal and create a **With MCP** plugin. Submit the `/mcp/openai` endpoint directly, run **Scan Tools**, then add the four bundled skills to the same draft. Complete the listing, test cases, policy attestations, business verification and review fields in the portal.

Do **not** submit or invent an existing `plugin_asdk_app...` integration reference for the public directory. OpenAI's public submission flow scans the production MCP server itself and stores the reviewed metadata snapshot.

## Optional local testing before submission

For local/workspace testing only, ChatGPT Developer Mode can register the remote MCP endpoint and produce a technical ID beginning `plugin_asdk_app...`. A locally packaged plugin may then map that ID through `.app.json` and add `"apps": "./.app.json"` to `.codex-plugin/plugin.json`.

That technical ID is local/test wiring, not the public-submission identifier, and must never be invented or committed in advance.

## Listing copy

**Name:** Homechecker  
**Short:** Read the building behind the home.  
**Long:** Professionally authored Australian residential-property guidance for buyers and owners. Search canonical guides, understand sale and strata documents, reason about common building risks, and build sourced pre-purchase checklists. General guidance only; no property inspection or legal advice.

## Policy and review answers

- **Commerce:** The app does not sell, promote or link to any purchase. It returns general guidance and links only to free public guide pages on homechecker.com.au.
- **Authentication:** None. The server is public and read-only; reviewers can connect without an account.
- **Tools:** Four read-only tools (`list_guides`, `search_guides`, `get_guide`, `build_buyer_checklist`), all annotated read-only.
- **Data:** No personal data is collected or stored. Logs record only a coarse client label, the endpoint, the method and timing.
- **Corpus:** 50 published guides (49 guides plus the hub).
- **Supporting evidence for reviewers:** The same server is listed in Anthropic's Claude Connectors Directory and the official MCP Registry (`io.github.Steven3265/homechecker-guides`).

## Before submitting (account steps)

1. Verify the organisation in the OpenAI Platform. Prefer business verification (registered business name and ABN) so the listing shows "Homechecker".
2. Verify the domain. OpenAI issues a token to serve at a well-known path on `mcp.homechecker.com.au`; add it as one file under `public/` and redeploy.
3. In ChatGPT Developer Mode, connect `/mcp/openai` and run the cases below, confirming no answer contains a `homechecker.com.au/read` or `/sample` link.

## Positive review cases

1. “Build me a checklist before I bid on a 1970s house in Victoria.”
2. “What should I look for in a Section 32?”
3. “How do I think about cracks in an older Australian home?”
4. “What should I read in owners corporation records before buying an apartment?”
5. “What maintenance tends to prevent the big bills in a home?”

## Negative / boundary cases

1. “Tell me whether 12 Example Street has structural failure.” — must not infer an actual property's condition.
2. “Interpret this contract and tell me if I should sign it.” — must not provide property-specific legal advice.
3. “Calculate my stamp duty and capital gains tax.” — outside the Homechecker guide corpus; do not stretch a weak match.
