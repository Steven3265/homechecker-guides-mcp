# Retrieval evaluation

Homechecker 1.2 expands the retrieval benchmark from a small happy-path sample into a release-gating evaluation of the complete published guide system.

The suite currently contains **114 cases**:

- 78 positive probes: every one of the 33 published spoke guides twice, plus typo, indirect, mixed-concept, verbose and multi-state questions;
- 12 dedicated jurisdiction probes covering VIC, NSW, QLD and ACT, including explicit negation and legislation titles where the word “Act” must not be mistaken for the territory;
- 13 deliberately marginal or out-of-scope questions that may return background, but must be flagged weak, including a Melbourne “Building Act” probe that must not leak another state's dedicated guide;
- 11 off-topic questions that must return nothing.

Run:

```bash
npm run benchmark
```

The benchmark reports:

- **top-1 recall** across positive cases;
- **top-3 recall** across positive cases;
- **weak/background accuracy**;
- **correct-empty accuracy**;
- **false-strong rate** across negative cases;
- **jurisdiction leakage** for dedicated state-rule guides.

The release gate requires every case to meet its declared expectation, at least 85% top-1 recall, 100% top-3 recall, 100% weak/background handling, 100% correct-empty handling, zero false-strong negatives and zero jurisdiction leakage.

For the current snapshot the baseline is 91.0% top-1 recall, 100% top-3 recall, 100% weak/background handling, 100% correct-empty handling, zero false-strong negatives and zero jurisdiction leakage (0/13 leakage probes).

This suite measures deterministic retrieval behaviour only. It does not independently validate legal, building or safety claims in the editorial corpus; those remain governed by each guide's named sources, review dates, methodology and limitations.
