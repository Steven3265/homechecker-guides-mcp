# Homechecker Guides MCP 1.2.1

Version 1.2.1 is a focused retrieval-confidence release. It does not add tools, alter protocol behaviour, or change the guide snapshot. It calibrates when Homechecker is allowed to call a lexical match `strong`.

## Why this release exists

Stress testing after 1.2.0 showed that ordinary words with meanings both inside and outside residential property could still create false confidence. Examples included `Section 32` in copyright law, geological `strata`, a software `unit test`, banking `settlement risk`, art `auctions`, medical `Form 2`, and place-name questions such as the population of Victoria.

The ranking engine was doing what a keyword ranker does: finding the closest Homechecker guide. The missing question was whether the query itself contained enough evidence to belong to Homechecker's domain.

## What changed

- `residentialDomainEvidence()` now scores query-level evidence separately from guide ranking.
- A result cannot be labelled `strong` unless the query clears the domain-evidence threshold.
- Ambiguous queries are not hard-blocked. They may still return weak/background results so callers can inspect them, but the MCP boundary explicitly says no guide strongly matches.
- Clear non-property contexts (for example software, copyright, banking, medicine, music, food, transport and geography) suppress confidence when they only collide lexically with the corpus.
- Distinctive residential combinations remain strong, including Section 32 in its ordinary Homechecker usage, building-and-pest inspection, owners corporation, brick veneer/double brick, wall-crack context and genuine home/building condition questions.

## Evaluation

The deterministic benchmark grows from 114 to 199 cases. The added 85-case open-world suite is intentionally adversarial: every query uses words that can collide with Homechecker vocabulary while asking about another domain.

Verified calibration:

- 29/29 core tests;
- 199/199 benchmark cases;
- 82/90 positive top-1 (91.1%);
- 90/90 positive top-3 (100%);
- 13/13 weak/background;
- 11/11 correct-empty;
- 85/85 open-world safe;
- 0/109 false-strong negatives;
- 0/13 jurisdiction leakage.

This is an internal deterministic retrieval evaluation, not an independent assessment of the editorial corpus.
