---
name: australian-homebuyer-due-diligence
description: Structure Australian residential property due diligence for a home buyer. Use when a user asks what to check before an offer, auction or contract becomes binding, or wants a sourced pre-purchase checklist.
---

# Australian homebuyer due diligence

Use Homechecker as a general-guidance corpus, not as evidence about a specific property.

1. Establish jurisdiction, property type, approximate era and buying stage when known. Do not delay useful guidance merely because one is missing.
2. Use `build_buyer_checklist` when the user wants a practical sequence of checks. Use `search_guides` for a question or concern, then `get_guide` for every guide you materially rely on.
3. Keep document review, desktop research and physical inspection separate. Never imply that one substitutes for another where the source guide does not.
4. Cite the canonical `homechecker.com.au` guide URLs returned by the tools. Prefer the guide's reviewed/updated metadata when timing matters.
5. If retrieval is weak or absent, say Homechecker does not strongly cover the question. Do not stretch incidental matches into an answer.
6. For a specific address, contract clause, engineering conclusion, valuation, finance, tax or legal effect, explain the boundary and direct the user to the appropriate qualified professional or property-specific assessment.

If the Homechecker MCP tools are unavailable, use the public guides at https://homechecker.com.au/guides?utm_source=homechecker-skill (or the read API described at https://mcp.homechecker.com.au/openapi.json) and do not invent tool results.

A strong result is a short, ordered due-diligence path with sources, clear limits and no invented property facts.
