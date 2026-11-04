# FlowGuard AI metric specification
Specification: FG-METRIC-1. Implementation and runtime verification pending.
Depends on [data contract](data-contract.md).

## 1. Calculation boundary

All numerical business results originate in a deterministic analytical engine. CSV parsing, validation, and run configuration precede calculation. UI formatting must not change metric values or recompute business definitions.

Fatal CSV failures prevent calculation. Recoverable record defects produce diagnostics and appropriate record/metric exclusions. Duplicate-ID groups are quarantined in full, not file-blocking failures.

A run identity must include source byte identity, specification version, selected periods, supplied observation cutoff, and coverage metadata/provenance. Changing any input invalidates the previous result. No clock-dependent assumptions.

## 2. Explicit periods

A and B are explicitly selected, nonoverlapping, half-open seven-day intervals [start, end), using UTC midnight boundaries and exactly 168 hours. Adjacency is not required.

Default synthetic scenario:
A = [2026-10-05T00:00:00Z, 2026-10-12T00:00:00Z).
B = [2026-10-12T00:00:00Z, 2026-10-19T00:00:00Z).

These defaults apply only to the identified demonstration scenario. Arbitrary uploads require confirmed dates. Invalid/missing configuration blocks period calculations; never guess periods from the data. Assignment uses arrival only. A provider timestamp after the period end may remain eligible.

## 3. Exclusive source-record accounting

R is the number of parsed nonblank data records in a structurally valid file; separately report skipped blank records. Assign every data record exactly one primary category in this order:

1. Q: member of a duplicated valid-ID group, regardless of other defects or period.
2. I: missing/invalid identifier.
3. U: missing/malformed arrival, or arrival after a supplied observation cutoff.
4. O: usable arrival outside both selected periods.
5. N_A or N_B: countable encounter in its selected arrival period.

R = Q + I + U + O + N_A + N_B.

This equation requires valid period configuration. Without it, report validation results without inventing O or period counts. Additional diagnostic flags may overlap and do not replace this exclusive accounting.

N_p is the number of encounters represented by accepted, unique-ID arrival records in period p. Provider defects and invalid statuses do not remove those records from N_p. N_p is not a verified total of hospital encounters; quarantined/unassignable records may make it incomplete.

## 4. Recorded status distribution

Within N_p, count S_p (seen), T_p (not_seen), K_p (unknown), and X_p (missing/invalid status).

S_p + T_p + K_p + X_p = N_p.
For each category, percentage = 100 × count / N_p when N_p > 0.

Preserve recorded status despite provider-time conflicts. X_p is a quality bucket, not a fourth operational status. Counts are zero for an empty cohort; percentages are unavailable when N_p = 0.

## 5. Median door-to-provider time

An encounter is eligible if it is in N_p, has status seen, has a syntactically/calendar-valid provider timestamp, provider >= arrival, and provider <= supplied cutoff when a cutoff exists.

Let n_p be the eligible count. For each eligible encounter:
duration_ms_i = provider_epoch_ms_i − arrival_epoch_ms_i.
wait_minutes_i = duration_ms_i / 60,000.

Sort durations numerically. The median is the middle duration for odd n, or the mean of the two central durations for even n. Divide the resulting median duration by 60,000 for minutes.

Use exact integer millisecond durations and, for even samples, preserve the half-millisecond result before conversion. Do not round individual durations. Zero wait is valid. Do not impute, truncate, cap, or remove long waits.

When n_p = 0, return unavailable, not zero. When n_p = 1, return the observation and explicitly note the single-observation sample. No clinical sample-size sufficiency threshold is established.

Display label: **Median door-to-provider time among eligible encounters**.

## 6. Timing eligibility and exclusive exclusions

Overall timing eligibility percentage = 100 × n_p / N_p, available only when N_p > 0.
Timing exclusions E_p = N_p − n_p.

Assign each timing-excluded encounter exactly one primary reason, in this order:
1. Missing/invalid provider_status.
2. Recorded not_seen.
3. Recorded unknown.
4. Seen with missing provider timestamp.
5. Seen with malformed provider timestamp.
6. Seen with provider before arrival.
7. Seen with provider after supplied cutoff.

