import type { ComparisonPeriod, EncounterValidationResult } from "./contracts";

export interface DailyEncounterCount {
  readonly startUtc: string;
  readonly endUtcExclusive: string;
  readonly count: number;
  readonly recordNumbers: readonly number[];
}
export interface DailySeries {
  readonly specification: "FG-DAILY-1";
  readonly population: "accepted_period_encounters";
  readonly limitation: string;
  readonly days: readonly DailyEncounterCount[];
}

export function dailyEncounters(
  validation: EncounterValidationResult,
  period: ComparisonPeriod,
): DailySeries {
  if (validation.kind !== "validated" || !validation.cohorts)
    throw new Error("Daily counts require validated cohorts.");
  const start = Date.parse(period.startUtc);
  const rows = validation.cohorts[period.id];
  const days = Array.from({ length: 7 }, (_, day) => {
    const lower = start + day * 86400000;
    const upper = lower + 86400000;
    const recordNumbers = rows
      .filter(
        (row) =>
          row.arrival.kind === "valid" &&
          row.arrival.epochMs >= lower &&
          row.arrival.epochMs < upper,
      )
      .map((row) => row.source.recordNumber);
    return {
      startUtc: new Date(lower).toISOString(),
      endUtcExclusive: new Date(upper).toISOString(),
      count: recordNumbers.length,
      recordNumbers,
    };
  });
  if (days.reduce((sum, day) => sum + day.count, 0) !== rows.length)
    throw new Error("Daily counts do not reconcile.");
  return {
    specification: "FG-DAILY-1",
    population: "accepted_period_encounters",
    days,
    limitation:
      "Zero means no accepted supplied records on that UTC date; hospital activity and collection completeness remain unverified.",
  };
}
