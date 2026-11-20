# Retrieval evaluation

Homechecker 1.2.1 extends the retrieval benchmark from a small happy-path sample into a release-gating evaluation of the complete published guide system.

The suite currently contains **199 cases**:

- 78 positive probes: every one of the 33 published spoke guides twice, plus typo, indirect, mixed-concept, verbose and multi-state questions;
- 12 dedicated jurisdiction probes covering VIC, NSW, QLD and ACT, including explicit negation and legislation titles where the word “Act” must not be mistaken for the territory;
- 13 deliberately marginal or property-adjacent questions that may return background, but must be flagged weak;
- 11 off-topic questions that must return nothing;
- 85 open-world collision probes covering non-property meanings of terms such as Section 32, strata, unit, settlement, auction, mould, Form 2, vendor statement, cities and building vocabulary. These may return weak/background material or nothing, but must never be labelled strong.

Run:

```bash
npm run benchmark
```

The benchmark reports:

- **top-1 recall** across positive cases;
- **top-3 recall** across positive cases;
- **weak/background accuracy**;
- **correct-empty accuracy**;
- **open-world safety** across lexical-collision probes;
- **false-strong rate** across every negative/collision case;
- **jurisdiction leakage** for dedicated state-rule guides.

The release gate requires every case to meet its declared expectation, at least 85% top-1 recall, 100% top-3 recall, 100% weak/background handling, 100% correct-empty handling, 100% open-world safety, zero false-strong negatives and zero jurisdiction leakage.

For the verified 1.2.1 calibration run the baseline is 91.1% top-1 recall, 100% top-3 recall, 100% weak/background handling, 100% correct-empty handling, 100% open-world safety (85/85), zero false-strong negatives (0/109) and zero jurisdiction leakage (0/13).

This suite measures deterministic retrieval behaviour only. It does not independently validate legal, building or safety claims in the editorial corpus; those remain governed by each guide's named sources, review dates, methodology and limitations.

## 1.2.2: the filtered pass

`data/benchmark-filtered.json` holds 26 engine-style building questions sent
with structured filters (property type, era, state). Each must find the
expected guide in the top three (gate: all of them) and at least 80% must be
answered strongly (verified 1.2.2 run: 84.6%). The same pass re-runs every
weak, empty and open-world case with three residential filter sets; none may
be strong (verified: 327/327). See `docs/RELEASE-1.2.2.md`.


## November 2026: the everyday pass

The suite above checked that the right guide was *found*. It did not check
that the answer was offered as an answer. Measured for the first time, a third
of the suite's own positive questions came back labelled weak with the right
guide on top, and so did most questions asked in ordinary words ("rising
damp", "how long does a tile roof last"). A weak result tells the caller no
guide strongly matches, so the guide goes unread.

### The gate reads a question twice

`weakReason` in `src/core.ts`:

1. **First reading**, unchanged: the question against what the guides say
   they are about. Anything strong before is strong now.
2. **Second reading**, only when the first fails and the question is plainly
   about a home: its subject against everything the guides contain. Framing
   words ("how serious", "usually") are set aside, a word most guides use
   counts less, and the winning guide's own body counts for a question about
   the building.

Two guards keep the second reading honest. A word no guide uses anywhere
makes the answer weak on either reading ("a wall crack on a boat"); a
misspelling of a guide word is let by. A word few guides use and the winning
guide does not discuss does the same ("cooling off period after exercise").
Contract, auction and disclosure questions are never read against body text.

### A weak result says why

When the guides cover the subject and the only shortfall is what was asked of
them (a verdict on one home, a price, a recommendation), the text and the
`boundary` field say what the guides can be used for instead of "no guide
strongly matches". `matchStrength` is still `weak`. The reason is logged with
the search as a category, never the question.

### What people notice, in their own words

People describe a home by what they see, feel and smell; the guides name the
condition. `NOTICED` in `src/core.ts` maps one to the other, one direction
and whole words only: wobbly to loose, fog to condensation, crumbling to
fretting and salts, drooping to sagging, railing to balustrade, RCD to safety
switch. A mapped word is searched as the guides' words and counts as theirs
when the answer is judged. One mapping was tried and removed: foundation to
footings made "a foundation model in AI" strong with filters attached.

### Measured

`data/benchmark-everyday.json` holds the questions this was built and checked
against: 230 everyday questions, 18 that ask for a verdict, price or
recommendation, and 185 on other subjects. Two groups were written after the
work they test and were not used to do it: `second-look` (after the gate)
and `noticed` (after the noticed-words lexicon).

"Answered" means labelled strong with an expected guide in the top three.

| | Before | After |
|---|---|---|
| Suite positives labelled strong | 63/96 (65.6%) | 79/96 (82.3%) |
| Everyday questions answered | 66/230 (28.7%) | 176/230 (76.5%) |
| terse | 18/35 | 34/35 |
| natural | 32/80 | 65/80 |
| symptom | 2/20 | 13/20 |
| judgement | 3/15 | 12/15 |
| second-look (unseen) | 11/60 | 40/60 |
| noticed (unseen) | 0/20 | 12/20 |
| Suite negatives labelled strong | 0/109 | 0/109 |
| Filtered negatives labelled strong | 0/327 | 0/327 |
| Everyday negatives labelled strong | 0/203 | 0/203 |
| 3,600 generated probes: a building word in a foreign setting | 13 strong | 0 strong |

No question that was strong before is weak now. The gate changed no ranking;
the noticed words changed it for 11 of 306 questions: the right guide moved
up in 6 and held its place in 5.

The release gate adds: at least 75% of suite positives strong, at least 70%
of everyday questions answered, and no everyday negative strong.

### What is left

A question that is right and still weak is now usually held back by one
ordinary word the winning guide happens not to use ("kettle", "underfoot",
"every morning"). That is the limit of matching words. Add new unseen
questions to the everyday file rather than fixing these one by one, and add
to `NOTICED` only words the guides have a different name for.
