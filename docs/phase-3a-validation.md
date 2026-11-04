# Phase 3A — CSV ingestion, encounter validation and comparison periods

Date: November 4, 2026 (America/Denver).
Status: implemented and automatically checked within the limited Phase 3A scope.
No medians, comparison KPIs, operational detection, main synthetic dataset, dashboard, AI integration, authentication, database or deployment were implemented.

## Preflight and preserved baseline

Read the five approved Phase 1 documents and the Phase 2 execution report, plus existing contracts, fixture data, manual expectations, tests, configuration and repository status. No material requirement inconsistency was found. Historical phase-specific stop statements are superseded only by the user's explicit Phase 3A authorization.

The original foundation passed strict TypeScript checking and all 23 existing tests before the baseline commit. The approved five documents retain their Phase 2 SHA-256 values. They and the Phase 2 execution report are unchanged relative to the baseline.

Git lacked an author email. After the user supplied it, configured only FlowGuard's local user.email:
286029066+Hanzla-cs@users.noreply.github.com.
Kept the existing effective user.name as Hanzla Ali. No global Git configuration was changed.

Created and verified baseline commit:
- Full SHA: 6a6f676f31bfa9e13a430f97e4b6da0047beb181.
- Subject: Establish independent FlowGuard documentation and analytical test foundation.
- Branch: codex/analytical-foundation.
- Author/committer: Hanzla Ali with the supplied noreply email.
- 18 reviewed files; no dependencies, caches, environment secrets or generated artifacts.
- The working tree was clean after this commit.
- No remote was created or configured.

Phase 3A implementation changes remain uncommitted for review. Only the explicitly requested baseline commit was created.

## Files involved

Modified:
- package.json: pinned runtime CSV parser dependency.
- package-lock.json: locked parser version and integrity.
- src/core/contracts.ts: ingestion/validation result types and configuration issue codes, retaining the four-field encounter schema.

Created:
- src/input/parse-csv.ts: full-file byte ingestion, structural validation and source identity.
- src/core/timestamps.ts: strict UTC/calendar parsing.
- src/core/periods.ts: explicit period and observation-cutoff validation; arrival assignment; opt-in demonstration periods.
- src/core/validate.ts: record diagnostics, duplicate quarantine, accepted/rejected record sets, cohort membership and data-quality accounting.
- tests/csv.test.ts.
- tests/timestamps.test.ts.
- tests/periods.test.ts.
- tests/validation.test.ts.
- docs/phase-3a-validation.md: this record.

Existing fixtures, independent expected outcomes, the original five documents, the Phase 2 report, TypeScript/Vitest configuration and .gitignore were preserved.

## Dependency decision

Added exactly csv-parse 7.0.3, pinned in package.json and package-lock.json. The package has a maintained CSV-focused API, strict quoting support, TypeScript declarations and a browser-compatible ESM synchronous distribution. No separate type package was needed.

Using csv-parse/browser/esm/sync keeps the parser framework-independent and avoids making the application module depend on Node filesystem/stream APIs. It is used through a bounded wrapper, not as an acceptance oracle for the encounter schema.

Reviewed references:
- https://csv.js.org/parse/options/
- https://csv.js.org/parse/distributions/
- npm registry metadata for csv-parse 7.0.3.

Existing versions remain TypeScript 7.0.2, Vitest 5.1.0 and @types/node 24.19.2. Installation added one package and npm reported zero vulnerabilities among 41 audited packages. This records npm's response, not an exhaustive security guarantee.

## Implemented CSV behavior

API: parseCsv(Uint8Array, optionalName), returning a promise of either parsed data or a fatal result.

