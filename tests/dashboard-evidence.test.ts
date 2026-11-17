import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/core/analyze";
import { dashboardSummary } from "../src/core/dashboard-summary";
import { dailyEncounters } from "../src/core/daily";
import { validateEncounters } from "../src/core/validate";
import {
  selectedConfiguration,
  sevenDayPeriod,
} from "../src/input/dashboard-input";
import { parseCsv } from "../src/input/parse-csv";
import { verifySynthetic } from "../src/synthetic/generate";
import { calculated, encounter, prepare, reportFor } from "./helpers/analysis";
import {
  explicitConfiguration,
  fixtureCases,
  primaryRecords,
} from "./fixtures/cases";

describe("FG-DAILY-1 and combined dashboard evidence", () => {
  it("reconciles the original saved synthetic artifacts and exact dashboard indicators", async () => {
    const csv = new Uint8Array(
      await readFile("data/synthetic/flowguard-paired-wait-shift-v1.csv"),
    );
    const manifest = new Uint8Array(
      await readFile(
        "data/synthetic/flowguard-paired-wait-shift-v1.manifest.json",
      ),
    );
    const configuration = await verifySynthetic(csv, manifest);
    const input = await parseCsv(csv);
    if (input.kind !== "parsed") throw new Error("Invalid fixture");
    const report = calculated(await analyze(input, configuration));
    expect(dashboardSummary(report)).toMatchObject({
      encounters: 1400,
      eligible: 1190,
      excluded: 210,
      seen: 1190,
      populated: 1190,
      eligibility: 85,
      completeness: 100,
    });
    expect(report.metrics.A.medianDoorToProvider.value).toBe(70);
    expect(report.metrics.B.medianDoorToProvider.value).toBe(80);
    expect(
      report.comparisons.find(
        (item) => item.metricId === "median_door_to_provider",
      )?.absoluteDifference.value,
    ).toBe(10);
    for (const id of ["A", "B"] as const) {
      expect(
        report.metrics[id].dailyEncounters.days.map((day) => day.count),
      ).toEqual([100, 100, 100, 100, 100, 100, 100]);
      expect(report.metrics[id].timingEligibleCount.value).toBe(595);
    }
  });
  it("retains provider-defective arrivals, midnight boundaries and zero supplied-record days", async () => {
    const report = calculated(
      await reportFor([
        encounter("a", "2026-10-05T00:00:00Z", ""),
        encounter("b", "2026-10-05T23:59:59.999Z", "malformed"),
        encounter("c", "2026-10-06T00:00:00Z", "", "unknown"),
        encounter("d", "2026-10-12T00:00:00Z", "", "not_seen"),
        encounter("outside", "2026-10-19T00:00:00Z", ""),
      ]),
    );
    expect(
      report.metrics.A.dailyEncounters.days.map((day) => day.count),
    ).toEqual([2, 1, 0, 0, 0, 0, 0]);
    expect(
      report.metrics.B.dailyEncounters.days.map((day) => day.count),
    ).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(report.metrics.A.dailyEncounters.days[0]?.recordNumbers).toEqual([
      2, 3,
    ]);
    expect(report.metrics.A.dailyEncounters.days[0]?.endUtcExclusive).toBe(
      "2026-10-06T00:00:00.000Z",
    );
    expect(report.metrics.A.dailyEncounters.limitation).toContain("unverified");
  });
  it.each(fixtureCases)(
    "daily counts reconcile with accepted cohorts: $id",
    async (fixture) => {
      const report = await reportFor(fixture.records, fixture.configuration);
      if (report.metrics === null) {
        expect(report.status).toBe("blocked_by_file_or_configuration_error");
        return;
      }
      for (const period of Object.values(report.metrics)) {
        const ids = period.dailyEncounters.days.flatMap(
          (day) => day.recordNumbers,
        );
        expect(ids.length).toBe(period.encounterCount.value);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual(
          [...period.encounterCount.populationRecordNumbers].sort(),
        );
        expect(period.dailyEncounters.days).toHaveLength(7);
      }
    },
  );
  it("excludes duplicate groups even when the other member is outside the selected period", async () => {
    const report = calculated(
      await reportFor([
        encounter("duplicate", "2026-10-05T00:00:00Z", ""),
        encounter("duplicate", "2026-10-25T00:00:00Z", ""),
        encounter("badArrival", "bad", ""),
        encounter("bad id", "2026-10-05T00:00:00Z", ""),
        encounter("cutoff", "2026-10-21T00:00:00Z", ""),
      ]),
    );
    expect(
      report.metrics.A.dailyEncounters.days.map((day) => day.count),
    ).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(dashboardSummary(report)).toMatchObject({
      encounters: 0,
      eligibility: null,
      completeness: null,
    });
  });
  it("weights combined rates using populations rather than averaging rates", async () => {
    const report = calculated(await reportFor(primaryRecords.slice(0, 7)));
    expect(dashboardSummary(report)).toMatchObject({
      encounters: 7,
      eligible: 5,
      excluded: 2,
      eligibility: 500 / 7,
      completeness: 100,
    });
  });
  it("preserves unavailable combined rates for a header-only source", async () => {
    expect(dashboardSummary(calculated(await reportFor([])))).toMatchObject({
      encounters: 0,
      eligibility: null,
      completeness: null,
      eligibilityDisplay: "Unavailable",
      completenessDisplay: "Unavailable",
    });
  });
  it("blocks daily series without explicitly validated period cohorts", async () => {
    const { input } = await prepare(primaryRecords);
    const validation = validateEncounters(input, {
      ...explicitConfiguration,
      periods: { kind: "unselected" },
    });
    expect(() =>
      dailyEncounters(validation, explicitConfiguration.periods.A),
    ).toThrow("validated");
  });
  it("daily numerical results are invariant under row reversal", async () => {
    const first = calculated(await reportFor(primaryRecords));
    const reverse = calculated(await reportFor([...primaryRecords].reverse()));
    expect(
      reverse.metrics.A.dailyEncounters.days.map((day) => day.count),
    ).toEqual(first.metrics.A.dailyEncounters.days.map((day) => day.count));
  });
});

describe("explicit dashboard period configuration", () => {
  it("uses seven UTC days across leap-day and year boundaries", () => {
    expect(sevenDayPeriod("A", "2024-02-26").endUtcExclusive).toBe(
      "2024-03-04T00:00:00.000Z",
    );
    expect(sevenDayPeriod("B", "2026-12-28").endUtcExclusive).toBe(
      "2027-01-04T00:00:00.000Z",
    );
  });
  it.each(["", "2026-02-30", "2026-1-1", "9999-12-31"])(
    "rejects invalid date %s",
    (date) => {
      expect(() => sevenDayPeriod("A", date)).toThrow();
    },
  );
  it("binds explicit dates to the current source and preserves unknown metadata", () => {
    const config = selectedConfiguration(
      "a".repeat(64),
      "2026-10-05",
      "2026-10-12",
      { coverage: { kind: "unverified" }, observationCutoff: null },
    );
    expect(config.periods).toMatchObject({
      confirmedForSourceSha256: "a".repeat(64),
      origin: "user_selection",
    });
    expect(config.coverage.kind).toBe("unverified");
    expect(config.observationCutoff).toBeNull();
  });
});
