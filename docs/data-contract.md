# FlowGuard AI data contract
Specification: FG-DATA-1. Status: documentation baseline; runtime implementation pending.
See [metric specification](metric-specification.md) and [verification plan](verification-plan.md).

## 1. Four-field encounter schema

All four CSV columns are mandatory. Missing cells are diagnosed; they are not all file-level failures.

| Field | Logical type | Meaning |
|---|---|---|
| encounter_id | String | Unique fictional encounter identifier |
| arrival_at_utc | UTC timestamp string | Encounter arrival |
| first_provider_at_utc | UTC timestamp string or empty cell | First recorded provider contact |
| provider_status | seen, not_seen, or unknown | Recorded provider-contact status at the observation cutoff, when that cutoff is known |

No additional encounter fields are mandatory. An internal parsed representation may use null for an empty provider cell; literal CSV text `null` is not an empty cell.

Identifiers use 1–64 ASCII letters, digits, hyphens, or underscores, with case-sensitive equality. No trimming, case folding, renumbering, or implicit merging. Examples: FG-A-000001 and FG-B-000001.

## 2. UTC timestamps and observation cutoff

Accept YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ, with exactly three fractional digits when present. Require a valid Gregorian date, years 0001–9999, hours 00–23, minutes/seconds 00–59, and explicit Z. Leap-second notation, local/naive timestamps, alternate offsets, ambiguous date formats, and calendar rollover normalization are unsupported in version 1.

Use integer epoch milliseconds for duration arithmetic. Do not consult the current clock or machine timezone to interpret records. Display UTC initially.

Provider time may fall after the encounter's comparison period; assignment remains based on arrival. Zero duration is valid. Negative chronology is invalid. No maximum wait or outlier-removal rule is approved.

An observation cutoff is optional dataset/run metadata, not a fifth encounter field. When supplied, its value and source must be recorded. Arrival after that cutoff is excluded from period assignment; provider contact after it is excluded from timing. Equality with the cutoff is allowed. Without a cutoff, temporal completeness is unknown; do not infer one from the latest row.

## 3. Status semantics and timing eligibility

| Status and provider value | Meaning and handling |
|---|---|
| seen + valid provider time at/after arrival | Timing-eligible if cutoff-consistent |
| seen + empty provider value | Recorded seen; missing timing evidence; timing-excluded |
| seen + malformed provider value | Recorded seen; malformed timing evidence; timing-excluded |
| seen + provider before arrival | Recorded seen; chronology defect; timing-excluded |
| not_seen + empty provider value | Valid recorded status; timing-excluded |
| unknown + empty provider value | Valid uncertainty; timing-excluded |
| not_seen or unknown + populated provider value | Status/timestamp conflict; timing-excluded |
| Missing/unsupported status | Separate invalid/missing-status category; timing-excluded |

Preserve the recorded status for descriptive status counts even when another field conflicts. Do not infer status from a timestamp.

Not_seen does not establish departure without contact, current physical waiting, final encounter outcome, or a clinical priority. Unknown represents uncertain provider-contact status. The four fields do not establish encounter completion. Encounters with incomplete information remain countable when identity and arrival support counting.

## 4. CSV structure and file-level failures

UTF-8 with an optional BOM; comma delimiter; standard double-quoted fields and escaped quotes; LF or CRLF records. Retain strings rather than automatic numeric/date coercion.

Require exactly the four named headers, in any order. Reject duplicate, missing, or unexpected headers, inconsistent field counts, undecodable UTF-8, malformed quoting, and missing headers. A header-only file is structurally valid and empty.

Completely blank logical records may be skipped, but count and report them. A record with four empty fields is not a blank record; validate its fields. Do not trim cells silently. Whitespace-only values and literal N/A or null are invalid where the contract requires a status, identifier, or timestamp.

Diagnostics must identify logical CSV record numbers, with the header numbered 1. Quoted multiline content does not create multiple logical records.

Proposed engineering limits: 2 MiB of input bytes and 10,000 nonblank data records. Exceeding a limit is a file-level rejection, not partial analysis. These are demonstration limits, not healthcare standards.

