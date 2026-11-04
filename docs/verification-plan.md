# FlowGuard AI verification plan
Specification: FG-VERIFY-1. **All cases below are planned acceptance expectations, not executed tests.**
Depends on [data contract](data-contract.md) and [metric specification](metric-specification.md).

## 1. Independent oracle

Write small literal fixtures and their expected results independently of the implementation. Do not generate expected answers by calling the same functions under test. Keep generator reproducibility tests separate from analytical correctness tests.

Future verification layers:
1. Unit checks for CSV structure, strict calendar parsing, record validation, quarantine, periods, metrics, and comparisons.
2. CSV-to-evidence integration against manually calculated expectations.
3. Accounting invariants and row-order invariance.
4. Reproducibility checks for the future generator and manifest.
5. Later UI/browser checks that presentation uses engine results and handles replacement, loading, empty, error, keyboard, and mobile states.

## 2. Primary 12-record fixture

Use the default two UTC periods. Arrival for every A record is 2026-10-05T12:00:00Z; arrival for every B record is 2026-10-12T12:00:00Z. IDs are A1–A6 and B1–B6. Provider offsets below define the exact timestamp relative to arrival; blank means an empty cell. Observation cutoff is 2026-10-20T00:00:00Z.

| Logical record | ID | Period | Status | Provider offset |
|---|---|---|---|---|
| 2 | A1 | A | seen | +10 minutes |
| 3 | A2 | A | seen | +20 minutes |
| 4 | A3 | A | seen | +30 minutes |
| 5 | A4 | A | seen | +40 minutes |
| 6 | A5 | A | not_seen | blank |
| 7 | A6 | A | unknown | blank |
| 8 | B1 | B | seen | +10 minutes |
| 9 | B2 | B | seen | +20 minutes |
| 10 | B3 | B | seen | −5 minutes |
| 11 | B4 | B | seen | blank |
| 12 | B5 | B | not_seen | blank |
| 13 | B6 | B | unknown | blank |

| Expected measure | A | B |
|---|---|---|
| Countable encounters N | 6 | 6 |
| Seen / not_seen / unknown / invalid status | 4 / 1 / 1 / 0 | 4 / 1 / 1 / 0 |
| Timing eligible n | 4 | 2 |
| Timing exclusions E | 2 | 4 |
| Median | 25 minutes | 15 minutes |
| Missing provider timestamps, cohort-wide | 2 | 3 |
| Negative chronology | 0 | 1 |
| Seen populated provider values P | 4 | 3 |
| Seen parse-valid provider values V | 4 | 3 |
| Seen missing provider values M | 0 | 1 |
| Overall timing eligibility | 66.7% displayed | 33.3% displayed |
| Seen provider timestamp completeness | 100.0% | 75.0% |
| Seen provider timestamp parse validity | 100.0% | 75.0% |

Exact timing eligibility fractions are 4/6 and 2/6. Median difference = −10 minutes; relative difference = −40.0%; eligibility difference = −100/3 percentage points (−33.3 displayed); seen completeness difference = −25.0 percentage points. Status proportions are unchanged.

B's timing exclusions are one not_seen, one unknown, one seen missing provider, and one seen negative chronology. A's exclusions are one not_seen and one unknown.

This is a misleading-improvement case: a lower observed median coincides with lower usable timing coverage. Expected presentation is a descriptive decrease with limitations, not a claim of improved hospital performance. Sparse observed dates do not prove either full coverage or missing days.

## 3. Duplicate quarantine acceptance

Start with the primary fixture and append a copy of record 2 as record 14.
- Parsed data records R = 13.
- One duplicated valid-ID group, A1, with logical records [2, 14].
- Quarantined records Q = 2; neither is selected as authoritative.
- N_A = 5; N_B = 6; R = Q + N_A + N_B.
- A's retained seen waits are [20, 30, 40]; n_A = 3; median A = 30.
- A statuses are 3 seen, 1 not_seen, 1 unknown; timing eligibility = 60.0%.
- Seen provider timestamp completeness A remains 100.0%.
- B results remain unchanged.
- Median B − A = −15 minutes; relative difference = −50.0%.

Repeat with record 14 retaining ID A1 but using a B-period arrival and a conflicting provider time. Both records remain quarantined; N_A = 5 and N_B = 6. Repeat with record 14 outside both periods or with malformed arrival: duplicate detection still quarantines both records before filtering.

A file containing only two records with the same valid ID has Q = 2, accepted counts 0, and unavailable medians. It is structurally valid with recoverable quarantines, not a fatal duplicate-file failure.

Distinct missing IDs are invalid-identity exclusions, not a duplicate group.

## 4. Additional exact cases

