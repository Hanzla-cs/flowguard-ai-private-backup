"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AnalysisConfiguration,
  CalculatedEvidenceReport,
  CsvParsed,
  ValidationIssue,
} from "../core/contracts";
import { analyze } from "../core/analyze";
import { dashboardSummary } from "../core/dashboard-summary";
import { parseCsv, MAX_FILE_BYTES } from "../input/parse-csv";
import {
  selectedConfiguration,
  sevenDayPeriod,
} from "../input/dashboard-input";
import { verifySynthetic } from "../synthetic/generate";
import { validateEncounters } from "../core/validate";
import { Icon } from "./icon";
import { EvidenceChart } from "./evidence-chart";
import { EvidenceDetails } from "./evidence-details";

type Dataset = {
  input: CsvParsed;
  metadata: Pick<AnalysisConfiguration, "coverage" | "observationCutoff">;
  synthetic: boolean;
};
const noMetadata = {
  coverage: { kind: "unverified" },
  observationCutoff: null,
} as const;
const countFormat = new Intl.NumberFormat("en-US");

export function Dashboard() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [report, setReport] = useState<CalculatedEvidenceReport | null>(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Choose the synthetic demonstration or upload a CSV to begin.",
  );
  const [errors, setErrors] = useState<readonly ValidationIssue[]>([]);
  const [failure, setFailure] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const generation = useRef(0);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    navigation.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [menuOpen]);
  const summary = report ? dashboardSummary(report) : null;
  const medianComparison = report?.comparisons.find(
    (item) => item.metricId === "median_door_to_provider",
  );
  const difference = medianComparison?.absoluteDifference;
  const relative = medianComparison?.relativePercentageDifference;
  const relativeDisplay = relative?.value == null
    ? "Relative change unavailable"
    : `${relative.value > 0 ? "+" : ""}${relative.displayValue}%`;
  const volumeDifference = report?.comparisons.find(
    (item) => item.metricId === "encounter_count",
  )?.absoluteDifference;
  const signedDifference =
    difference?.value === null || !difference
      ? "Unavailable"
      : `${difference.value > 0 ? "+" : ""}${difference.displayValue}`;

  function resetSource() {
    const token = ++generation.current;
    setDataset(null);
    setReport(null);
    setA("");
    setB("");
    setConfirmed(false);
    setErrors([]);
    setFailure("");
    setBusy(true);
    return token;
  }

  async function demo() {
    const token = resetSource();
    setMessage("Loading and reproducing the original synthetic artifacts…");
    try {
      const responses = await Promise.all([
        fetch("/demo/csv", { signal: AbortSignal.timeout(15000) }),
        fetch("/demo/manifest", { signal: AbortSignal.timeout(15000) }),
      ]);
      if (responses.some((response) => !response.ok))
        throw new Error(
          "The demo could not be loaded. Retry Load Synthetic Demo.",
        );
      const [csv, manifest] = await Promise.all(
        responses.map(
          async (response) => new Uint8Array(await response.arrayBuffer()),
        ),
      );
      const config = await verifySynthetic(csv!, manifest!);
      const input = await parseCsv(csv!, "flowguard-paired-wait-shift-v1.csv");
      if (input.kind !== "parsed")
        throw new Error("Synthetic CSV validation failed. Reload the demo.");
      if (token !== generation.current) return;
      setDataset({ input, metadata: config, synthetic: true });
      setA("2026-10-05");
      setB("2026-10-12");
      setConfirmed(true);
      setMessage(
        "Synthetic reproduction matched. Demo periods selected; choose Run Analysis.",
      );
    } catch (error) {
      if (token === generation.current) {
        setFailure(
          error instanceof Error
            ? error.message
            : "Unable to load demonstration.",
        );
        setMessage("Demo load failed. Retry or choose a CSV.");
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  async function upload(file: File) {
    const token = resetSource();
    setMessage("Reading and validating CSV locally…");
    try {
      if (file.size > MAX_FILE_BYTES)
        throw new Error("CSV exceeds the 2 MiB limit. Choose a smaller file.");
      const input = await parseCsv(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
      );
      if (token !== generation.current) return;
      if (input.kind === "fatal") {
        setErrors(input.issues);
        setMessage("CSV rejected. Correct the file and upload it again.");
        return;
      }
      const inspection = validateEncounters(input, {
        ...noMetadata,
        periods: { kind: "unselected" },
      });
      setDataset({ input, metadata: noMetadata, synthetic: false });
      setMessage(
        `CSV structure accepted: ${input.records.length} records; ${inspection.quality.quarantinedRecords.length} duplicate-quarantined. Select and confirm two seven-day periods. Coverage is unverified.`,
      );
    } catch (error) {
      if (token === generation.current) {
        setFailure(
          error instanceof Error ? error.message : "Unable to read this file.",
        );
        setMessage("Upload failed. Choose another CSV to recover.");
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  function changeDate(id: "A" | "B", value: string) {
    generation.current += 1;
    if (id === "A") setA(value);
    else setB(value);
    setReport(null);
    setConfirmed(false);
    setErrors([]);
    setFailure("");
    setBusy(false);
    setMessage(
      "Period selection changed. Confirm the new dates and run analysis.",
    );
  }

  async function run() {
    if (!dataset || !confirmed || busy) return;
    const token = ++generation.current;
    setBusy(true);
    setReport(null);
    setErrors([]);
    setFailure("");
    setMessage("Calculating deterministic evidence locally…");
    try {
      // Yield for the loading state before bounded synchronous parsing/validation work.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const result = await analyze(
        dataset.input,
        selectedConfiguration(
          dataset.input.source.sha256,
          a,
          b,
          dataset.metadata,
        ),
      );
      if (token !== generation.current) return;
      if (result.status === "blocked_by_file_or_configuration_error") {
        setErrors(result.blockingIssues);
        setMessage(
          "Comparison blocked. Correct the dates and confirm them again.",
        );
        setConfirmed(false);
      } else {
        setReport(result);
        setMessage(
          "Analysis complete · deterministic results with coverage limitations.",
        );
      }
    } catch (error) {
      if (token === generation.current) {
        setFailure(
          error instanceof Error
            ? error.message
            : "Analysis could not complete.",
        );
        setMessage("Analysis failed. Review your selection and retry.");
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  function periodEnd(id: "A" | "B", date: string) {
    try {
      return new Date(
        Date.parse(sevenDayPeriod(id, date).endUtcExclusive) - 86400000,
      )
        .toISOString()
        .slice(0, 10);
    } catch {
      return "Select start date";
    }
  }

  const dataControls = (
    <section
            className="data-panel panel"
            id="data"
            aria-labelledby="data-title"
          >
            <div className="data-top">
              <div>
                <h2 id="data-title">Your data, in context</h2>
                <p>
                  {dataset
                    ? dataset.input.source.name
                    : "Start with a verified fictional scenario or your own encounter CSV."}
                </p>
              </div>
              <div className="source-actions">
                <button
                  className="button primary"
                  onClick={demo}
                  disabled={busy}
                >
                  <Icon name="database" size={17} />
                  Load Synthetic Demo
                </button>
                <label
                  className={`button secondary upload-button ${busy ? "disabled" : ""}`}
                >
                  <Icon name="upload" size={17} />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Upload CSV"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void upload(file);
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="period-controls">
              <label>
                Period A <span>· baseline start</span>
                <input
                  type="date"
                  aria-label="Period A start"
                  value={a}
                  disabled={!dataset || busy}
                  min="0001-01-01"
                  max="9999-12-24"
                  onChange={(event) => changeDate("A", event.target.value)}
                />
                <small>Through {periodEnd("A", a)} UTC</small>
              </label>
              <span className="period-divider">vs.</span>
              <label>
                Period B <span>· comparison start</span>
                <input
                  type="date"
                  aria-label="Period B start"
                  value={b}
                  disabled={!dataset || busy}
                  min="0001-01-01"
                  max="9999-12-24"
                  onChange={(event) => changeDate("B", event.target.value)}
                />
                <small>Through {periodEnd("B", b)} UTC</small>
              </label>
              <label className="confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={!dataset || !a || !b || busy}
                  onChange={(event) => {
                    setConfirmed(event.target.checked);
                    setReport(null);
                  }}
                />
                <span>
                  I confirm these two seven-day UTC periods for this file.
                </span>
              </label>
            </div>
            <details className="csv-help">
              <summary>CSV requirements & local privacy</summary>
              <p>
                UTF-8 CSV, maximum 2 MiB and 10,000 records. Required headers:{" "}
                <code>
                  encounter_id, arrival_at_utc, first_provider_at_utc,
                  provider_status
                </code>
                . Timestamps use explicit UTC Z; statuses are seen, not_seen, or
                unknown. Provider cells may be empty. All members of repeated
                valid IDs are quarantined.
              </p>
              <p>
                Uploaded bytes stay in browser memory. No upload API, persistent
                storage, analytics or AI service is used. Reloading clears the
                dataset. Uploaded files have unverified collection coverage and
                no declared observation cutoff.
              </p>
            </details>
          </section>
  );

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to dashboard
      </a>
      <aside ref={navigation} id="flowguard-navigation" className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a href="#main" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">
            <Icon name="heart" size={44} />
          </span>
          <span>
            FlowGuard <b>AI</b>
            <small>Hospital Operations Intelligence</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#main" onClick={() => setMenuOpen(false)}><Icon name="home" />Overview</a>
          <a href="#data" onClick={() => setMenuOpen(false)}><Icon name="upload" />Data Upload</a>
          <button disabled><Icon name="warning" /><span>Operational Alerts<small>Planned</small></span></button>
          <button disabled><Icon name="ai" /><span>AI Analysis<small>Planned</small></span></button>
          <button disabled><Icon name="sliders" /><span>What-If Scenarios<small>Planned</small></span></button>
          <button disabled><Icon name="file" /><span>Reports<small>Planned</small></span></button>
        </nav>
        <div className="sidebar-wave" aria-hidden="true">
          <svg viewBox="0 0 270 230" fill="none">
            {Array.from({ length: 32 }, (_, i) => (
              <path key={i} d={`M-15 ${95 + i * 2.8} C80 ${180 + i * 1.8}, 160 ${-30 + i * 3.2}, 285 ${40 + i * 2.6}`}
                stroke={i < 16 ? "#00c9e8" : "#6653ff"} strokeOpacity=".6" />
            ))}
          </svg>
        </div>
        <nav className="sidebar-footer" aria-label="Workspace information">
          <button disabled><Icon name="settings" /><span>Settings<small>Planned</small></span></button>
          <a href="#about" onClick={() => setMenuOpen(false)}><Icon name="info" />About</a>
        </nav>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button ref={menuButton} className="menu-button" aria-controls="flowguard-navigation" onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen} aria-label="Toggle navigation">
            <Icon name="menu" />
          </button>
          <span>FlowGuard <b>AI</b></span>
          <span className="local-indicator">Browser-local processing</span>
        </header>
        <main id="main" className={report ? "populated" : "unpopulated"}>
          <div className="page-heading">
            <div className="heading-copy">
              <h1>Emergency Department Operations</h1>
              <p>Detect operational pressure. Explain the evidence. Support better decisions.</p>
            </div>
            <div className="heading-tools">
              <div className="source-identity">
                <Icon name="hospital" size={30} />
                <div><strong>{dataset?.synthetic ? "FlowGuard demonstration" : dataset ? "Uploaded encounter data" : "Independent workspace"}</strong>
                  <span>{dataset?.synthetic ? "Synthetic demo · fictional data" : dataset ? "Coverage unverified" : "Browser-local analysis"}</span>
                </div>
              </div>
              <a className="period-selector" href="#data">
                <Icon name="calendar" size={21} />
                <span>{a && b ? "Two 7-day periods" : "Select comparison"}
                  <small>{a && b ? `${a.slice(5)} / ${b.slice(5)} · UTC` : "Explicit UTC dates"}</small>
                </span>
                <Icon name="chevron" size={16} />
              </a>
            </div>
          </div>
          {!report && dataControls}
          <div
            className={`status-line ${busy ? "loading" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot" />
            {message}
          </div>
          {(failure || errors.length > 0) && (
            <div className="error-panel" role="alert">
              <strong>Unable to complete this step</strong>
              {failure && <p>{failure}</p>}
              {errors.map((issue, index) => (
                <p key={index}>
                  {issue.message}
                  {issue.recordNumbers.length > 0
                    ? ` Logical record(s): ${issue.recordNumbers.join(", ")}.`
                    : ""}
                </p>
              ))}
              <p>Previous analytical results have been cleared.</p>
            </div>
          )}
          {report && summary ? (
            <>
              <section
                className="kpi-grid"
                aria-label="Key calculated indicators"
              >
                <Kpi
                  label="Total encounters"
                  value={countFormat.format(summary.encounters)}
                  detail={`Period A: ${report.metrics.A.encounterCount.displayValue} · Period B: ${report.metrics.B.encounterCount.displayValue}`}
                  icon="people"
                  note="Accepted records in selected periods"
                />
                <Kpi
                  label="Door to Provider (Median)"
                  value={
                    report.metrics.B.medianDoorToProvider.displayValue ??
                    "Unavailable"
                  }
                  unit={
                    report.metrics.B.medianDoorToProvider.value === null
                      ? ""
                      : "min"
                  }
                  detail={difference?.value == null ? "Comparison unavailable" : `${signedDifference} min (vs. ${report.metrics.A.medianDoorToProvider.displayValue})`}
                  icon="stethoscope"
                  note="Among timing-eligible encounters"
                />
                <Kpi
                  label="Timing Eligibility"
                  value={summary.eligibilityDisplay}
                  detail="Timing-eligible encounters"
                  icon="clock"
                  note={`${summary.excluded} timing exclusions across both periods`}
                />
                <Kpi
                  label="Seen Timestamp Completeness"
                  value={summary.completenessDisplay}
                  detail="Recorded seen only"
                  icon="shield"
                  note="Timestamp presence, not clinical validity"
                />
              </section>
              {summary.encounters === 0 && (
                <div className="empty-notice">
                  No countable encounters in the selected periods. Review
                  exclusions and dates. This does not establish zero hospital
                  encounters.
                </div>
              )}
              <div className="analysis-grid">
                <EvidenceChart
                  key={report.run.configurationFingerprint}
                  report={report}
                />
                <aside className="panel finding-panel" aria-labelledby="finding-title">
                  <div className="finding-heading">
                    <Icon name="warning" size={30} />
                    <h2 id="finding-title">Comparison Finding</h2>
                    <span className="badge neutral">Observed change</span>
                  </div>
                  <div className="finding-body">
                    <h3>{difference?.value == null ? "Median comparison unavailable" : difference.value > 0 ? "Increased Door to Provider Time" : difference.value < 0 ? "Decreased Door to Provider Time" : "Unchanged Door to Provider Time"}</h3>
                    {difference?.value == null ? <p>At least one selected period has no eligible timing observations. Review the dates and exclusions before comparing medians.</p> : <p>The median is <strong>{report.metrics.B.medianDoorToProvider.displayValue ?? "unavailable"} minutes</strong>,
                      compared with {report.metrics.A.medianDoorToProvider.displayValue ?? "unavailable"} minutes in Period A
                      — a <strong>{signedDifference}-minute</strong> change ({relativeDisplay}).</p>}
                    <a className="finding-limit" href="#quality">Descriptive evidence · View limitations</a>
                  </div>
                </aside>
              </div>
              <div className="explanation-grid" id="explanation">
                <section className="panel explanation">
                  <div className="panel-heading"><h2><Icon name="spark" size={30} />AI Explanation</h2><span className="preview-tag">Evidence preview</span></div>
                  <ul className="evidence-list">
                    <li>{difference?.value == null ? <>The median comparison is unavailable because at least one period has no eligible timing observations.</> : <>Median timing changed from <strong>{report.metrics.A.medianDoorToProvider.displayValue ?? "unavailable"} to {report.metrics.B.medianDoorToProvider.displayValue ?? "unavailable"} minutes</strong> ({signedDifference} min; {relativeDisplay}).</>}</li>
                    <li><strong>{countFormat.format(summary.eligible)}</strong> encounters are timing eligible ({summary.eligibilityDisplay}); {summary.excluded} timing exclusions. <a href="#quality">View evidence</a>.</li>
                    <li>{dataset?.synthetic ? "The paired timing shift is deliberately constructed in fictional data." : "Results describe accepted supplied records only."} No cause is inferred. AI generation is planned.</li>
                  </ul>
                </section>
                <section className="panel recommendations">
                  <div className="panel-heading"><h2><Icon name="clipboard" size={30} />Recommended Actions</h2></div>
                  <ul className="review-questions">
                    <li>Confirm dates and collection coverage.</li>
                    <li>Review exclusions and their reasons.</li>
                    <li>Check timestamps and provider follow-up.</li>
                    <li>Identify context needed for human review.</li>
                  </ul>
                </section>
                <section className="panel evidence-status">
                  <div className="panel-heading"><h2><Icon name="bars" size={30} />Operational Status</h2></div>
                  <StatusItem icon="clock" title="Median timing" text={difference?.value == null ? "Unavailable" : `${signedDifference} min observed`} />
                  <StatusItem icon="people" title="Encounter volume" text={volumeDifference?.value === 0 ? "Unchanged" : `A: ${report.metrics.A.encounterCount.displayValue} · B: ${report.metrics.B.encounterCount.displayValue}`} />
                  <StatusItem icon="shield" title="Seen timestamps" text={`${summary.completenessDisplay} among seen`} />
                  <StatusItem icon="database" title="Dataset coverage" text={report.coverage.metadata.kind === "declared" ? "Declared · unverified" : "Unverified"} />
                  <a className="coverage-note sr-only" href="#quality">Coverage not independently verified</a>
                </section>
              </div>
            </>
          ) : (
            <section className="panel empty-state" id="quality">
              <span className="empty-icon">
                <Icon name="pulse" size={38} />
              </span>
              <p className="eyebrow">EVIDENCE STARTS HERE</p>
              <h2>
                {busy
                  ? "Preparing your evidence…"
                  : dataset
                    ? "Ready for a closer look"
                    : "A clear view begins with your data"}
              </h2>
              <p>
                {dataset
                  ? "Confirm the comparison periods, then run the deterministic analysis below."
                  : "Load the synthetic demo to explore the dashboard, or upload a CSV that stays in your browser."}
              </p>
              <div className="empty-steps">
                <span>01 · Load data</span>
                <span>02 · Confirm periods</span>
                <span>03 · Run Analysis</span>
              </div>
            </section>
          )}
          <section className="action-area" aria-label="Analysis actions">
            <div className="action-buttons">
              <button
                className="button primary run-button"
                disabled={!dataset || !confirmed || busy}
                onClick={run}
              >
                <Icon name="play" size={27} />
                {busy ? "Processing…" : "Run Analysis"}
              </button>
              <button className="button planned" disabled>
                <Icon name="sliders" size={27} />
                <span>
                  What-If Scenario<small>Planned</small>
                </span>
              </button>
              <button className="button planned" disabled>
                <Icon name="file" size={27} />
                <span>
                  Generate Report<small>Planned</small>
                </span>
              </button>
              <button className="button planned" disabled>
                <Icon name="download" size={27} />
                <span>
                  Export Summary (PDF)<small>Planned</small>
                </span>
              </button>
            </div>
          </section>
          {report && dataControls}
          {dataset?.synthetic && (
            <div className="demo-notice">
              <span className="badge">SYNTHETIC DEMO</span>
              <span>
                Entirely fictional, constructed paired-wait scenario.
                Reproduction matched; not observed hospital performance.
              </span>
            </div>
          )}

          {report && <EvidenceDetails report={report} />}
          <footer className="page-footer" id="about">
            <span>
              FlowGuard AI <span className="footer-divider">/</span> Independent
              operations prototype
            </span>
            <span>Deterministic evidence. No runtime AI.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  detail,
  icon,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon: "people" | "clock" | "stethoscope" | "shield";
  note: string;
}) {
  return (
    <article className="panel kpi">
      <div className="kpi-label">
        <h2>{label}</h2>
        <span className="kpi-icon">
          <Icon name={icon} size={19} />
        </span>
      </div>
      <div className="kpi-value">
        {value}
        <small>{unit}</small>
      </div>
      <p className="kpi-detail">{detail}</p>
      <span className="sr-only">{note}</span>
    </article>
  );
}
function StatusItem({ icon, title, text }: {
  icon: "clock" | "people" | "shield" | "database";
  title: string;
  text: string;
}) {
  return (
    <div className="status-item">
      <Icon name={icon} size={22} />
      <div><h3>{title}</h3><p>{text}</p></div>
    </div>
  );
}
