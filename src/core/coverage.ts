import type { AnalysisConfiguration, CoverageEvidence, EncounterValidationResult, MetricResult, PeriodId } from './contracts';
import { metric } from './metrics';
import { parseUtcTimestamp } from './timestamps';

export function coverageEvidence(validation: EncounterValidationResult, config: AnalysisConfiguration): CoverageEvidence {
  const arrivals = (validation.accepted ?? []).flatMap(row =>
    row.arrival.kind === 'valid' ? [row.arrival.epochMs] : []);
  // Observed span uses identity/arrival-accepted records, including outside-period records.
  const observedArrivalSpan = arrivals.length === 0 ? null : {
    earliestArrivalUtc: new Date(Math.min(...arrivals)).toISOString(),
    latestArrivalUtc: new Date(Math.max(...arrivals)).toISOString(),
  };
  const metadata = structuredClone(config.coverage);
  const common = ['Observed date span does not prove continuous collection or complete encounter capture.'];
  if (metadata.kind === 'unverified') {
    return { metadata, observedArrivalSpan, independentlyVerifiedHospitalCoverage: false,
      declaredTemporalCoverage: null, limitations: ['Collection coverage is unverified; period comparability is not established.', ...common] };
  }
  const limitations = [
    'Collection coverage is source-declared, not independently verified hospital coverage.',
    'Declared temporal coverage does not prove encounter capture completeness or sufficient outcome follow-up.',
    ...common,
  ];
  if (validation.kind !== 'validated' || config.periods.kind !== 'explicit') {
    return { metadata, observedArrivalSpan, independentlyVerifiedHospitalCoverage: false, declaredTemporalCoverage: null, limitations };
  }
  const intervals: { start: number; end: number }[] = [];
  let invalid = !metadata.provenance.reference.trim();
  for (const interval of metadata.intervals) {
    const start = parseUtcTimestamp(interval.startUtc), end = parseUtcTimestamp(interval.endUtcExclusive);
    if (start.kind !== 'valid' || end.kind !== 'valid' || end.epochMs <= start.epochMs) invalid = true;
    else intervals.push({ start: start.epochMs, end: end.epochMs });
  }
  if (invalid) limitations.push('Declared coverage contains an invalid interval or lacks attribution; its duration is unavailable, not partially calculated.');
  const result = {} as Record<PeriodId, MetricResult>;
  for (const id of ['A', 'B'] as const) {
    const period = config.periods[id];
    const start = parseUtcTimestamp(period.startUtc), end = parseUtcTimestamp(period.endUtcExclusive);
    if (start.kind !== 'valid' || end.kind !== 'valid') throw new Error('Validated period bounds unavailable.');
    const clipped = intervals.map(interval => ({ start: Math.max(interval.start, start.epochMs), end: Math.min(interval.end, end.epochMs) }))
      .filter(interval => interval.end > interval.start).sort((a, b) => a.start - b.start);
    let totalMs = 0, currentStart: number | null = null, currentEnd = 0;
    for (const interval of clipped) {
      if (currentStart === null) { currentStart = interval.start; currentEnd = interval.end; }
      else if (interval.start <= currentEnd) currentEnd = Math.max(currentEnd, interval.end);
      else { totalMs += currentEnd - currentStart; currentStart = interval.start; currentEnd = interval.end; }
    }
    if (currentStart !== null) totalMs += currentEnd - currentStart;
    const hours = totalMs / 3600000;
    result[id] = metric({
      id: 'declared_temporal_coverage', period: id, unit: 'percent', population: 'declared_collection_intervals',
      populationRecordNumbers: [], eligibleRecordNumbers: [], excludedRecordNumbers: [], numeratorRecordNumbers: null,
      numerator: invalid ? null : hours, denominator: 168,
      section: '10', definition: '100 × hours in the union of source-declared intervals clipped to the period / 168 hours. This is not independently verified encounter coverage.',
      limitations,
    }, invalid ? null : 100 * totalMs / (end.epochMs - start.epochMs), 'Invalid or unattributed collection-interval declaration.');
    if (!invalid && totalMs < end.epochMs - start.epochMs) {
      limitations.push(`Period ${id} has only partial declared temporal coverage; no extrapolation is performed.`);
    }
  }
  return { metadata, observedArrivalSpan, independentlyVerifiedHospitalCoverage: false, declaredTemporalCoverage: result, limitations };
}
