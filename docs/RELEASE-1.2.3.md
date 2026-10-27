# Release 1.2.3: an OpenAI endpoint without the Read link

## Why

OpenAI's app directory guidelines allow commerce only for physical goods. Apps
may not promote digital products or services, directly or indirectly. A
Homechecker Read is a digital service, and from 1.2.0 the server ended search
results, guides and checklists with a person-facing link to start a Read and a
link to the sample Read. A ChatGPT listing that served those links would be
likely to fail review.

This release complies with that rule for ChatGPT without changing anything for
other clients.

## Changes

1. **A dedicated endpoint, `https://mcp.homechecker.com.au/mcp/openai`.** It
   serves the same server, tools, corpus, citations and professional boundaries
   as `/mcp`, but no answer carries the Read link or the sample link, and the
   server instructions do not mention them. This is the URL to submit to
   OpenAI. Because the behaviour follows the URL, reviewers and any OpenAI
   crawler get the compliant version whatever they send.
2. **ChatGPT traffic on `/mcp` gets the same treatment.** If a ChatGPT user adds
   the main endpoint by hand, requests identified as ChatGPT also omit the
   links. This is a backstop; the dedicated endpoint is the primary route.
3. **Everything else is unchanged.** Claude, other MCP clients, stdio and the
   REST layer keep the Read hand-off exactly as before.
4. **Telemetry.** `mcp_request` log lines gain an `endpoint` field
   (`standard` or `openai`), so OpenAI usage can be read separately.

## How it works

The HTTP boundary decides, per request, whether Read links are allowed, and
carries that decision in the same request context that already carries the
client label. `readLinkNote()` returns the note or an empty string, and every
place that previously appended `READ_LINK_NOTE` now goes through it, so a
suppressed note leaves no trailing gap.

## Verification

The protocol suite gains a check across three surfaces (standard `/mcp`,
`/mcp/openai`, and ChatGPT on `/mcp`) covering initialize instructions, strong
and no-match search, `get_guide` in full, summary and sections formats, and
`build_buyer_checklist`. The standard surface must carry the link; the other
two must carry neither the Read nor the sample link. Retrieval is untouched:
the benchmark results are identical to 1.2.2.
