# Phase 4 additive evidence contract

FG-DAILY-1 supplements FG-METRIC-1 without changing its populations or formulas.
Each calculated period has seven UTC-day buckets, in chronological order, using
the same accepted arrival cohort as encounterCount. Each bucket carries its
half-open UTC bounds, count and logical record lineage. Provider defects do not
remove countable arrivals. Quarantines, invalid identity/arrival, after-cutoff
arrivals and outside-period records never enter a bucket. The seven counts must
sum to the period encounter count. A zero means no accepted supplied records on
that date, not confirmed zero hospital activity or a detected data gap.

The dashboard summary adds combined A+B counts and weighted eligibility and
seen-field completeness from the engine's quality populations. It never averages
period percentages or medians. Empty denominators remain unavailable. This
summary is calculated outside React and tested against independent expectations.

Existing source/configuration fingerprints remain unchanged: these additions do
not change FG-METRIC-1. Daily series explicitly carry FG-DAILY-1. No daily waits,
triage time, length of stay, operational classifications or AI outputs are added.
