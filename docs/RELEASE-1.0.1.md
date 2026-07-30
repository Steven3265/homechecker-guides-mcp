# Homechecker Guides MCP 1.0.1

A release-engineering hardening pass over the deployed 1.0.0 code. The four tools, guide snapshot, ranking, checklist logic, resource URIs and public result contracts are unchanged.

## Changes

- Adds an automatic GitHub validation workflow for every push and pull request.
- Adds an in-process protocol regression suite covering modern discovery, tool listing and calling, resource listing and reading, routing-header rejection, CORS controls and 2025-era initialization.
- Makes snapshot refresh and Registry publication run the complete validation suite before changing or publishing anything.
- Removes raw search queries from application telemetry.
- Updates Registry metadata to the `2025-12-11` schema and adds a display title.
- Adds repository ignore rules, exact top-level dependency versions, release-metadata consistency checks, and removes the unused `tsx` dependency and shutdown export.
- Corrects the documented MCP resource count: 35 total, comprising one catalogue plus 34 guide resources.
- Commits the dependency lockfile and installs with `npm ci --ignore-scripts` in CI, Registry publication and Vercel deployment, so every environment builds the identical pinned tree.

## Release gate

The release is ready to publish only when the **Validate MCP release** Action is green and the Vercel deployment reports a healthy endpoint.
