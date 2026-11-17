import type {
  ComparisonPeriod, EncounterValidationResult, InspectedEncounter, MetricContext,
  MetricId, MetricPopulation, MetricResult, MetricUnit, OperationalMetrics, TimingObservation,
} from './contracts';
import { formatNumber } from './format';
import { dailyEncounters } from './daily';

export interface MetricInput {
  readonly id: MetricId;
  readonly period: 'A' | 'B';
  readonly unit: MetricUnit;
  readonly population: MetricPopulation;
  readonly populationRecordNumbers: readonly number[];
  readonly eligibleRecordNumbers: readonly number[];
  readonly excludedRecordNumbers: readonly number[];
  readonly numeratorRecordNumbers: readonly number[] | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly section: string;
  readonly definition: string;
  readonly limitations: readonly string[];
}

/** Shared metadata/formatting; all analytical callers provide unrounded values. */
export function metric(input: MetricInput, value: number | null, unavailableReason = 'No supporting observations.'): MetricResult {
  if (value !== null && !Number.isFinite(value)) throw new RangeError('Nonfinite metric result.');
  const { section, ...base } = input;
  const context: MetricContext = {
    ...base,
    referenceId: `${input.period}.${input.id}.${input.unit}`,
    definitionId: `FG-METRIC-1#${section}`,
    eligibleN: input.eligibleRecordNumbers.length,
    excludedN: input.excludedRecordNumbers.length,
    displayValue: value === null ? null : formatNumber(value, input.unit === 'encounters' ? 0 : 1),
  };
  return value === null
    ? { ...context, status: 'unavailable', value: null, reason: unavailableReason }
    : { ...context, status: input.limitations.length ? 'calculated_with_limitations' : 'calculated', value };
}

