# Phase 3B — deterministic operational metrics and evidence reports

Date: November 4, 2026 (America/Denver).
Status: implemented and checked in the existing Node/TypeScript environment. Phase 3B changes are intentionally uncommitted for review.

## Preflight and Phase 3A checkpoint

Read the five approved Phase 1 documents, the Phase 2 and Phase 3A execution reports, contracts, validation/period/ingestion modules and independent fixture expectations. Reviewed the uncommitted Phase 3A changes. No material contradiction with the approved analytical rules was identified.

Before implementation, reran strict TypeScript checking and the complete Phase 3A suite: all 144 tests passed. Inspected the explicitly staged files and diff; dependencies, caches, secrets and generated artifacts were excluded.

Created dedicated checkpoint commit:
- 1604fd80137796fd6d33b6e08f35cd02c173bf73.
- Subject: Implement and verify CSV ingestion, encounter validation, and comparison periods.
- 12 reviewed Phase 3A files.
- Working tree clean immediately after commit.
- Author: Hanzla Ali <286029066+Hanzla-cs@users.noreply.github.com>.
- Branch: codex/analytical-foundation.
- No remote created, configured or pushed.

All approved specifications, prior execution reports, existing fixtures/expected results and Phase 3A validation behavior were preserved. No academic source or dataset was accessed for implementation or copied.

## Files created or modified

Modified:
- src/core/contracts.ts: additive metric references/definition metadata, population/numerator lineage, display strings, timing observations, explicit timing counts, comparison sample sizes/denominators and report validation summary.

Created:
- src/core/format.ts: deterministic decimal display rounding, ties away from zero, no negative zero.
- src/core/metrics.ts: per-period operational calculations over validated cohorts and shared metric metadata.
- src/core/compare.ts: matching A/B metric comparisons using unrounded values.
- src/core/coverage.ts: observed accepted-arrival span, declared interval union coverage and provenance limitations.
- src/core/analyze.ts: one analytical entry point with input snapshots, Phase 3A validation reuse and structured evidence output.
- tests/helpers/analysis.ts: tiny test-record serialization and report helpers; no expected-value generation.
- tests/format.test.ts.
- tests/metrics.test.ts.
- tests/evidence.test.ts.
- docs/phase-3b-metrics.md: this execution record.

No dependencies were added or changed. The installed direct dependencies remain csv-parse 7.0.3, TypeScript 7.0.2, Vitest 5.1.0 and @types/node 24.19.2. Existing package and lock files are unchanged from the Phase 3A checkpoint.

## Implemented calculations

### Countable populations and statuses

Per-period encounter counts use the accepted, nonquarantined arrival cohorts established by Phase 3A. Global invalid-identity, unusable-arrival, duplicate and outside-period diagnostics remain in the report.

Status counts and percentages preserve recorded seen, not_seen, unknown and invalid/missing status. Timestamp contradictions never silently turn a recorded not_seen or unknown encounter into seen. Status counts reconcile with the countable population.

Counts describe the supplied accepted records, not an independently verified hospital census. Zero accepted records after exclusions is explicitly distinguished from evidence of zero actual encounters.

### Timing

Each eligible record has source record number, integer-millisecond duration, unrounded minutes and a separately formatted display value. No imputation, outlier removal, duration cap or zero replacement is performed.

The median sorts a copy of eligible millisecond durations. Odd samples take the middle value. Even samples average the two central millisecond values, preserving a half-millisecond result, before converting to minutes.

Zero minutes is valid. A single observation produces its median with a single-observation limitation. No eligible observations produces unavailable, with null value/display, not zero.

Explicit timing-eligible and timing-excluded counts accompany the median. The source population, eligible record numbers, excluded record numbers and eligible sample size are traceable. Primary timing exclusions reconcile exactly; additional diagnostic flags remain nonexclusive.

### Completeness and denominators

Implemented separately:
- Overall timing eligibility: timing-eligible records / countable encounters.
- Provider timestamp completeness among recorded seen: populated provider fields / recorded seen encounters.
- Provider timestamp parse validity among recorded seen: parse-valid provider timestamps / recorded seen encounters.
- Timing eligibility among recorded seen: timing-eligible records / recorded seen encounters.

