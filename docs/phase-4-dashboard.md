# Phase 4 — professional dashboard implementation

Date: November 4, 2026 (America/Denver). Changes remain uncommitted for review.

## Preflight and scope

Read the existing specifications and Phase 2/3A/3B/3C execution records, inspected
the repository, source contracts, fixtures, configuration and clean Git status.
No applicable AGENTS.md or reference image was found. The reference image was
also absent from the received message. The interface therefore implements the
written visual requirements; pixel-level correspondence to that image is **not
verified**. No generic dashboard template or external visual assets were used.

Before edits, strict TypeScript checking passed and the existing **223 tests in
10 files passed**. Original fixtures, test expectations, dataset, manifest,
generator, parser, validator, period rules and existing calculation formulas are
unchanged. The only modifications within the original engine are one additive
contract field and its daily-series call/import. No academic project was accessed
for implementation, modified or copied. Nothing was staged, committed or deployed.

## Implemented behavior

- Navy FlowGuard sidebar, responsive navigation, white canvas, four KPI cards,
  central interactive comparison, right-side Operational Status, explanation and
  review-checklist panels, and horizontal primary/future action area.
- Load Synthetic Demo fetches the original repository CSV/manifest through a
  read-only allowlisted route. Browser-side reproduction must match before the
  demo metadata is accepted. Fetches have a 15-second timeout.
- CSV uploads remain in browser memory. There is no upload endpoint, database,
  local storage, analytics, authentication or runtime AI API. Reload clears input.
  The existing strict UTF-8 parser enforces 2 MiB / 10,000-record limits.
- Uploads reset dates and confirmation. Users explicitly select start dates for
  both seven-day UTC periods and confirm them for that source before Run Analysis.
  End dates are shown inclusively; engine boundaries remain half-open. Overlap
  blocks comparison; nonadjacent dates and A/B order retain existing semantics.
- Every source/date/confirmation change clears old analytical results. A generation
  token prevents an older asynchronous result from replacing the current state.
- Run Analysis calls the existing deterministic engine. All business values come
  from calculated evidence; combined totals/weighted rates are prepared in a pure
  tested core helper, not in React. No median averaging or unsupported KPIs.
- Median bars and seven-day encounter bars support clicks and keyboard activation,
  inspected evidence, explicit units/periods, accessible tables and limitations.
  [FG-DAILY-1](phase-4-contract.md) documents the additive daily-series contract.
  Daily buckets preserve lineage and reconcile with period encounter counts.
- Quality evidence includes exclusive row accounting, primary timing exclusions,
  nonexclusive diagnostic counts/messages/logical records, raw seen/unusable
  arrivals, denominators, source hash, run fingerprint, observed span, declared
  coverage, cutoff and limitations. Duplicate groups retain all-member quarantine.
- Empty, header-only, all-quarantined, loading, malformed/oversized upload,
  configuration-error, reproduction-error, fetch-error and successful-with-
  limitations states have distinct visible explanations and recovery paths.
- Operational Status distinguishes calculated evidence, quality limitations,
  unverified hospital capture and planned detection. No clinical or staffing
  condition is inferred. Successful validation never becomes a performance claim.
- AI explanation is marked Planned, with present-day deterministic observations.
  Recommended actions are data-review steps, not clinical/staffing recommendations.
  What-If Scenario, Generate Report and Export Summary (PDF) are disabled and
  visibly marked Planned.

## Data accuracy

Values below are asserted against the saved artifacts and engine, not copied from
UI mockups. Uploads calculate their own values.

| Measure | A: Oct 5–11, 2026 UTC | B: Oct 12–18, 2026 UTC |
|---|---:|---:|
| Accepted encounters | 700 | 700 |
| Median eligible door-to-provider | 70.0 min | 80.0 min |
| Timing eligible | 595 | 595 |
| Timing exclusions | 105 | 105 |
| Timing eligibility | 85.0% | 85.0% |
| Seen timestamp completeness | 100.0% | 100.0% |
| Accepted records in each UTC-day bucket | 100 | 100 |

