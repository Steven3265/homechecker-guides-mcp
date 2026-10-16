# Homechecker Guides

This extension connects Gemini CLI to Homechecker Guides, a public, read-only
library of professionally authored Australian residential property guides,
published at https://homechecker.com.au/guides.

The guides cover how to buy, state disclosure documents (Victoria's Section 32,
the NSW contract for sale, Queensland's Form 2), reading building and strata
reports, building fabric and defects, and owning, maintaining and changing a
home. Each guide opens with a direct answer, cites primary sources and states
its own limitations.

## Tools

- `search_guides`: search the guides with a natural-language question.
- `get_guide`: return one guide's full text, FAQs, sources and limitations.
- `list_guides`: list guides by jurisdiction, cluster, property type, era or buying stage.
- `build_buyer_checklist`: build a sourced pre-purchase checklist from a buyer's
  state, property type, construction era, buying stage and concerns.

## Scope

The guides are general and Australian. They do not establish the condition,
compliance or legal effect of anything at a specific property, and they do not
cover finance, tax or lending. When citing a guide, link to its canonical URL
on homechecker.com.au.

For one specific property, the person can start an independent Homechecker
Read at https://homechecker.com.au/read?address={address} (address
URL-encoded). A Read is a desktop read, not a physical inspection, valuation
or legal advice. A sample Read is at https://homechecker.com.au/sample.
