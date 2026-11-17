# FlowGuard AI pre-DevDay baseline

Verified November 17, 2026 (America/Denver). **PASS · GO for baseline freeze.**

## Checkpoint

- Branch `codex/analytical-foundation`
- Tested baseline commit `57401f89d17b4f381428339da04cf6ddb67e4935`
- Annotated tag `pre-devday-baseline` resolves to the tested commit. Tag object `3811503320b3b9a80173954dd69bcc156d2ac35e`.
- The verification record and the two new screenshots are in a documentation-only follow-up. All 27 staged baseline paths matched the tested copy and Git index. No application, analytical, dataset or test edits were needed during this freeze. Twenty pre-existing screenshot files remain untracked and preserved. The older Phase 4 record refers to earlier local captures.

## Verification performed

| Command | Observed result |
| --- | --- |
| `npm.cmd run typecheck` | Strict checking passed |
| `npm.cmd run lint` | Passed with zero lint warnings |
| `npm.cmd test` | 248 passed in 11 files, 0 failed, 0 skipped |
| `npm.cmd run build` | Passed on Next.js 16.4.5 with Turbopack. Built the dashboard and the read-only demo asset route |
| `npm.cmd run test:browser` | 28 passed, 0 failed, 0 skipped. 14 desktop Chromium and 14 emulated mobile Chromium |
| `node scripts/generate-synthetic.mjs --check` | Canonical CSV and manifest match the versioned generator |

Node 24.16.0 and npm 11.13.0. The existing browser suite runs against `next start`. It covered chart and evidence interactions, period confirmation and invalid overlap, stale result clearing, local uploads, malformed and oversized CSV, duplicate quarantine, missing and invalid timestamps, replacement and recovery, and keyboard navigation. The existing data and test assertions were used as written.

The default sandbox denied an early Vitest cache write. The first isolated build failed because Turbopack could not resolve a dependency junction outside its project root. The reported passing runs used a separate copy with writable test caches and copied installed dependencies for the production build.

## Canonical synthetic results

| Engine measure | Period A · October 5–11 UTC | Period B · October 12–18 UTC | Combined or change |
| --- | ---: | ---: | ---: |
| Accepted encounters | 700 | 700 | 1,400 |
| Median door to provider | 70.0 min | 80.0 min | +10.0 min (+14.3%) |
| Timing-eligible encounters | 595 | 595 | 1,190 (85.0%) |
| Timing exclusions | 105 | 105 | 210 |
| Seen timestamp completeness | 100.0% | 100.0% | 100.0% among recorded seen |
| Duplicate quarantine | | | 0 |

The engine uses two nonoverlapping, half-open seven-day intervals from UTC midnight October 5, 12 and 19, 2026. The public browser and local production build displayed matching results, and repeated analysis returned the same metrics. The demo is fictional. CSV SHA-256 `5cafd9e244b8b48d729b78176449df5fce37bbbcc13ce1dd2f38bbf77602a0a2`. Manifest SHA-256 `a882156f0dcbd5b0ca5fa9777dca2fb59e5f04b4f7a05905ef557bf5dfe29487`.

## Local browser and public deployment

- Activated About on the local build and the public site at 375, 768, 1440 and 1536 CSS pixels. In each case the URL moved to `#about`, the footer entered the viewport and the page had no horizontal overflow. The desktop and mobile screenshots below were visually inspected.
- Uploads use browser memory. A separate run with a fictional two-row CSV produced one encounter per period without any upload-time network requests or browser storage writes. Reload cleared the upload and the built-in demo state. **Load Synthetic Demo → Run Analysis** restored the same built-in results after reload.
- The [public FlowGuard deployment](https://flowguard-ai-iota.vercel.app/) opened in an unauthenticated Chromium context. The dashboard and both demo assets returned HTTP 200. The public CSV SHA-256 matched the local file. The deployed view matched the tested dashboard behavior and kept the planned navigation disabled. No page errors were observed in that run.
- Linked Vercel project `flowguard-ai`. Public browser request reference `sfo1::c5rdz-1794929431241-3cdcc187fdc9`. Vercel denied deployment-list access, so the deployment ID and exact deployed Git SHA could not be confirmed. No behavioral mismatch was found in the exercised flows. This checkpoint made no changes to the deployment.

## Release scope and DevDay boundary

The baseline contains deterministic evidence and comparison charts, data-quality diagnostics, browser-local CSV ingestion, a fictional demo and a review checklist. Hospital capture remains unverified. The browser results cover Chromium and emulated mobile only. The initial data must be loaded again after a reload.

AI explanation, operational alerts, what-if analysis, report generation and PDF export remain planned. The Evidence-Based Investigation Assistant remains competition-day work, including grounded interpretation, review statuses and note history. The organizer allows existing businesses and describes judging a constrained feature built during the event, alongside a pitch. AI tools are permitted and other people's work must be respected. [Lassonde DevDay organizer guidance](https://lassonde.utah.edu/devday/)

- [Desktop baseline · 1536px](screenshots/pre-devday-baseline-desktop.png)
- [Mobile baseline · 375px](screenshots/pre-devday-baseline-mobile.png)