Combined encounters: **1,400**; combined eligibility: **1,190 / 1,400 = 85%**;
combined timing exclusions: **210**; median difference B − A: **+10.0 minutes**.
The 1,190 populated provider timestamps are out of 1,190 recorded seen encounters,
not out of all 1,400 encounters. The paired shift is deliberately fictional.

## Exact file inventory

Modified:

- `.gitignore`
- `README.md`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `src/core/contracts.ts`
- `src/core/metrics.ts`

Created:

- `next.config.ts`
- `next-env.d.ts`
- `eslint.config.mjs`
- `playwright.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/demo/[asset]/route.ts`
- `src/components/dashboard.tsx`
- `src/components/evidence-chart.tsx`
- `src/components/evidence-details.tsx`
- `src/components/icon.tsx`
- `src/core/daily.ts`
- `src/core/dashboard-summary.ts`
- `src/input/dashboard-input.ts`
- `tests/dashboard-evidence.test.ts`
- `e2e/dashboard.spec.ts`
- `docs/phase-4-contract.md`
- `docs/phase-4-dashboard.md`
- `docs/screenshots/desktop-chromium-dashboard.png`
- `docs/screenshots/desktop-chromium-daily.png`
- `docs/screenshots/mobile-chromium-dashboard.png`
- `docs/screenshots/mobile-chromium-daily.png`

Generated/ignored: `.next`, `.playwright`, test-results, playwright-report,
node_modules, npm cache and TypeScript build cache. No independent data artifact
was recreated or replaced.

## Dependencies and compatibility

| Direct dependency | Exact version | Purpose |
|---|---|---|
| next | 16.4.5 | App Router and local server |
| react / react-dom | 19.3.1 / 19.3.1 | UI |
| csv-parse | 7.0.3 | Existing parser, unchanged |
| @types/react / @types/react-dom | 19.3.0 / 19.3.0 | React types |
| @types/node | 24.19.2 | Existing Node types |
| @typescript/native | npm:typescript@7.0.2 | Existing TS 7 compiler retained via alias |
| typescript | npm:@typescript/typescript6@6.0.2 | Compatibility API for Next/lint tooling |
| eslint | 9.39.5 | Compatible lint CLI |
| eslint-config-next | 16.4.5 | React, Next, TypeScript and accessibility rules |
| @playwright/test | 1.64.1 | Browser workflows and screenshots |
| vitest | 5.1.0 | Existing test runner |