Presence does not establish parse validity. Parse validity does not establish valid chronology/cutoff timing. Empty denominator populations produce unavailable percentages.

Metric lineage identifies the full relevant population and numerator record subset. eligibleN/excludedN refer to support/exclusions for that particular metric, not one universal population. For example, a status percentage is supported by the full countable cohort, while a median is supported only by timing-eligible rows. timingEligibleCount and quality.periods explicitly expose the timing-eligible encounter sample.

### Comparisons and display values

Matching A/B scalar metrics have B-minus-A absolute differences and relative percentage differences only when both values are available and the A value is nonzero.

Proportion metrics use percentage-point differences; their relativePercentageDifference is null by design. No rate-relative-change rule is added.

Every comparison carries source metric references, both sample sizes, both denominators and interpretation = descriptive_only. Limitations explicitly state that a lower median does not establish operational improvement.

Calculations use unrounded numbers. Display strings use one decimal place for minutes/percentages/percentage points and integer displays for counts. The rounding helper uses the finite number's canonical decimal representation, rounds ties away from zero, supports scientific notation and suppresses negative zero. Display strings are never used in subsequent calculations.

### Coverage

Unverified coverage produces no invented coverage percentage. Observed span uses accepted identity/arrival records, including those outside selected periods; it does not prove uninterrupted collection.

For source-declared intervals, the engine validates interval timestamps/order, clips them to each selected period, merges overlaps/adjacency, and computes declared union hours / 168 hours. Partial intervals never cause extrapolated encounter counts.

Invalid intervals or missing attribution make declared temporal coverage unavailable rather than accepting only a valid subset. Valid encounter metrics remain descriptive with the coverage limitation.

A full 100% declared temporal interval still does not establish independently verified hospital capture, source truth, clinical validity or sufficient outcome follow-up. independentlyVerifiedHospitalCoverage remains false. Manifest claims are preserved as assertions.

## Analytical entry point and report boundary

API: analyze(successfullyParsedCsv, configuration), returning Promise<EvidenceReport>.

The entry point accepts the successful CsvParsed result from Phase 3A parseCsv. Fatal CSV errors remain fatal ingestion results and cannot be passed through the typed analytical API as valid parsed data. This phase does not replace or soften the ingestion failure policy.

The function snapshots inputs, calls the existing validateEncounters implementation, and constructs:
- Source byte identity and selected configuration.
- Specification identifiers and a deterministic configuration/source fingerprint.
- Parsed, accepted, rejected and quarantined validation counts.
- Global and per-period diagnostics, memberships and exclusion accounting.
- Metrics with calculation definitions, unique references, raw values, display values, numerator/denominator and record lineage.
- Descriptive comparisons with availability states and sample context.
- Coverage assertions, observed span and limitations.

Invalid/missing/stale period configuration or invalid observation cutoff yields blocked evidence with null metrics/comparisons, preserving available validation diagnostics. No demonstration dates are inferred.

The report is JSON serializable and designed for future presentation to consume its prepared values without recalculating business metrics. It contains no AI narrative, risk classification, forecast or clinical recommendation.

## Verified outputs from the approved example

| Measure | A | B |
|---|---:|---:|
| Countable encounters | 6 | 6 |
| Recorded seen | 4 | 4 |
| Recorded not_seen | 1 | 1 |
| Recorded unknown | 1 | 1 |
| Invalid/missing status | 0 | 0 |
| Timing-eligible encounters | 4 | 2 |
| Timing-excluded encounters | 2 | 4 |
| Median door-to-provider | 25.0 min | 15.0 min |
| Overall timing eligibility, displayed | 66.7% | 33.3% |
| Seen timestamp completeness | 100.0% | 75.0% |
| Seen timestamp parse validity | 100.0% | 75.0% |
| Seen timing eligibility | 100.0% | 50.0% |

Verified median difference: -10 minutes and -40% relative change.
Verified timing-eligibility difference: -100/3 percentage points (-33.3 displayed).
Verified seen-completeness difference: -25 percentage points.

These are verified calculations for the independent fictional fixture. They are not hospital-performance observations. The lower median is presented alongside the lower timing coverage and an explicit descriptive-only limitation.

