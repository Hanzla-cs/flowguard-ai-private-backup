# Phase 3C — independent synthetic dataset and reproducibility

Date: November 4, 2026 (America/Denver).
Status: implemented and verified; Phase 3C changes intentionally uncommitted for review.

## Authorization and Phase 3B checkpoint

The user approved this generator, the 1,400-encounter scenario, seed 20261104,
5–120 inclusive A waits, exact paired +10-minute B waits, reproducibility tests,
and a dedicated Phase 3B checkpoint. No dashboard work is authorized.

Rechecked all Phase 3B tracked and untracked file hashes against the preceding
read-only review: unchanged. Reinspected the contracts diff, explicit file list,
and secret-related text. No unrelated file or credential was included.
Strict TypeScript checking and all 203 tests across 9 files passed again before
staging. Reviewed the staged file list/stat and whitespace check.

Checkpoint: `6d64750e1e778dff8342ff233f3c1cdb976b13a3`

Subject: Implement and verify deterministic metrics and evidence reports.
Eleven Phase 3B files. Existing local author/committer identity preserved:
Hanzla Ali <286029066+Hanzla-cs@users.noreply.github.com>.
Working tree was clean after checkpoint. No remote configured or push performed.

## Files and scope

Created:
- `.gitattributes`: preserve LF bytes for synthetic CSV/JSON through Git checkouts.
- `src/synthetic/generate.ts`: pure generation and strict reproduction verification.
- `scripts/generate-synthetic.mjs`: Node 24 write/check/stdout entry point.
- `data/synthetic/flowguard-paired-wait-shift-v1.csv`.
- `data/synthetic/flowguard-paired-wait-shift-v1.manifest.json`.
- `tests/synthetic.test.ts`: 20 additional tests, including parameterized cases.
- `docs/phase-3c-synthetic.md`: specification, verification and execution record.

No existing source, approved specification, fixture, expectation, dependency,
package/lock file or tooling configuration was modified. No specification
contradiction was found. No ED Flow Intelligence file was accessed or modified.

## Exact generator specification

Generator version: FG-GENERATOR-1. Manifest version: FG-SYNTHETIC-1.
Algorithm: FG-LCG32-1. Default seed: unsigned integer 20261104.
Seeds must be integers in [0, 4294967295]; zero is valid.

State update, before each output:

`state = (1664525 × state + 1013904223) mod 4294967296`

The unsigned updated state is the output. JavaScript uses Math.imul for exact
low-32-bit multiplication and unsigned right shift by zero for normalization.
There is no current-time seed, floating-point random draw, locale-dependent
formatting or unseeded randomness.

For an integer bound n, set L = floor(4294967296/n) × n. Consume outputs until
one is less than L, then return output mod n. Rejected draws advance state.
This avoids modulo range bias; it does not make this simple PRNG cryptographic
or establish independent/statistically realistic healthcare samples.

Traverse A days 0–6, then slots 0–99 on each day. For every slot:

1. Draw `sample(864)` for arrival jitter, in whole seconds 0–863.
2. Arrival = October 5 UTC midnight + day × 24 hours + slot × 864 seconds + jitter.
3. Slots 0–84 are seen, 85–94 not_seen, and 95–99 unknown.
4. For seen only, draw `sample(116)` and add 5 to obtain an integer wait 5–120 minutes.
5. Create its B partner with arrival exactly seven days later and, if seen,
   wait exactly ten minutes greater. B consumes no random draws.

Provider timestamp = arrival + wait in integer milliseconds. Other statuses
have an empty provider field. Observation cutoff is October 20, 2026 00:00 UTC.
The scenario fits within that cutoff without truncation.

Pair number = day × 100 + slot + 1, padded to six digits. IDs are
FG-A-NNNNNN and FG-B-NNNNNN. Pair identity is explicit in the identifier suffix
and manifest rule, without an additional encounter column or duplicate ID.

This is deliberately constructed. Stratified arrival slots, fixed status/time
ordering, the simple PRNG, and exact A/B pairing are demonstration assumptions,
not empirically fitted arrivals, provider outcomes or observed hospital deterioration.

## Stable artifacts and provenance

CSV has exactly the four approved columns in contract order. All A rows precede
all B rows; each period is ordered by day then slot. Timestamps use
YYYY-MM-DDTHH:mm:ss.SSSZ. Fixed values contain no commas, quotes or newlines,
so no field quoting is needed. Empty provider values remain empty CSV cells.
Both artifacts use UTF-8 without BOM, LF only, and exactly one final LF.

JSON uses the fixed property insertion order in FG-GENERATOR-1 and
`JSON.stringify(manifest, null, 2) + '\n'`. Arrays retain their specified order.
No creation clock or other volatile field is serialized. Changing these rules
requires a versioned artifact change. Git attributes protect LF bytes on Windows.

CSV size: **89,596 bytes**. Data records: **1,400** (plus one header).

CSV SHA-256:
`5cafd9e244b8b48d729b78176449df5fce37bbbcc13ce1dd2f38bbf77602a0a2`

The manifest includes generator algorithm/version/seed/draw order, parameters,
pairing/serialization rules, expected counts, periods, cutoff, fictional origin,
source-declared synthetic coverage, byte length and CSV SHA-256.