The sum of these exclusive counts equals E_p. A secondary conflict flag can coexist with a not_seen/unknown exclusion. Additional diagnostics must not be summed as though mutually exclusive.

Duplicate quarantines and unusable arrivals occur before N_p and are reported separately, not counted again in E_p.

## 7. Timestamp completeness among recorded seen encounters

Report completeness separately from overall timing eligibility.

Within S_p:
- P_p: provider field is populated, including malformed or contradictory timestamps.
- V_p: provider field parses as a valid UTC timestamp, even if chronology/cutoff later makes it ineligible.
- M_p: provider field is empty.

P_p + M_p = S_p.
Seen provider timestamp completeness = 100 × P_p / S_p.
Seen provider timestamp parse validity = 100 × V_p / S_p.
Optional seen timing eligibility = 100 × n_p / S_p.

All three percentages are unavailable when S_p = 0. Label presence as completeness, not valid evidence. A populated negative-chronology timestamp counts in P_p and V_p but not n_p.

Arrival validity is already required for period membership. Global missing/invalid-arrival counts among raw records marked seen must also be available so the period-level completeness denominator does not hide unassignable records. Global diagnostics include quarantined records with their quarantine labels and must not be confused with period aggregates.

## 8. Timestamp and other quality evidence

Report missing and malformed arrivals separately. Report missing and malformed provider values separately, plus negative chronology, after-cutoff timestamps, and status/timestamp conflicts.

Global diagnostics cover all parsed records. Period diagnostics cover N_p. State the population on every count. Missing provider values for not_seen are expected under this contract; missing provider values for seen are incomplete timing evidence.

Each diagnostic includes issue code, severity/scope, logical record numbers, affected field(s), and its effect on counting or timing. Overlapping diagnostic flags must be labeled nonexclusive.

## 9. Differences and rounding

For an available scalar metric x:
absolute change = x_B − x_A.
relative percentage change = 100 × (x_B − x_A) / x_A, only when x_A is nonzero and both values are available.

For category proportions, timing eligibility, and seen timestamp completeness, compare unrounded percentages:
percentage-point difference = percentage_B − percentage_A.

Use original values, not rounded card displays. Counts are integers; duration, percentage, and percentage-point displays use one decimal place. Round decimal ties away from zero; suppress negative zero. Preserve precision for machine-readable results and document finite-number comparison tolerances in tests.

A zero baseline makes relative change unavailable, not infinite and not zero. A missing median makes both its absolute and relative differences unavailable.

## 10. Coverage and insufficient-data states

Period elapsed duration is always 168 hours. Do not shorten periods to fit observed data or extrapolate partial records into full-week totals.

When collection intervals are declared, calculate their clipped union within the selected period, avoiding overlapping-interval double counting. Declared temporal coverage percentage = 100 × union duration / 168 hours. Label it **declared temporal coverage**, with its source. It does not establish encounter capture completeness or independently verified hospital coverage.

Show observed dates/span separately. A day without records is not automatically a data gap or a confirmed zero-arrival day.

For partial, unknown, or self-declared coverage, descriptive differences may be shown with a comparability limitation; do not label them verified hospital change. Similarly, show timing eligibility and seen timestamp completeness beside median comparisons.

Possible results include calculated, calculated_with_limitations, unavailable, and blocked_by_file_or_configuration_error. A run with every record quarantined can have zero accepted counts and unavailable medians, but must prominently state that records were excluded; it is not evidence of zero actual encounters.

Do not infer statistical significance, population-wide improvement, operational causes, or clinical safety from these descriptive comparisons.

## 11. Metrics, detection, and explanations

These formulas produce descriptive measurements of supplied data. Synthetic scenario parameters and coverage declarations are assumptions/provenance, not measurements of hospital performance.

No operational pressure threshold is approved in this phase. Later rule-based detection must expose inputs, rule/version, conditions, and limitations. Data-quality diagnostics must not be relabeled clinical or operational risk alerts.

Future AI explanations may interpret a structured evidence report and suggest administrative investigation questions. They must reference metric IDs and selected periods, preserve denominators and uncertainty, and separate findings from hypotheses. They must not invent numerical claims, causal explanations, staffing assignments, or medical recommendations.

Verified metric means calculation conformance actually checked against this specification. It does not mean externally verified input truth or clinical validation. No such executed verification is claimed by these documents.
