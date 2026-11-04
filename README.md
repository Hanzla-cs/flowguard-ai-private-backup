# FlowGuard AI
## Hospital Operations Risk & Decision Support

**Detect operational pressure. Explain the evidence. Support better decisions.**

FlowGuard AI is an independent prototype for emergency department administrators, hospital operations managers, and healthcare quality improvement teams. Its intended workflow is **Detection → Evidence → Explanation → Human Review**.

## Current status and authorization

Phase 1 consists of these five foundation documents only. No analytical engine, synthetic dataset, application, dashboard, AI integration, dependency installation, Git repository, or deployment has been created by this phase. Mathematical examples are manually derived acceptance expectations, not executed test results.

The user approved documentation creation on November 3, 2026 (America/Denver), including four refinements: quarantine all records with a duplicated valid ID; explicitly select future upload comparison periods; distinguish seen-provider timestamp completeness from timing eligibility and declared coverage from independent verification; separate deterministic metrics, rule-based detection, and future AI explanations.

## Independent project boundary

This directory is separate from the academic ED Flow Intelligence project at `C:\Users\aliha\OneDrive\Documents\ed-flow-intelligence`. No academic code, datasets, fixtures, calculations, or documentation are copied into this foundation. The WVMC workbook and academic fictional demonstration workbook are not FlowGuard assets. Their reuse permissions remain unverified. Prior rejected implementation artifacts are not an approved baseline.

A separate repository and history may be established only in a later approved step. A different name or repository does not itself establish independent ownership.

## Product boundary

The prototype will describe operational observations and support administrative review. It is not a clinical diagnostic tool, patient triage system, autonomous staffing system, or clinically validated forecasting solution. Synthetic findings do not describe real hospitals. No causal findings, financial savings, or industry thresholds are claimed.

## Proposed architecture, not implemented

One Next.js application using React and strict TypeScript is proposed. Tailwind CSS is a candidate for consistent responsive styling. The analytical core will be pure TypeScript, independently testable and independent of React, the browser, and external APIs.

Proposed flow:

CSV parsing → structural validation → record validation and quarantine → explicit period assignment → deterministic metrics → structured evidence report → presentation.

The evidence report must carry the source identity, selected periods, specification version, coverage assertions and their provenance, sample sizes, denominators, exclusions, limitations, and metric identifiers. React components must not independently calculate business metrics.

Small CSV files can be processed locally in the browser. No database, authentication, hosting, separate backend service, or AI API is required for the initial foundation. Proposed dependencies and compatible versions will be reviewed only when installation is authorized.

Future modules:
- `src/input/parse-csv.ts`: CSV decoding and structural diagnostics.
- `src/core/contracts.ts`: explicit input, issue, period, and evidence types.
- `src/core/timestamps.ts`: strict UTC and calendar validation.
- `src/core/validate.ts`: record diagnostics and duplicate quarantine.
- `src/core/periods.ts`: explicit, nonoverlapping seven-day periods.
- `src/core/metrics.ts`, `compare.ts`, and `analyze.ts`: verified calculations and one evidence-producing entry point.
- A separately approved generator, fixtures, tests, and later Next.js presentation files.

These paths describe future work; no such files exist as a result of this phase.

## Three distinct capabilities

1. **Deterministic metrics:** implemented later against the approved formulas and independent expected values. Passing tests establishes conformance to a specification, not clinical validity or independent source verification.
2. **Rule-based detection:** later transparent, versioned rules applied to verified metrics. No operational alert thresholds are approved here. Data-quality diagnostics are separate from hospital-pressure detection.
3. **Future AI explanation:** optional interpretation of structured evidence, with metric references, explicit limitations, findings separated from hypotheses, and administrative questions for human review. It must not invent numbers, operational causes, or clinical recommendations. A deterministic template must be labeled rule-based, not AI-generated.

Astra through Codex is the user's development preference. Runtime model access, selection, pricing, and necessity remain separate, unresolved decisions. No model API is connected.

## Documents

- [Data contract](docs/data-contract.md): four fields, parsing, validation, quarantine, coverage, and independent generation.
- [Metric specification](docs/metric-specification.md): populations, periods, formulas, eligibility, completeness, and comparison limitations.
- [Verification plan](docs/verification-plan.md): manual expected results, failure cases, and future acceptance gates.
- [Provenance and event log](docs/provenance-and-event-log.md): sources, ownership boundaries, competition context, and chronology.

## Next-step boundary

After review, the proposed next step is a separately authorized minimal analytical test foundation: independent Git history, a minimal TypeScript test environment, and manually specified fixtures/contracts. Do not scaffold Next.js, generate a large dataset, or build the dashboard before the analytical contracts are verified. The exact next-step files and installation scope must be approved first.
