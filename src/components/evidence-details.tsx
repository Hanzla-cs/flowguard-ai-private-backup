import type { CalculatedEvidenceReport } from "../core/contracts";

export function EvidenceDetails({
  report,
}: {
  report: CalculatedEvidenceReport;
}) {
  const q = report.quality;
  const periodQuality = q.periods!;
  const accounting = q.accounting!;
  return (
    <section className="panel evidence-details" id="quality">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TRACEABLE EVIDENCE</p>
          <h2>Data quality & provenance</h2>
        </div>
        <span className="badge neutral">Browser-local</span>
      </div>
      <div className="quality-summary">
        {[
          ["Parsed records", accounting.parsedNonblank],
          ["Duplicate quarantine", accounting.duplicateQuarantined.count],
          ["Invalid identity", accounting.invalidIdentity.count],
          ["Unusable arrival", accounting.unusableArrival.count],
          ["Outside periods", accounting.outsidePeriods.count],
          ["Skipped blank records", accounting.skippedBlank],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <details>
        <summary>Timing exclusions and denominator evidence</summary>
        <div className="table-scroll" role="region" aria-label="Timing exclusions table" tabIndex={0}>
          <table>
            <caption>
              Exclusive primary timing exclusions within accepted period
              encounters
            </caption>
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col">Period A</th>
                <th scope="col">Period B</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(periodQuality.A.primaryTimingExclusions).map(
                ([reason, count]) => (
                  <tr key={reason}>
                    <th scope="row">{reason.replaceAll("_", " ")}</th>
                    <td>{count.count}</td>
                    <td>
                      {
                        periodQuality.B.primaryTimingExclusions[
                          reason as keyof typeof periodQuality.A.primaryTimingExclusions
                        ].count
                      }
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p>
          Timestamp completeness measures presence among recorded seen
          encounters, not valid chronology or hospital performance.
        </p>
      </details>
      <details>
        <summary>Record-level diagnostics (nonexclusive)</summary>
        <p>
          Counts may overlap. Logical CSV record 1 is the header. Diagnostics
          include quarantined records.
        </p>
        <p>
          Raw marked-seen records with unusable arrival:{" "}
          {q.rawSeenUnusableArrival.count}.
        </p>
        <div className="diagnostics">
          {Object.entries(q.globalDiagnostics.countsByCode).map(
            ([code, count]) => (
              <details key={code}>
                <summary>
                  {code.replaceAll("_", " ")} · {count.count} records
                </summary>
                <p>Logical records: {count.recordNumbers.join(", ")}</p>
                {Array.from(
                  new Set(
                    q.globalDiagnostics.issues
                      .filter((issue) => issue.code === code)
                      .map(
                        (issue) =>
                          `${issue.severity}: ${issue.message} Effects: ${issue.effects.join(", ")}.`,
                      ),
                  ),
                ).map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </details>
            ),
          )}
          {q.globalDiagnostics.issues.length === 0 && (
            <p>No record diagnostics.</p>
          )}
        </div>
      </details>
      <details id="provenance">
        <summary>Dataset identity, coverage & limitations</summary>
        <dl className="provenance">
          <dt>Source</dt>
          <dd>{report.run.source.name}</dd>
          <dt>Source SHA-256</dt>
          <dd>{report.run.source.sha256}</dd>
          <dt>Run fingerprint</dt>
          <dd>{report.run.configurationFingerprint}</dd>
          <dt>Definitions</dt>
          <dd>FG-DATA-1 · FG-METRIC-1 · FG-DAILY-1</dd>
          <dt>Observation cutoff</dt>
          <dd>
            {report.run.configuration.observationCutoff?.atUtc ??
              "Unknown; provider follow-up is unverified"}
          </dd>
          <dt>Observed arrival span</dt>
          <dd>
            {report.coverage.observedArrivalSpan
              ? `${report.coverage.observedArrivalSpan.earliestArrivalUtc} → ${report.coverage.observedArrivalSpan.latestArrivalUtc}`
              : "No usable arrivals"}
          </dd>
          <dt>Coverage source</dt>
          <dd>
            {report.coverage.metadata.kind === "declared"
              ? `${report.coverage.metadata.provenance.source}: ${report.coverage.metadata.provenance.reference}`
              : "No collection metadata supplied"}
          </dd>
          <dt>Declared temporal coverage</dt>
          <dd>
            A:{" "}
            {report.coverage.declaredTemporalCoverage?.A.displayValue ??
              "Unavailable"}{" "}
            / B:{" "}
            {report.coverage.declaredTemporalCoverage?.B.displayValue ??
              "Unavailable"}{" "}
            {report.coverage.declaredTemporalCoverage &&
              "(percent; declaration only)"}
          </dd>
          <dt>Hospital coverage</dt>
          <dd>Not independently verified</dd>
        </dl>
        <ul>
          {report.limitations.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
