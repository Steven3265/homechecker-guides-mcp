# Architecture

## Current MVP

```text
Homechecker portal guide registry
              │
      offline snapshot script
              │
        data/guides.json
              │
  deterministic search/checklist core
              │
      MCP tools and resources
         ╱             ╲
Streamable HTTP        stdio
```

The portal is a **build-time content source only**. The deployed MCP server has no route back to the portal.

## Runtime request path

```text
MCP client
   │ POST /mcp
   ▼
stateless transport instance
   ▼
new MCP server instance
   ▼
read-only tool or resource handler
   ▼
data/guides.json
```

A new stateless transport and MCP server are created for each HTTP request. There is no session store, database or cross-request state.

## Search model

Search is deterministic and local. It combines:

- weighted title, question, answer and summary matches;
- phrase and synonym expansion;
- section-level matching;
- inferred state, property-type and construction-era signals;
- explicit filters;
- a modest penalty for the broad guide hub.

There is no embedding service, vector database or model call.

## Checklist model

`build_buyer_checklist`:

1. converts the buyer profile into a search query;
2. selects the most relevant guides;
3. scores authored list items, field plates, table prompts and FAQs;
4. removes duplicates;
5. returns sourced checks with canonical URLs;
6. states the boundary between guidance and a property-specific assessment.

It assembles authored material; it does not diagnose or infer the condition of a building.

## Future product connection

A later product MCP should sit behind a narrow Homechecker API rather than connect directly to Supabase or the engine:

```text
AI client
   │
Homechecker MCP
   │
scoped Homechecker product API
   │
existing payment / job / publication controls
   │
Moyne Ross engine
```

That future layer should be a separate authenticated zone. It is intentionally absent from this repository.
