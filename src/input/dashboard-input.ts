import type {
  AnalysisConfiguration,
  ComparisonPeriod,
} from "../core/contracts";
import { parseUtcTimestamp } from "../core/timestamps";

export function sevenDayPeriod<T extends "A" | "B">(
  id: T,
  date: string,
): ComparisonPeriod & { id: T } {
  const startUtc = date + "T00:00:00Z";
  const start = parseUtcTimestamp(startUtc);
  if (start.kind !== "valid")
    throw new Error(`Select a valid start date for period ${id}.`);
  const endUtcExclusive = new Date(start.epochMs + 7 * 86400000).toISOString();
  if (endUtcExclusive.startsWith("+"))
    throw new Error("The seven-day period must end within year 9999.");
  return { id, startUtc, endUtcExclusive };
}

export function selectedConfiguration(
  sha256: string,
  a: string,
  b: string,
  metadata: Pick<AnalysisConfiguration, "coverage" | "observationCutoff">,
): AnalysisConfiguration {
  return {
    ...metadata,
    periods: {
      kind: "explicit",
      origin: "user_selection",
      confirmedForSourceSha256: sha256,
      A: sevenDayPeriod("A", a),
      B: sevenDayPeriod("B", b),
    },
  };
}