| Case | Expected outcome |
|---|---|
| Eligible waits [10, 20, 40] | Median 20 minutes |
| Eligible waits [10, 20] | Median 15 minutes |
| Eligible wait [0] | Median 0; single-observation limitation |
| Provider 1 millisecond after arrival | Duration 1/60,000 minutes retained before formatting |
| Missing arrival, otherwise valid | U increases by 1; no period assignment |
| 2026-02-30T12:00:00Z | Malformed calendar date; no normalization |
| Timestamp without Z or with +00:00 | Rejected by version-1 representation contract |
| Seen with malformed nonempty provider value, sole A row | N=1, S=1, P=1, V=0, n=0; completeness 100%, parse validity 0%, median unavailable |
| Not_seen with valid provider timestamp, sole A row | N=1, T=1, n=0; conflict flag; seen completeness unavailable |
| Unknown with blank provider, sole A row | N=1, K=1, n=0; median unavailable |
| Invalid status with valid arrival/ID, sole A row | N=1, X=1, n=0; no silently inferred seen status |
| Provider after supplied cutoff | Timing-excluded; after-cutoff diagnostic |
| Arrival after supplied cutoff | U exclusion before period assignment |
| Timestamp exactly at cutoff | Not excluded solely for cutoff equality |
| Header-only CSV | R=0; accepted period counts 0; median/percentages unavailable |
| Empty file without header | Fatal structural failure; no metrics |
| Missing provider timestamps for all seen | Seen completeness 0%; median unavailable |
| No seen encounters | Seen completeness unavailable, not 0% |
| All IDs invalid | I=R; accepted counts 0 with exclusion limitation |

## 5. Period selection and boundaries

Use unique valid IDs and seen status:
- Arrival 2026-10-05T00:00:00Z: A.
- Arrival 2026-10-12T00:00:00Z: B only.
- Arrival 2026-10-19T00:00:00Z: O.
- Arrival 2026-10-04T23:59:59.999Z: O.
- Arrival 2026-10-11T23:50:00Z and provider 2026-10-12T00:10:00Z: A, wait 20 minutes.

An arbitrary upload with no explicit period confirmation has no period aggregates/comparison. It must not acquire October demonstration dates automatically.

Accept nonadjacent periods [2026-10-05, 2026-10-12) and [2026-10-19, 2026-10-26), with UTC-midnight timestamps. Reject overlapping intervals, six/eight-day windows, and nonmidnight boundaries. Changing dates invalidates the old result. Replacing a file requires explicit confirmation of its period selection.

## 6. Coverage and comparison cases

- A declared collection interval [2026-10-05T00:00:00Z, 2026-10-08T00:00:00Z) covers 72 of A's 168 hours: 42.9% displayed declared temporal coverage.
- Two overlapping declared intervals [Oct 5, Oct 7) and [Oct 6, Oct 8) have a 72-hour union, not 96 hours.
- Missing metadata: coverage unverified, regardless of observed span.
- A manifest claiming complete collection: display declared completeness and provenance; never independently verified hospital coverage.
- Correct synthetic checksum: byte identity matched; not proof of hospital completeness.
- Records spanning all seven dates: observed day presence, not proof that all encounters were captured.
- Baseline median 0 and comparison median 10: absolute difference +10; relative difference unavailable.
- One median unavailable: both median differences unavailable.
- Partial periods: preserve seven-day bounds and raw observed counts; no extrapolation.
- Status percentages use N; seen completeness uses S; do not substitute denominators.

## 7. Fatal CSV and recoverable record tests

Fatal: missing/duplicate/unexpected headers, inconsistent field counts, malformed quoting, invalid UTF-8, more than 2 MiB, or more than 10,000 nonblank records. Expect actionable diagnostics and no calculated results. Do not analyze a partially parsed prefix.

Recoverable: duplicate IDs, invalid IDs, missing/malformed timestamps, invalid status, and chronology/status conflicts. Expect the specified quarantines/exclusions and calculations on the supported remainder.

Test accepted reordered headers, UTF-8 BOM, LF/CRLF, quoted fields, and blank-record accounting. A four-empty-field record is a data record with invalid identity. Nonempty literal null/N/A must not silently become missing.

## 8. Reconciliation and numerical acceptance

Assert R = Q + I + U + O + N_A + N_B when configuration is valid.
Assert S + T + K + X = N and n + E = N per period.
Assert primary timing-exclusion counts sum to E and P + M = S.
Assert 0 <= n <= V <= P <= S <= N.
Assert 0 <= percentages <= 100 when available.
Reordering rows leaves metrics unchanged while diagnostic logical record numbers update appropriately.
Changing provider data cannot alter encounter counts when identity/arrival stay valid.
No quarantined record appears in an aggregate's eligible-record lineage.

Compare counts and duration arithmetic exactly where representable as integers or half-milliseconds. Use an explicitly small absolute tolerance (proposed 1e-9) only for derived floating-point ratios/minutes; test displayed rounding separately.
Rounding expectations: 1.25 → 1.3, −1.25 → −1.3, −0.04 → 0.0. Never compare rounded cards to generate changes.

## 9. Future UI and AI acceptance boundaries

The UI must consume engine report values and show source/run identity, dates, denominators, sample sizes, exclusions, and limitations. A failed replacement upload cannot masquerade as successful analysis or silently reuse stale results. Empty, all-quarantined, loading, and fatal-error states are distinct.

Later rule-based detection tests require approved rule definitions; no pressure thresholds exist in this phase. Later AI evaluations must test evidence references, numerical consistency, limitations, hypotheses, refusal to invent causes, and graceful failure. AI prose must not overwrite metrics. These are future acceptance requirements, not completed capabilities.

## 10. Verification status

Documentation arithmetic and consistency may be reviewed in this phase. No analytical code, generated datasets, automated tests, browser tests, or clinical validation have been executed for FlowGuard. Record actual future commands, dates, versions, and outcomes only after execution; do not describe planned tests as passing.