## Verification actually executed

- Phase 3A pre-commit TypeScript and Vitest rerun: passed, 144 tests.
- TypeScript check after adding analytical modules: passed.
- Final strict TypeScript checking: passed, exit 0.
- Complete Vitest suite: 9 test files, 203 passed (144 existing plus 59 new), exit 0.
- Git diff whitespace checks: passed for tracked changes.
- Preservation diff against 1604fd8: no changes to approved documents, earlier reports, original fixtures/expectations, existing tests, Phase 3A validation modules, package/lock files or tooling configuration.
- npm ls --depth=0: confirmed unchanged dependency versions.
- Git identity and remote checks: existing local author preserved; no remote.
- No lint configuration exists, so no lint check was applicable.

New checks cover:
- All independently specified fixture outputs without modifying the expected-result files.
- Primary -10 minute/-40% comparison and separate eligibility/completeness denominators.
- Odd/even medians, half-millisecond precision, empty periods, single observations and zero durations.
- Missing/malformed provider values, negative chronology, status contradictions and cutoff exclusions.
- Quarantined duplicates and all-quarantined inputs.
- Global identity/arrival exclusions and outside-period evidence.
- Provider contact after arrival-period end and no outlier cap.
- Exact count/status/exclusion reconciliation.
- Zero relative-change denominators and unavailable medians/rates.
- Decimal tie rounding and suppression of negative zero.
- Differences calculated from unrounded values, not rounded cards.
- Unknown, partial, full source-declared and invalid declared coverage.
- Clipped union of overlapping, adjacent and disjoint collection intervals.
- Row-order independence of numerical metric outputs.
- Repeatability, input snapshots/nonmutation, source/configuration fingerprints and metric-reference uniqueness.
- Recursive finite-number checks and JSON round trips.

There were no failing Phase 3B checks in the executed full suite. Passing tests establish conformance to the tested analytical specification, not clinical validity or independently verified source completeness.

## Known limits and unresolved work

No unresolved failure remains in the executed checks. Runtime verification was in the existing Windows/Node environment. Browser/Next.js execution and presentation behavior remain untested because no dashboard or UI was built.

The API consumes typed configuration and successful Phase 3A ingestion; it is not a new untrusted-JSON network endpoint. No main synthetic dataset has been created. No statistically validated sample-size threshold, confidence interval, significance test, operational alert or causal interpretation has been introduced.

The existing specification defines UTC comparisons and source-declared coverage. More realistic hospital data semantics and independently corroborated capture completeness would require separately approved requirements.

Phase 3B files remain uncommitted, as requested. No remote/push, deployment or academic-project modification occurred.

## Proposed Phase 3C plan — not implemented

Subject to the user's next approval:
1. Add an independent versioned TypeScript generator and explicit scenario parameters, with no academic inputs.
2. Retain the approved October 5–11 and October 12–18 UTC scenario: 100 fictional arrivals per day, 1,400 total; 85 seen, 10 not_seen and 5 unknown daily. Each period therefore contains 700 encounters, 595 seen, 70 not_seen and 35 unknown.
3. Review and approve an exact deterministic pseudo-random algorithm, seed, arrival-time distribution and waiting-time distribution. A simple candidate is a documented 32-bit seeded algorithm with seed 20261104, fictional integer waits from 5–120 minutes in A, and an explicitly constructed +10-minute B shift. These would be demonstration assumptions, not healthcare estimates.
4. Keep paired weekday/status/arrival patterns comparable while using independent unique encounter IDs. Record the observation cutoff as October 20, 2026 UTC.
5. Produce only the scenario CSV and companion manifest with parameters, generator/specification versions, declared synthetic coverage, record counts and SHA-256. Declare that reproducibility verifies synthetic construction, not hospital coverage.
6. Verify same inputs produce identical bytes/checksum, identifiers are unique, schema/period/status counts match the independent plan, and the Phase 3A/3B pipeline accepts the data. Keep deliberately defective cases in small test fixtures.
7. Do not add dashboard, AI, alerts or deployment to the generation phase.

This is a proposal only. Stop after Phase 3B and await approval.
