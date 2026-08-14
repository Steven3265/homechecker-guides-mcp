# GitHub Agent Finder contribution pack

Copy the four JSON files under `Steven3265/` into `catalog/Steven3265/` in a fork of `github/agentfinder-catalog`, run that repository's catalog generator/check, and open a pull request. The public Agent Finder catalog supplements its generated ARD catalog with GitHub's public MCP catalog, so these contribution files deliberately add the four portable Homechecker skills rather than duplicating the existing MCP server record.
## Identifier note

The contributor records in this folder intentionally use GitHub Agent Finder's source schema (`urn:ai:github.com:...`, `mediaType`). Do not rewrite them to the ARD `urn:air:` / `type` form. Agent Finder keeps these contributor files as its source of truth and generates its ARD ingestion catalogue from them. Homechecker's first-party ARD catalogue remains separately domain-anchored at `urn:air:homechecker.com.au:...`.