- Enforces the 2 MiB limit on original bytes and the 10,000 nonblank-data-record limit.
- Decodes UTF-8 strictly; rejects invalid byte sequences instead of replacement decoding.
- Supports optional UTF-8 BOM, LF/CRLF, quoted fields, escaped quotes, quoted commas and quoted multiline values.
- Requires exactly the four named headers in any order; rejects missing, duplicate or unexpected columns.
- Rejects malformed quoting and inconsistent widths.
- Does not trim, coerce, infer, deduplicate or repair source values.
- Counts skipped completely blank records while preserving logical record numbers. A four-empty-field record remains a data record. Quoted empty or whitespace-only one-field records are not mistaken for blank lines.
- A header-only file is valid empty input; an empty/headerless file is fatal.
- Exposes no partial record collection after any fatal error.
- Produces SHA-256 over the original byte snapshot, with source name and byte length. Caller mutation while asynchronous hashing runs cannot change the captured source.
- Structural diagnostics identify logical records, not physical line numbers.

The parser's column-count relaxation is used internally only so blank logical records can be inspected and counted. The wrapper explicitly rejects every nonblank row whose width differs from four; no malformed-width row is accepted.

A checksum establishes byte identity, not the truth or completeness of the source.

## Implemented timestamps and encounter validation

UTC parser accepts only YYYY-MM-DDTHH:mm:ssZ or the same with exactly three fractional digits. It verifies Gregorian calendar dates, leap years, years 0001–9999, clock components and the full source string. It rejects local/offset formats, whitespace, extra precision, rollover dates and leap-second notation. It does not read the current clock or machine timezone.

The record validator:
- Preserves each original four-field record and recorded status.
- Validates case-sensitive identifier syntax and length; empty/invalid IDs are excluded. Literal null and N/A are not accepted identifiers.
- Detects repeated syntactically valid IDs across the entire file before other exclusions or period filtering.
- Quarantines every member of each repeated-ID group, including identical records, conflicting periods, unusable arrivals and out-of-period records. No preferred row is chosen.
- Preserves other diagnostics on quarantined records without counting them again as exclusive rejected encounters.
- Separately diagnoses missing/malformed arrival and provider timestamps, invalid/missing provider status, provider/status conflicts, negative chronology and after-cutoff values.
- Keeps identity/arrival-valid encounters countable when only provider timing/status is defective.
- Treats missing provider time for not_seen as expected information; does not infer departure, current physical waiting, final outcome or clinical priority.
- Allows provider contact after the arrival period ends, zero duration, and arbitrarily long valid intervals when no supplied cutoff excludes them. It does not calculate waiting-time values.
- Validates observation-cutoff syntax and provenance. A malformed cutoff blocks acceptance/accounting rather than being treated as absent. Equality with a valid cutoff is allowed.

API: validateEncounters(parsedCsv, configuration). It accepts a successful CsvParsed result, not a fatal ingestion result.

Result populations:
- inspected: every parsed data record and its nonexclusive diagnostics.
- quality.quarantinedRecords: every duplicate-ID member.
- accepted: nonquarantined identity/arrival-valid records, including records outside the selected periods.
- rejected: nonquarantined identity/arrival exclusions; provider-only defects do not cause encounter rejection.
- cohorts/outsidePeriods: available only with valid period and cutoff configuration.
- quality.accounting: exclusive Q/I/U/O/A/B source accounting.
- quality.periods: countable, timing-eligible and timing-excluded record memberships; exclusive timing-exclusion reasons; recorded-seen and provider timestamp present/parse-valid/missing memberships.

These are validation/lineage counts, not computed operational metric cards. Overall timing eligibility and seen-provider timestamp completeness percentages are not calculated. Their separate record sets are preserved for a later metric layer.

A null timing-exclusion reason on an inspected record alone does not establish eligibility: nonquarantine, valid identity/arrival, valid configuration and period membership are also required.

## Implemented period configuration

