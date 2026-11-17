"use client";
import { useState } from "react";
import { Icon } from "./icon";
import type { CalculatedEvidenceReport } from "../core/contracts";

export function EvidenceChart({
  report,
}: {
  report: CalculatedEvidenceReport;
}) {
  const [mode, setMode] = useState<"median" | "daily">("median");
  const [selected, setSelected] = useState(
    "Select a plotted value to inspect its evidence.",
  );
  const { A, B } = report.metrics;
  const maximum = Math.max(
    A.medianDoorToProvider.value ?? 0,
    B.medianDoorToProvider.value ?? 0,
    1,
  );
  const axisMax = Math.ceil(maximum * 1.2 / 20) * 20;
  function inspectPeriod(id: "A" | "B") {
    const metric = report.metrics[id].medianDoorToProvider;
    setSelected(`Period ${id}: ${metric.displayValue ?? "unavailable"} minutes; ${metric.denominator} eligible encounters.`);
  }
  const dailyMax = Math.max(
    1,
    ...A.dailyEncounters.days.map((day) => day.count),
    ...B.dailyEncounters.days.map((day) => day.count),
  );
  function periodPlot(narrow: boolean) {
    return (
        <svg className={`period-plot ${narrow ? "mobile-plot" : "desktop-plot"}`} viewBox={narrow ? "0 0 370 185" : "0 0 740 170"} aria-label="Two period medians, not a daily trend">
          {[0, 1, 2, 3, 4].map(tick => {
            const y = 132 - tick * 29;
            return <g key={tick}>
              <line x1={narrow ? 43 : 60} x2={narrow ? 356 : 715} y1={y} y2={y} stroke="#e4eaf4" />
              <text x={narrow ? 34 : 48} y={y + 5} textAnchor="end" className="plot-tick">{axisMax * tick / 4}</text>
            </g>;
          })}
          <text transform="translate(15 82) rotate(-90)" textAnchor="middle" className="plot-axis">Minutes</text>
          <line x1={narrow ? 43 : 60} x2={narrow ? 43 : 60} y1="16" y2="132" stroke="#bdcbe0" />
          {A.medianDoorToProvider.value !== null && B.medianDoorToProvider.value !== null && (
            <line x1={narrow ? 125 : 205} x2={narrow ? 280 : 565}
              y1={132 - A.medianDoorToProvider.value / axisMax * 116}
              y2={132 - B.medianDoorToProvider.value / axisMax * 116}
              stroke="#a28ade" strokeWidth="2.5" strokeDasharray="6 6" />
          )}
          {(["A", "B"] as const).map((id, index) => {
            const metric = report.metrics[id].medianDoorToProvider;
            const x = narrow ? 125 + index * 155 : 205 + index * 360;
            const y = metric.value === null ? 80 : 132 - metric.value / axisMax * 116;
            return <g key={id}>
              <g role="button" tabIndex={0} className={`plot-point ${id}`}
                aria-label={`Inspect Period ${id} median: ${metric.displayValue ?? "unavailable"} minutes`}
                onClick={() => inspectPeriod(id)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspectPeriod(id); } }}>
                <rect x={x - 60} y={y - 52} width="120" height="104" rx="8" fill="transparent" />
                {metric.value !== null && <circle cx={x} cy={y} r="6" fill="white" stroke="currentColor" strokeWidth="3" />}
                <rect x={x - 49} y={y - 39} width="98" height="27" rx="7" fill="currentColor" />
                <text x={x} y={y - 20} textAnchor="middle" fill="white" className="plot-value">{metric.displayValue ?? "Unavailable"}{metric.value !== null ? " min" : ""}</text>
              </g>
              <text x={x} y="157" textAnchor="middle" className="plot-axis">
                {narrow ? <><tspan x={x}>Period {id}</tspan><tspan x={x} dy="18">{report.metrics[id].period.startUtc.slice(0, 10)}</tspan></> : `Period ${id} · ${report.metrics[id].period.startUtc.slice(0, 10)}`}
              </text>
            </g>;
          })}
        </svg>
    );
  }
  return (
    <section
      className="panel chart-panel"
      id="comparison"
      aria-labelledby="chart-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="chart-title">
            <Icon name="trend" size={30} />
            {mode === "median"
              ? "Door to Provider Time"
              : "Daily encounter counts"}
          </h2>
        </div>
      <div className="chart-legend">
        <span>
          <i className="dot a" />
          Baseline period ({A.encounterCount.displayValue} encounters)
        </span>
        <span>
          <i className="dot b" />
          Comparison period ({B.encounterCount.displayValue} encounters)
        </span>
      </div>
      </div>
      {mode === "median" ? (
        <div className="period-plot-wrap">{periodPlot(false)}{periodPlot(true)}</div>
      ) : (
        <div className="daily-chart" role="region" aria-label="Daily encounter chart" tabIndex={0}>
          {A.dailyEncounters.days.map((day, index) => (
            <div className="day-group" key={day.startUtc}>
              <div className="day-bars">
                {(["A", "B"] as const).map((id) => {
                  const item = report.metrics[id].dailyEncounters.days[index]!;
                  return (
                    <button
                      key={id}
                      className={`day-bar ${id}`}
                      aria-label={`${id}, ${item.startUtc.slice(0, 10)}: ${item.count} supplied encounters`}
                      onClick={() =>
                        setSelected(
                          `Period ${id} · ${item.startUtc.slice(0, 10)} UTC: ${item.count} accepted supplied encounters. Hospital capture is unverified.`,
                        )
                      }
                    >
                      <span className="day-fill" style={{ height: `${Math.max(2, (item.count / dailyMax) * 100)}%` }}>
                        <span>{item.count}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <small>Day {index + 1}</small>
            </div>
          ))}
        </div>
      )}
      {mode === "daily" && <p className="daily-scroll-hint">Scroll the chart for all seven days, or open the data table.</p>}
      <div className="chart-tools">
        <span className="chart-disclosure">{mode === "median" ? "Period medians · no daily trend" : "Daily supplied encounters"}</span>
        <div className="segmented" aria-label="Visualization">
          <button
            aria-pressed={mode === "median"}
            onClick={() => {
              setMode("median");
              setSelected("Select a bar to inspect its evidence.");
            }}
          >
            Median wait
          </button>
          <button
            aria-pressed={mode === "daily"}
            onClick={() => {
              setMode("daily");
              setSelected("Select a bar to inspect its evidence.");
            }}
          >
            Daily counts
          </button>
        </div>
      <p className={`chart-inspection ${selected.startsWith("Select") ? "sr-only" : ""}`} role="status">
        {selected}
      </p>
      <details>
        <summary>View accessible data table</summary>
        <div className="table-scroll" role="region" aria-label="Chart data table" tabIndex={0}>
          <table>
            <caption>
              {mode === "median"
                ? "Period-level timing evidence"
                : "Daily supplied encounter counts (UTC)"}
            </caption>
            <thead>
              <tr>
                {(mode === "median"
                  ? [
                      "Period",
                      "Median (min)",
                      "Eligible",
                      "Eligibility",
                      "Seen completeness",
                    ]
                  : ["Period", "UTC date", "Count"]
                ).map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mode === "median"
                ? (["A", "B"] as const).map((id) => {
                    const m = report.metrics[id];
                    return (
                      <tr key={id}>
                        <th scope="row">{id}</th>
                        <td>
                          {m.medianDoorToProvider.displayValue ?? "Unavailable"}
                        </td>
                        <td>{m.timingEligibleCount.displayValue}</td>
                        <td>
                          {m.timingEligibility.displayValue === null ? "Unavailable" : `${m.timingEligibility.displayValue}%`}
                        </td>
                        <td>
                          {m.seenProviderCompleteness.displayValue === null ? "Unavailable" : `${m.seenProviderCompleteness.displayValue}%`}
                        </td>
                      </tr>
                    );
                  })
                : (["A", "B"] as const).flatMap((id) =>
                    report.metrics[id].dailyEncounters.days.map((day) => (
                      <tr key={id + day.startUtc}>
                        <th scope="row">{id}</th>
                        <td>{day.startUtc.slice(0, 10)}</td>
                        <td>{day.count}</td>
                      </tr>
                    )),
                  )}
            </tbody>
          </table>
        </div>
      </details>
      </div>
      <p className="footnote sr-only">
        {mode === "daily"
          ? A.dailyEncounters.limitation
          : "Descriptive comparison only. Timing eligibility and source coverage affect interpretation."}
      </p>
    </section>
  );
}