/** Medians are over integer milliseconds, preserving the half-ms even-sample mean. */
function medianMilliseconds(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function calculatePeriodMetrics(
  validation: EncounterValidationResult,
  period: ComparisonPeriod,
  limitations: readonly string[],
): OperationalMetrics {
  if (validation.kind !== 'validated' || !validation.cohorts || !validation.quality.periods) {
    throw new Error('Operational metrics require validated, explicitly configured cohorts.');
  }
  const rows = validation.cohorts[period.id];
  const quality = validation.quality.periods[period.id];
  const numbers = (list: readonly InspectedEncounter[]): number[] => list.map(row => row.source.recordNumber);
  const population = numbers(rows);
  const eligibleSet = new Set(quality.timingEligible.recordNumbers);
  const eligible = rows.filter(row => eligibleSet.has(row.source.recordNumber));
  const seen = rows.filter(row => row.recordedStatus === 'seen');
  const durations: TimingObservation[] = eligible.map(row => {
    if (row.arrival.kind !== 'valid' || row.provider.kind !== 'valid') throw new Error('Invalid timing-eligible record.');
    const durationMilliseconds = row.provider.epochMs - row.arrival.epochMs;
    if (!Number.isSafeInteger(durationMilliseconds) || durationMilliseconds < 0) throw new Error('Invalid validated duration.');
    const minutes = durationMilliseconds / 60000;
    return { recordNumber: row.source.recordNumber, durationMilliseconds, minutes, displayMinutes: formatNumber(minutes) };
  });
  if (rows.length !== quality.countable.count ||
      eligible.length + quality.timingExcluded.count !== rows.length ||
      Object.values(quality.primaryTimingExclusions).reduce((n, count) => n + count.count, 0) !== quality.timingExcluded.count) {
    throw new Error('Validation populations do not reconcile.');
  }
  const periodLimits = [...limitations, ...(rows.length === 0 ? ['No countable encounters are represented in this period; this does not establish zero actual encounters.'] : [])];

  function count(id: MetricId, members: readonly number[], definition: string, section: string): MetricResult {
    return metric({
      id, period: period.id, unit: 'encounters', population: 'accepted_period_encounters',
      populationRecordNumbers: population, eligibleRecordNumbers: population, excludedRecordNumbers: [],
      numeratorRecordNumbers: members, numerator: members.length, denominator: rows.length,
      section, definition, limitations: periodLimits,
    }, members.length);
  }

  function percentage(id: MetricId, members: readonly number[], denominatorRows: readonly InspectedEncounter[],
    definition: string, section: string, isSeen = false): MetricResult {
    const denominator = denominatorRows.length;
    const ids = numbers(denominatorRows);
    return metric({
      id, period: period.id, unit: 'percent',
      population: isSeen ? 'recorded_seen_encounters' : 'accepted_period_encounters',
      populationRecordNumbers: ids, eligibleRecordNumbers: ids, excludedRecordNumbers: [],
      numeratorRecordNumbers: members, numerator: members.length, denominator,
      section, definition, limitations: periodLimits,
    }, denominator === 0 ? null : 100 * members.length / denominator, 'The specified denominator population is empty.');
  }

  const statusIds = {
    seen: 'status_seen', not_seen: 'status_not_seen', unknown: 'status_unknown', invalid: 'status_invalid',
  } as const;
  const statuses = Object.fromEntries((['seen', 'not_seen', 'unknown', 'invalid'] as const).map(status => {
    const members = numbers(rows.filter(row => status === 'invalid' ? row.recordedStatus === null : row.recordedStatus === status));
    return [status, {
      count: count(statusIds[status], members, `Count recorded ${status} status within the countable cohort; preserve timestamp conflicts.`, '4'),
      percentage: percentage(statusIds[status], members, rows, `100 × recorded ${status} status count / countable encounters.`, '4'),
    }];
  })) as OperationalMetrics['statuses'];
  if (Object.values(statuses).reduce((sum, item) => sum + item.count.value!, 0) !== rows.length) {
    throw new Error('Status population counts do not reconcile.');
  }
  const medianMs = medianMilliseconds(durations.map(row => row.durationMilliseconds));
  const timingLimits = [...periodLimits,
    'Timing describes eligible recorded seen encounters only; missing or excluded observations may change interpretation.',
    ...(eligible.length === 1 ? ['Median is based on a single eligible observation.'] : []),
    ...(quality.timingExcluded.count > 0 ? ['Timing exclusions are listed by primary reason; additional diagnostic flags can overlap.'] : []),
  ];
  return {
    period: { ...period },
    dailyEncounters: dailyEncounters(validation, period),
    encounterCount: count('encounter_count', population, 'Count accepted unique-ID arrival records inside the selected half-open period; not a verified hospital census.', '3'),
    timingEligibleCount: count('timing_eligible_count', quality.timingEligible.recordNumbers, 'Count timing-eligible records under the approved validation rules.', '6'),
    timingExcludedCount: count('timing_excluded_count', quality.timingExcluded.recordNumbers, 'Countable encounters minus timing-eligible encounters; one primary reason per excluded encounter.', '6'),
    statuses,
    doorToProviderDurations: durations,
    medianDoorToProvider: metric({
      id: 'median_door_to_provider', period: period.id, unit: 'minutes', population: 'timing_eligible_encounters',
      populationRecordNumbers: population, eligibleRecordNumbers: quality.timingEligible.recordNumbers,
      excludedRecordNumbers: quality.timingExcluded.recordNumbers, numeratorRecordNumbers: null,
      numerator: null, denominator: eligible.length, section: '5',
      definition: 'Median of valid (provider − arrival) integer-millisecond durations, then divided by 60,000. Even samples use the mean of the central two.',
      limitations: timingLimits,
    }, medianMs === null ? null : medianMs / 60000, 'No timing-eligible observations in this period.'),
    timingEligibility: percentage('timing_eligibility', quality.timingEligible.recordNumbers, rows, '100 × timing-eligible encounters / countable encounters.', '6'),
    seenProviderCompleteness: percentage('seen_provider_completeness', quality.seenProviderPopulated.recordNumbers, seen, '100 × populated provider fields / recorded seen encounters. Presence does not imply validity.', '7', true),
    seenProviderParseValidity: percentage('seen_provider_parse_validity', quality.seenProviderParseValid.recordNumbers, seen, '100 × parse-valid provider timestamps / recorded seen encounters. Chronology/cutoff validity remains separate.', '7', true),
    seenTimingEligibility: percentage('seen_timing_eligibility', quality.timingEligible.recordNumbers, seen, '100 × timing-eligible encounters / recorded seen encounters.', '7', true),
  };
}

export function operationalMetricList(metrics: OperationalMetrics): readonly MetricResult[] {
  return [
    metrics.encounterCount, metrics.timingEligibleCount, metrics.timingExcludedCount, metrics.medianDoorToProvider,
    ...Object.values(metrics.statuses).flatMap(status => [status.count, status.percentage]),
    metrics.timingEligibility, metrics.seenProviderCompleteness, metrics.seenProviderParseValidity, metrics.seenTimingEligibility,
  ];
}