- Two explicitly selected, nonoverlapping, half-open seven-day UTC intervals.
- UTC-midnight boundaries and exactly 168 hours per period.
- Adjacent and nonadjacent intervals accepted; no chronological relabeling of A and B.
- Inclusive start and exclusive end, based only on arrival.
- Explicit outside-period record membership.
- No inference from observed dates and no default dates for arbitrary uploads.
- Confirmation is bound to the current source SHA-256. Replacing source bytes requires confirmation for the new identity.
- demonstrationPeriods(sourceSha256) provides the October 5–12 and October 12–19 half-open ranges only through explicit opt-in. It is not called as a fallback.
- Invalid/missing periods block cohort accounting while record diagnostics and, when the cutoff is valid, identity/arrival acceptance remain inspectable.

Coverage metadata is preserved as an assertion with independentlyVerifiedHospitalCoverage fixed to false. This phase does not calculate coverage percentages, merge declared intervals, verify hospital capture completeness, or implement a full manifest validator.

## Automated verification

First implementation run:
- Strict checking found a callback type mismatch in the CSV package's raw-output declarations.
- Vitest reported 143 passed and 1 failed: blank logical records with CRLF.
- Direct inspection confirmed that csv-parse's raw CRLF record output includes only CR.
- Fixed the callback by accepting unknown and checking its runtime shape, and handled the observed CRLF raw representation without treating quoted empty fields as blank records.

Final executed checks:
- npm run check: passed.
- npm run typecheck (tsc --noEmit): passed.
- Complete Vitest suite: 6 files, 144 tests passed, including the 23 unchanged foundation tests.
- git diff --check: passed.
- npm ls --depth=0: confirmed csv-parse 7.0.3 and unchanged development versions.
- Baseline/document diff and original-document SHA-256 verification: passed.
- Local Git identity origin: .git/config for email; effective name Hanzla Ali.
- Remote inspection: none configured.

No lint script or lint configuration exists, so no lint check was applicable. No lint dependency was introduced.

Tests cover:
- Correct schema and reordered headers; quoted commas/quotes/multiline values; BOM and UTF-8 errors.
- Fatal malformed structures with no partial accepted result.
- LF and CRLF blank records, logical record numbering, and all-empty fields.
- Exactly/over 2 MiB and exactly/over 10,000 records. Large cases exist only in test memory and are not the main demonstration dataset.
- Calendar boundaries, leap years, years 0001/0099/9999, invalid clock parts, unsupported offsets/precision, trailing newline and whitespace.
- Exact/invalid identifiers, case sensitivity, all-member duplicate quarantine and overlapping diagnostics.
- Original statuses, missingness, malformed provider values, status conflicts, zero-duration eligibility and negative chronology.
- Observation-cutoff equality, after-cutoff exclusions and invalid cutoff configuration.
- Adjacent/nonadjacent/reversed-label periods, overlap/duration/midnight errors, shared boundaries, outside periods and stale source confirmation.
- Empty input and the approved twelve-record fixture.
- Q + I + U + O + N_A + N_B reconciliation, accepted + rejected + quarantined reconciliation, and exclusive timing-exclusion memberships.
- Separate recorded-seen timestamp presence, parse validity and timing eligibility.
- Input nonmutation, repeatability and declared-versus-verified coverage.

Manual expected medians and comparisons remain fixture documentation only. No test claims to validate a production median or KPI implementation.

## Limitations and next boundary

No unresolved failure remains in the executed Phase 3A checks. Tests ran in the installed Windows/Node environment; browser UI execution has not been tested. Browser-standard TextDecoder and Web Crypto are required by ingestion; no UI or server adapter exists yet.

The configuration API is typed TypeScript, not a general untrusted-JSON schema endpoint. No API, UI, main synthetic generator, operational alert rule, forecast or clinical validation is represented as complete.

Suggested Phase 3B, requiring separate approval: pure deterministic metrics over these validated cohorts; counts/status proportions, median door-to-provider, explicit denominators, seen timestamp completeness and timing eligibility, unavailable states, approved rounding, and descriptive differences. Test against the already independent manual expectations and preserve coverage/comparability limitations. Do not combine that step with dashboard, AI, alerts or main dataset generation.

All implementation work remained within FlowGuard. ED Flow Intelligence and global Git settings were not modified. Stop here and await the user's next approval.
