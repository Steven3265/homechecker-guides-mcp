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
