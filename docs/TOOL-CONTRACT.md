# Tool contract

## `list_guides`

**Purpose:** catalogue discovery.

**Returns:** guide metadata and canonical URLs. It does not return full article text.

**Filters:** jurisdiction, cluster, property type, era, buying stage and optional inclusion of the guide hub.

## `search_guides`

**Purpose:** answer “which Homechecker guidance is relevant?”

**Returns:** ranked guides, matched terms, up to three matching sections, source metadata and limitations.

**Do not use it to:** claim that a defect, material, permit problem or legal consequence exists at a particular property.

## `get_guide`

**Purpose:** retrieve the canonical authored guide after discovery.

**Formats:**

- `summary`
- `sections`
- `full`

**Slug source:** a value returned by `list_guides` or `search_guides`.

## `build_buyer_checklist`

**Purpose:** assemble sourced questions and checks for a buyer context.

**Inputs:** jurisdiction, property type, era, buying stage, concerns and item limit.

**Returns:** matched guides and checklist items, each linked to its canonical guide.

**Boundary:** the checklist is general guidance. It is not a desktop assessment, physical inspection, contract review or issued Homechecker result.
