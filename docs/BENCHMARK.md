# Initial retrieval benchmark

The MVP includes 14 representative buyer questions covering:

- Victorian Section 32 statements;
- NSW contracts for sale;
- Queensland Form 2 disclosure;
- pre-auction inspections;
- owners-corporation records;
- 1970s homes;
- weatherboard construction;
- brick veneer and double brick;
- cracking;
- damp and moisture;
- cooling-off periods;
- preventative maintenance;
- modern homes;
- condition and insurance.

Run:

```bash
npm run benchmark
```

Success means at least one expected canonical guide appears in the first three search results. The initial snapshot passes 14/14.

This benchmark measures retrieval behaviour only. It does not independently validate every legal, building or safety statement in the guides. Those claims remain governed by the guides' named sources, review dates, methodology and limitations.
