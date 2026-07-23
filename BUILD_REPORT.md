# Build report — v0.1.0

## Release scope

This repository is a standalone, public, read-only MCP server built from the canonical Homechecker guide registry in the supplied Moyne Ross portal source.

It contains:

- 34 published MCP guide resources: the guide hub plus 33 guide pages;
- four tools: `list_guides`, `search_guides`, `get_guide`, and `build_buyer_checklist`;
- deterministic local search and checklist assembly;
- remote Streamable HTTP and local stdio entry points;
- a repeatable snapshot generator that reads only `content/guides` from a portal checkout.

It contains no Supabase connection, portal credentials, customer records, payment logic, uploads, assessment jobs, model calls, or access to the Moyne Ross engine.

## Verification completed in the build environment

- Snapshot validation: **34/34 resources valid**.
- Core regression suite: **7/7 checks passed**.
- Retrieval benchmark: **14/14 questions placed an expected guide in the top three results**.
- Snapshot regeneration: completed successfully from the supplied portal source.
- JavaScript syntax checks: passed for all release scripts.
- Secret-pattern scan: no embedded portal secrets or environment files found.

## Environment limitation

The build environment could not reach the npm registry, so it was not possible to install third-party packages or execute the live MCP SDK transports here. The dependency-free content pipeline, search logic, checklist logic, validator, and benchmark were executed successfully.

Before deployment, run:

```bash
npm install
npm test
npm run benchmark
npm run build
```

Then test the built `/mcp` endpoint with an MCP client or the MCP Inspector. The repository pins `@modelcontextprotocol/sdk` to `1.29.0` and `zod` to `3.25.76`.