All records are independently constructed for FlowGuard. No patient, hospital,
academic project, workbook, external dataset or rejected implementation supplies
the baseline. Construction reproduction and SHA-256 are not source authenticity,
independent hospital capture verification, realism or clinical validation.

`verifySynthetic` reproduces both canonical artifacts for a trusted caller-selected
seed (default 20261104), requires exact byte equality, and returns a source-bound
analysis configuration only on success. CSV alterations fail even if their checksum
in the manifest is also updated. Manifest alterations, unknown fields, malformed
JSON and serialization changes fail. This is intentionally a strict verifier for
this one versioned scenario, not a general-purpose upload-manifest parser.

The saved manifest says syntheticReproduction = not_checked. Successful verification
sets matched in the returned analysis configuration; it does not trust a claim
inside an uploaded manifest. Coverage remains source-declared and
independentlyVerifiedHospitalCoverage remains false. A fully regenerated different
seed is accepted only when the caller explicitly selects that seed.

## Independent expectations and actual verification

Counts and status expectations are literal values from the approved scenario.
A separate BigInt recurrence (exact multiplication/modulus) checks the production
32-bit implementation. A frequency histogram and rank 298 establish the A median
70 independently of the analytical engine's sorting/median code. The first
arrival jitter/wait anchors are (239 seconds, 75 minutes), (377, 101), (755, 35).
The first row arrives at 00:03:59 and sees a provider at 01:18:59 UTC on October 5.
No existing fixture or expected value was changed.

Executed on Node 24.16.0, TypeScript 7.0.2, Vitest 5.1.0:

- `node node_modules/typescript/bin/tsc --noEmit`: passed, exit 0.
- `node node_modules/vitest/vitest.mjs run --no-cache --no-fsModuleCache --configLoader native`:
  **223 passed across 10 files**, including all original 203 tests, exit 0.
- `node scripts/generate-synthetic.mjs --check`: passed, exit 0.
- Fresh child processes with TZ=UTC, America/Denver and Asia/Kathmandu:
  identical CSV and manifest bytes, also identical to saved artifacts.
- Repeat calls produce identical artifacts; changing seed changes CSV bytes.
- Independent SHA-256 and length checks, canonical serialization, unique IDs,
  daily/period counts, pairing, status/provider rules and cutoff checks pass.
- Tampered CSV, recomputed malicious CSV checksum, altered manifest checksum,
  seed/counts/coverage, extra field and invalid JSON are rejected.
- Full CSV ingestion, validation, analysis and JSON report round trip pass.
- Git tracked diff/whitespace checks and no-index whitespace checks on all seven
  new files passed. The first no-index wrapper mistakenly treated exit 1 (added
  content) as failure; corrected exit/output handling confirmed no whitespace defect.
- Existing tracked files and the staging area are unchanged from the Phase 3B
  checkpoint. Node syntax checking of the CLI and Git LF attribute checks passed.

Actual engine results:

| Measure | A: Oct 5–11 UTC | B: Oct 12–18 UTC |
|---|---:|---:|
| Countable encounters | 700 | 700 |
| Seen / not_seen / unknown / invalid | 595 / 70 / 35 / 0 | 595 / 70 / 35 / 0 |
| Timing eligible / excluded | 595 / 105 | 595 / 105 |
| Median eligible door-to-provider minutes | 70.0 | 80.0 |
| Overall timing eligibility | 85.0% | 85.0% |
| Seen timestamp completeness / parse validity | 100.0% / 100.0% | 100.0% / 100.0% |
| Seen timing eligibility | 100.0% | 100.0% |
| Declared temporal coverage | 100.0% | 100.0% |

Median difference: exactly **+10 minutes**, relative difference 100/7 percent
(14.3% displayed). Other count/status/eligibility/completeness differences are zero.
All 1,400 records are accepted; no quarantine, rejection or outside-period row.
Expected informational missing-provider diagnostics remain for the 210 not_seen
and unknown records. These are not malformed data or unexpected timing defects.
No independent hospital coverage claim is made.

## Reproduction commands and remaining boundary

From the repository root, using existing Node 24 and installed dependencies:

```text
node scripts/generate-synthetic.mjs --write
node scripts/generate-synthetic.mjs --check
node scripts/generate-synthetic.mjs --stdout
```

Write regenerates only the two designated scenario artifacts; check reads/verifies
without modifying them; stdout emits both artifact strings as JSON without files.
The generator uses only erasable TypeScript, so this CLI needs no runtime dependency
or experimental TypeScript transformation flag. It uses Node's existing type stripping.

Timezone reproducibility has been executed in separate processes on this Windows
host. Cross-OS execution has not been performed; portable integer arithmetic, UTC
formatting, fixed encoding and LF attributes support it, but are not an executed
Linux/macOS verification claim. The independent oracle cannot prove every possible
PRNG seed or future implementation change correct. No browser/UI or clinical test
is claimed. Strict artifact verification does not provide cryptographic signatures.

Phase 4 dashboard development is ready for a separately approved scope after
review/checkpoint of Phase 3C. Presentation should consume existing evidence values,
show the fictional constructed scenario label, provenance, dates, denominators and
limitations, and distinguish failed ingestion/reproduction from successful results.
Browser integration, accessibility and upload-state behavior require Phase 4 tests.
No dashboard, AI, operational alert, forecast, database, authentication or deployment
was implemented. Phase 3C remains uncommitted. Stop for review and approval.
