import type { CalculatedEvidenceReport } from "./contracts";
import { formatNumber } from "./format";

/** Combined selected-period evidence. No median pooling or averaging of percentages. */
export function dashboardSummary(report: CalculatedEvidenceReport) {
  const periods = report.quality.periods;
  if (!periods) throw new Error("Calculated evidence requires period quality.");
  const encounters = periods.A.countable.count + periods.B.countable.count;
  const eligible =
    periods.A.timingEligible.count + periods.B.timingEligible.count;
  const excluded =
    periods.A.timingExcluded.count + periods.B.timingExcluded.count;
  const seen = periods.A.recordedSeen.count + periods.B.recordedSeen.count;
  const populated =
    periods.A.seenProviderPopulated.count +
    periods.B.seenProviderPopulated.count;
  const ratio = (n: number, d: number) => (d === 0 ? null : (100 * n) / d);
  const eligibility = ratio(eligible, encounters);
  const completeness = ratio(populated, seen);
  return {
    encounters,
    eligible,
    excluded,
    seen,
    populated,
    eligibility,
    completeness,
    eligibilityDisplay:
      eligibility === null ? "Unavailable" : formatNumber(eligibility) + "%",
    completenessDisplay:
      completeness === null ? "Unavailable" : formatNumber(completeness) + "%",
  };
}