**A fatal structural error blocks all calculations for that file.** Do not salvage a prefix of records or display previous results as if they came from the failed file.

## 5. Recoverable record defects and duplicate quarantine

A structurally valid file may contain record-level defects. Retain diagnostics and calculate from the supported remainder; do not automatically block the entire file.

Detect duplicated syntactically valid IDs across the entire parsed file, before period filtering or other record exclusions. Every member of every repeated-ID group is quarantined, including identical rows and members outside the selected periods or with other defects.

- No first-row, last-row, or supposedly better-row selection.
- No silent deduplication.
- Quarantined records contribute to no encounter aggregate, status denominator, timing metric, or metric comparison.
- Report each duplicated ID, all affected logical record numbers, number of groups, and total records quarantined.
- Preserve overlapping diagnostics on those records.
- Invalid/empty IDs are excluded as invalid identity, not pooled into a duplicate group.

Other recoverable defects include unusable arrivals, provider timestamps, invalid statuses, and contradictions. Their effects are metric-specific: a bad provider time does not erase an otherwise countable encounter.

Use the exclusive row-accounting and timing-exclusion priorities in the metric specification. Diagnostic counts may overlap, but exclusive exclusion totals must reconcile.

## 6. Comparison configuration

The bundled synthetic scenario defaults to:
- A: [2026-10-05T00:00:00Z, 2026-10-12T00:00:00Z).
- B: [2026-10-12T00:00:00Z, 2026-10-19T00:00:00Z).
- Observation cutoff: 2026-10-20T00:00:00Z.

For arbitrary CSV uploads, require explicit confirmation of two nonoverlapping seven-day UTC periods. Never silently apply the demonstration dates, infer windows from observed minimum/maximum dates, or silently preserve an old file's period selection as a confirmed selection for a replacement file.

Version 1 uses UTC midnight boundaries and exactly 168 hours per period. Periods may be nonadjacent. A is the selected baseline and B the selected comparison; labels must show the dates. No automatic chronological swapping. Overlap, wrong duration, or missing selection blocks comparison configuration, while structural/quality inspection may still proceed.

## 7. Coverage and provenance metadata

A companion manifest is recommended for generated data and optional for uploads. It does not alter the four-column encounter schema.

Proposed manifest contents: schema/dataset versions, fictional-data statement, generator/version/algorithm/seed/parameters, expected record count, CSV checksum, scenario periods, observation cutoff, declared collection intervals, declared completeness, and provenance of each assertion.

Distinguish:
- **Observed record span:** earliest/latest usable arrivals; not proof of continuous coverage.
- **Declared collection coverage:** an assertion by the source or uploader.
- **Synthetic generation coverage:** reproducibility against a generator and manifest, when actually tested.
- **Independent hospital coverage verification:** not established by this prototype.

Self-declared metadata must never appear as independently verified hospital completeness. Checksums verify byte identity, not source truth. A synthetic generator's reproduction verifies its construction, not real-world representativeness.

No records on a date may mean zero encounters or missing data. Do not infer which. Without metadata, report coverage unverified. A manifest alone also cannot establish whether outcomes had sufficient follow-up.

## 8. Independent generation plan

No dataset or generator is created in this phase.

Proposed synthetic scenario: 100 arrivals per UTC day over the two default weeks, totaling 1,400 encounters. Each day has 85 seen, 10 not_seen, and 5 unknown. Seen encounters receive valid provider times; other statuses have empty provider cells.

Use an explicitly named and versioned seeded pseudo-random algorithm, fixed parameters, stable record ordering, UTF-8 serialization, LF newlines, and a deterministic identifier scheme. Do not use the current time or unseeded randomness. Keep volatile creation timestamps out of deterministic CSV bytes.

The precise algorithm, seed, arrival distribution, waiting-duration distribution, and period-B shift remain to be approved before generation. They must not be represented as realistic hospital parameters. Separate small fixtures introduce malformed values and incomplete coverage.

No real patient data, WVMC dataset, academic demonstration workbook, academic fixture, or rejected prior implementation artifact may supply the generated baseline.
