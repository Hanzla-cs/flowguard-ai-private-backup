import type { DifferenceValue, MetricComparison, MetricResult, OperationalMetrics } from './contracts';
import { formatNumber } from './format';
import { operationalMetricList } from './metrics';

function available(value: number, places: 0 | 1): DifferenceValue {
  if (!Number.isFinite(value)) throw new RangeError('Nonfinite comparison result.');
  return { status: 'calculated_with_limitations', value, displayValue: formatNumber(value, places) };
}
function unavailable(reason: string): DifferenceValue {
  return { status: 'unavailable', value: null, displayValue: null, reason };
}

export function compareMetric(a: MetricResult, b: MetricResult): MetricComparison {
  if (a.id !== b.id || a.unit !== b.unit || a.period !== 'A' || b.period !== 'B') {
    throw new Error('Comparisons require matching A/B metric definitions and units.');
  }
  const isRate = a.unit === 'percent';
  const difference = a.value === null || b.value === null ? unavailable('One or both period values are unavailable.') :
    available(b.value - a.value, a.unit === 'encounters' ? 0 : 1);
  const relative = isRate ? null :
    a.value === null || b.value === null ? unavailable('One or both period values are unavailable.') :
      a.value === 0 ? unavailable('Relative change is undefined for a zero baseline.') :
        available(100 * (b.value - a.value) / a.value, 1);
  return {
    metricId: a.id, interpretation: 'descriptive_only', baselinePeriod: 'A', comparisonPeriod: 'B',
    sourceMetricIds: [a.referenceId, b.referenceId],
    baselineSampleSize: a.eligibleN, comparisonSampleSize: b.eligibleN,
    baselineDenominator: a.denominator, comparisonDenominator: b.denominator,
    absoluteUnit: isRate ? 'percentage_points' : a.unit,
    absoluteDifference: difference, relativePercentageDifference: relative,
    percentagePointDifference: isRate ? difference : null,
    limitations: [...new Set([
      ...a.limitations, ...b.limitations,
      'Differences describe the supplied records, not independently verified hospital performance.',
      'A lower median does not establish operational improvement; inspect timing eligibility and seen timestamp completeness.',
    ])],
  };
}

export function comparePeriods(a: OperationalMetrics, b: OperationalMetrics): readonly MetricComparison[] {
  const right = new Map(operationalMetricList(b).map(item => [item.id + ':' + item.unit, item]));
  return operationalMetricList(a).map(left => {
    const match = right.get(left.id + ':' + left.unit);
    if (!match) throw new Error('Comparison metric is missing from period B.');
    return compareMetric(left, match);
  });
}