The Node 24.16.0 environment satisfies [Next's installation requirements](https://nextjs.org/docs/app/getting-started/installation).
No chart, icon, styling framework, AI or PDF dependency was added. Icons are local
SVG paths; charts use native HTML/CSS. Fonts are system-local without remote requests.

TypeScript 7 cannot supply the API expected by typescript-eslint. The aliases
follow [Microsoft's side-by-side compatibility guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).
`npm run typecheck` uses TS 7.0.2 with incremental caching disabled to avoid sharing
Next's TS 6 build cache. Strictness, unchecked-index and exact-optional checks are
retained; skipLibCheck and allowJs are explicitly false. DOM/JSX, Next generated
types and ES2024 library declarations support the framework while the emitted
target remains ES2022. Both strict checking and the production build are executed.

ESLint 10 was rejected because Next's bundled React/import/accessibility plugins
still declare ESLint 9 peers. ESLint 9.39.5 installs with a deprecation notice;
this compatibility limitation is recorded, not hidden. A targeted override pins
minimatch versions >=7 and <11.0.1 to 11.0.1 to address the installation's moderate
development-tool advisory. The adjusted installation reported **zero
vulnerabilities**. Prettier 3.6.2 was used once via npm exec, without adding it as a
project dependency. Lockfile records installed packages/integrities.

## Verification record

- Baseline: strict TypeScript and 223/223 tests, 10 files.
- Final `npm.cmd run typecheck`: passed, TS 7.0.2; no skipped library checks.
- Final `npm.cmd test`: **248/248 tests in 11 files passed** (25 new cases).
- Final `npm.cmd run lint`: passed with zero warnings.
- Final `npm.cmd run build`: passed, Next.js 16.4.5 production build, with framework
  TypeScript checking. Routes: static dashboard, not-found, read-only demo asset.
- `node scripts/generate-synthetic.mjs --check`: passed; original CSV/manifest match.
- Browser suite: **20/20 passed**, 10 scenarios each on desktop Chromium and
  emulated mobile Chromium, against the final production build (31.9 seconds).
  No page errors occurred in the demo scenario. Four screenshots were captured
  and visually inspected.
- Git tracked/untracked whitespace checks passed after normalizing two generated
  line-ending/EOF artifacts. Preservation checks passed for original datasets,
  generator, analytical modules, fixtures and approved specifications. Staging is
  empty; all Phase 4 changes are uncommitted.

New unit coverage includes original synthetic values, all fixture daily
reconciliations, midnight boundaries, provider-defective but countable arrivals,
outside-period duplicate quarantine, invalid identity/arrival/cutoff exclusions,
empty denominators, weighted combined rates, row reversal, leap/year boundaries,
invalid dates and source-bound explicit selection.

Browser cases cover initial/keyboard states, disabled planned actions, verified
demo numbers, chart activation/tables, provenance/exclusions, stale date changes,
overlap and recovery, fatal replacement uploads, required fresh confirmation,
browser-only data processing, header-only/all-quarantined sources, oversized
files, network recovery, visible loading, reproduction tampering and navigation.

Initial browser failures came from an ambiguous alert locator (Next's route
announcer also has role=alert) and a Windows text-encoding edit of a test string.
They were corrected. An initial sandboxed test-server teardown stalled; the final
browser run used normal process cleanup. Screenshots are captured at page top so
fixed navigation is positioned correctly.

## Screenshots and design limitations

- [Desktop dashboard](screenshots/desktop-chromium-dashboard.png)
- [Desktop daily counts](screenshots/desktop-chromium-daily.png)
- [Mobile dashboard](screenshots/mobile-chromium-dashboard.png)
- [Mobile daily counts](screenshots/mobile-chromium-daily.png)

The written design is reflected in the shell, layout, palette, card shapes,
operational panel and action placement. Unsupported screenshot statistics are
replaced by accepted encounter counts, eligibility and seen completeness. A
period-median comparison replaces any unsupported detailed timing trend. Daily
bars show only verified accepted counts. A visible input/period section and
quality/provenance section support honest local workflows. Exact image matching,
original logo details and screenshot-specific spacing cannot be assessed without
the missing approved image.

Chromium is tested on Windows at desktop and emulated Pixel 7 sizes. Responsive
overflow checks cover 320, 390, 768, 1024, 1440 and 1920 CSS pixels. This is not
physical-device, Safari/iOS, Firefox or Edge certification. Those environments,
screen-reader execution and a full WCAG audit remain untested. Keyboard/semantic
controls, visible focus, reduced-motion behavior, responsive wrapping, local fonts
and readable evidence colors are implemented.

## Local use and checks

Node 24 / npm 11, from the repository root (npm.cmd avoids Windows PowerShell's
npm.ps1 execution-policy issue):

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. Load Synthetic Demo, then Run Analysis. For your CSV,
select both dates, check confirmation, and run. No upload is sent to the server.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd start
```

To install the test browser into this workspace and execute against a production
build (the Playwright configuration starts/stops the local server):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright'
node node_modules/playwright/cli.js install chromium
npm.cmd run build
npm.cmd run test:browser
```

Browser tests refresh the four screenshots. If a server is already listening on
port 3000, stop it first to ensure the tests use the current production build.
In a restricted sandbox, browser process cleanup may require execution approval.

## Remaining boundary

Uploads have no manifest-entry/cutoff-entry workflow in this phase, so their
collection coverage and follow-up remain unverified. No triage, length of stay,
causes, significance, hospital census or real-world operational detection is
invented. The demo is fictional and deterministic.

Runtime AI, alerts, what-if calculations, staffing decisions, report generation,
PDF export, authentication, databases and deployment remain outside Phase 4.
Stop here for review; no later phase has been started.
