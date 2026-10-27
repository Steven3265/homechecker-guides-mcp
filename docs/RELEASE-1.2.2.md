# Release 1.2.2: filtered confidence, natural phrasing, checklist quality

## Why

The Homechecker engine now consults this MCP while it writes a Read, through
Anthropic's MCP connector. It asks short building questions ("shower
waterproofing", "timber cladding") and passes structured filters (property
type, era, state). Under 1.2.1 those questions found the right guide but were
labelled weak: the residential-evidence gate read only the question's words,
so a terse building question looked ungrounded even when the caller had said
it was about a 2021 townhouse in Victoria. The same applies to any agent that
sends filters.

## Changes

1. **Filters as residential context.** A residential property type (house,
   apartment, townhouse, unit…) or a construction era, supplied as a filter,
   grounds a question that names a physical building matter. It relaxes only
   the authored-phrase check. It never permits weaving across guides: the top
   guide alone must explain at least 75% of the question from its own content
   (authority tokens in full, body words at half weight). A state filter alone
   grounds nothing. `isWeakMatch` and `renderSearchResults` take the optional
   context, and the rendered text now always agrees with `matchStrength`.
2. **Natural phrasing.** Synonyms for battens/cladding, new build/recently
   built/modern home, smoke detector/alarm, water heater/hot water and fuse
   box/meter box/switchboard. The residential cues now recognise plurals
   ("defects", "walls", "slabs") and warranties.
3. **Checklist quality.** `build_buyer_checklist` items must stand on their own
   (at least six words), start with a capital letter, and come only from era
   guides whose era matches the profile.

## Safety

Filters are context, never authority. The benchmark adds a filtered pass:
every weak, empty and open-world case is re-run with three residential filter
sets (327 checks) and must never be strong. During tuning this pass rejected
two looser designs (cross-guide weaving; a 70% bar) that let "How often should
a car be serviced for maintenance?" through as a confident home answer.

## Results (verified run)

| Measure | 1.2.1 | 1.2.2 |
|---|---|---|
| Positive top-1 / top-3 | 88.9% / 100% | 88.9% / 100% (unchanged) |
| Open-world safe, false-strong negatives | 100%, 0/109 | 100%, 0/109 (unchanged) |
| Filtered negatives never strong | (not measured) | 327/327 |
| Engine-style questions, right guide in top 3 | 26/26 | 26/26 |
| Engine-style questions answered strongly | 6/26 (23%) | 22/26 (84.6%) |

The four engine-style questions that remain weak each contain a word the top
guide does not cover (for example "pooling", "low pitch"): the honest answer.

## After deploying

Refresh the snapshot if guide content changed, then run the registry publish
action so public indexes report 1.2.2.
