import { describe, expect, it } from 'vitest';
import type { AnalysisConfiguration } from '../src/core/contracts';
import { analyze } from '../src/core/analyze';
import { compareMetric } from '../src/core/compare';
import { operationalMetricList } from '../src/core/metrics';
import { explicitConfiguration, primaryRecords } from './fixtures/cases';
import { calculated, encounter, prepare, reportFor, assertFiniteTree } from './helpers/analysis';

describe('descriptive comparisons from unrounded metrics', () => {
  it('returns the approved -10 minute / -40% comparison with source references and sample sizes', async () => {
    const report = calculated(await reportFor(primaryRecords));
    const comparison = report.comparisons.find(item => item.metricId === 'median_door_to_provider')!;
    expect(comparison.absoluteDifference.value).toBe(-10);
    expect(comparison.absoluteDifference.displayValue).toBe('-10.0');
    expect(comparison.relativePercentageDifference?.value).toBe(-40);
    expect(comparison.relativePercentageDifference?.displayValue).toBe('-40.0');
    expect(comparison.baselineSampleSize).toBe(4);
    expect(comparison.comparisonSampleSize).toBe(2);
    expect(comparison.baselineDenominator).toBe(4);
    expect(comparison.comparisonDenominator).toBe(2);
    expect(comparison.sourceMetricIds).toEqual([
      report.metrics.A.medianDoorToProvider.referenceId, report.metrics.B.medianDoorToProvider.referenceId,
    ]);
    expect(comparison.interpretation).toBe('descriptive_only');
    expect(report.interpretation).toBe('descriptive_only');
    expect(comparison.limitations.join(' ')).toContain('does not establish operational improvement');
    expect('riskLevel' in report).toBe(false);
    expect('improved' in comparison).toBe(false);
    expect('aiExplanation' in report).toBe(false);
  });

  it('uses percentage points for rates, distinct from relative change', async () => {
    const report = calculated(await reportFor(primaryRecords));
    const eligibility = report.comparisons.find(item => item.metricId === 'timing_eligibility')!;
    const completeness = report.comparisons.find(item => item.metricId === 'seen_provider_completeness')!;
    expect(eligibility.absoluteUnit).toBe('percentage_points');
    expect(eligibility.percentagePointDifference?.value).toBeCloseTo(-100 / 3, 9);
    expect(eligibility.absoluteDifference.displayValue).toBe('-33.3');
    expect(eligibility.relativePercentageDifference).toBeNull();
    expect(completeness.percentagePointDifference?.value).toBe(-25);
    expect(completeness.baselineDenominator).toBe(4);
    expect(completeness.comparisonDenominator).toBe(4);
  });

  it('does not compare rounded card values', async () => {
    const report = calculated(await reportFor([
      encounter('a', '2026-10-05T12:00:00Z', '2026-10-05T12:01:08.400Z'),
      encounter('b', '2026-10-12T12:00:00Z', '2026-10-12T12:01:09Z'),
    ]));
    expect(report.metrics.A.medianDoorToProvider.value).toBe(1.14);
    expect(report.metrics.A.medianDoorToProvider.displayValue).toBe('1.1');
    expect(report.metrics.B.medianDoorToProvider.value).toBe(1.15);
    expect(report.metrics.B.medianDoorToProvider.displayValue).toBe('1.2');
    const difference = report.comparisons.find(item => item.metricId === 'median_door_to_provider')!;
    expect(difference.absoluteDifference.value).toBeCloseTo(0.01, 9);
    expect(difference.absoluteDifference.displayValue).toBe('0.0');
    expect(difference.relativePercentageDifference?.value).toBeCloseTo(50 / 57, 9);
    expect(difference.relativePercentageDifference?.displayValue).toBe('0.9');
  });

  it('keeps absolute change but makes relative change unavailable for zero baseline', async () => {
    const report = calculated(await reportFor([
      encounter('a', '2026-10-05T12:00:00Z', '2026-10-05T12:00:00Z'),
      encounter('b', '2026-10-12T12:00:00Z', '2026-10-12T12:10:00Z'),
    ]));
    const difference = report.comparisons.find(item => item.metricId === 'median_door_to_provider')!;
    expect(difference.absoluteDifference.value).toBe(10);
    expect(difference.relativePercentageDifference?.status).toBe('unavailable');
    expect(difference.relativePercentageDifference?.value).toBeNull();
    assertFiniteTree(report);
  });

  it('makes both median differences unavailable when either period lacks eligible timings', async () => {
    const report = calculated(await reportFor([encounter('a', '2026-10-05T12:00:00Z', '', 'not_seen')]));
    const median = report.comparisons.find(item => item.metricId === 'median_door_to_provider')!;
    expect(median.absoluteDifference.value).toBeNull();
    expect(median.relativePercentageDifference?.value).toBeNull();
    const volume = report.comparisons.find(item => item.metricId === 'encounter_count')!;
    expect(volume.absoluteDifference.value).toBe(-1);
    expect(volume.relativePercentageDifference?.value).toBe(-100);
    assertFiniteTree(report);
  });

  it('keeps zero-versus-zero counts defined while their relative changes remain unavailable', async () => {
    const report = calculated(await reportFor([]));
    const volume = report.comparisons.find(item => item.metricId === 'encounter_count')!;
    expect(volume.absoluteDifference.value).toBe(0);
    expect(volume.relativePercentageDifference?.value).toBeNull();
    expect(report.metrics.A.timingEligibility.status).toBe('unavailable');
    assertFiniteTree(report);
  });

  it('refuses mismatched metric definitions, units or period roles', async () => {
    const report = calculated(await reportFor(primaryRecords));
    expect(() => compareMetric(report.metrics.A.encounterCount, report.metrics.B.medianDoorToProvider)).toThrow();
    expect(() => compareMetric(report.metrics.B.encounterCount, report.metrics.A.encounterCount)).toThrow();
    expect(() => compareMetric(report.metrics.A.statuses.seen.count, report.metrics.B.statuses.seen.percentage)).toThrow();
  });
});

describe('coverage evidence and limitations', () => {
  const row = encounter('a', '2026-10-05T12:00:00Z', '2026-10-05T12:10:00Z');
  function declared(intervals: readonly { startUtc: string; endUtcExclusive: string }[]): AnalysisConfiguration {
    return { ...explicitConfiguration, coverage: {
      kind: 'declared', intervals, encounterCapture: 'declared_complete',
      provenance: { source: 'uploader', reference: 'Fictional self declaration' }, syntheticReproduction: 'not_applicable',
    } };
  }
  it('does not infer coverage from an observed span', async () => {
    const report = calculated(await reportFor(primaryRecords));
    expect(report.coverage.metadata.kind).toBe('unverified');
    expect(report.coverage.declaredTemporalCoverage).toBeNull();
    expect(report.coverage.independentlyVerifiedHospitalCoverage).toBe(false);
    expect(report.coverage.observedArrivalSpan).toEqual({
      earliestArrivalUtc: '2026-10-05T12:00:00.000Z', latestArrivalUtc: '2026-10-12T12:00:00.000Z',
    });
    expect(report.coverage.limitations.join(' ')).toContain('comparability is not established');
  });

  it('merges overlapping intervals, clips to periods and preserves raw counts without extrapolation', async () => {
    const report = calculated(await reportFor([row], declared([
      { startUtc: '2026-10-04T00:00:00Z', endUtcExclusive: '2026-10-07T00:00:00Z' },
      { startUtc: '2026-10-06T00:00:00Z', endUtcExclusive: '2026-10-08T00:00:00Z' },
    ])));
    const a = report.coverage.declaredTemporalCoverage!.A;
    expect(a.numerator).toBe(72);
    expect(a.denominator).toBe(168);
    expect(a.value).toBeCloseTo(300 / 7, 9);
    expect(a.displayValue).toBe('42.9');
    expect(report.coverage.declaredTemporalCoverage!.B.value).toBe(0);
    expect(report.metrics.A.encounterCount.value).toBe(1);
    expect(report.coverage.limitations.join(' ')).toContain('partial declared temporal coverage');
    expect(report.coverage.independentlyVerifiedHospitalCoverage).toBe(false);
  });

  it('handles disjoint and adjacent declared intervals without double counting', async () => {
    const report = calculated(await reportFor([row], declared([
      { startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-06T00:00:00Z' },
      { startUtc: '2026-10-06T00:00:00Z', endUtcExclusive: '2026-10-07T00:00:00Z' },
      { startUtc: '2026-10-09T00:00:00Z', endUtcExclusive: '2026-10-10T00:00:00Z' },
    ])));
    expect(report.coverage.declaredTemporalCoverage!.A.numerator).toBe(72);
  });

  it('can calculate 100% declared temporal coverage without asserting independently verified capture', async () => {
    const report = calculated(await reportFor([row], declared([
      { startUtc: '2026-10-01T00:00:00Z', endUtcExclusive: '2026-11-01T00:00:00Z' },
    ])));
    expect(report.coverage.declaredTemporalCoverage!.A.value).toBe(100);
    expect(report.coverage.declaredTemporalCoverage!.B.value).toBe(100);
    expect(report.coverage.independentlyVerifiedHospitalCoverage).toBe(false);
    expect(report.coverage.limitations.join(' ')).toContain('not independently verified');
    expect(report.limitations.join(' ')).toContain('outcome completeness');
  });

  it.each([
    { startUtc: 'bad', endUtcExclusive: '2026-10-08T00:00:00Z' },
    { startUtc: '2026-10-08T00:00:00Z', endUtcExclusive: '2026-10-05T00:00:00Z' },
    { startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-05T00:00:00Z' },
  ])('returns unavailable coverage for invalid declarations without discarding valid encounter metrics (%j)', async invalid => {
    const report = calculated(await reportFor([row], declared([
      { startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-08T00:00:00Z' }, invalid,
    ])));
    expect(report.metrics.A.encounterCount.value).toBe(1);
    expect(report.coverage.declaredTemporalCoverage!.A.status).toBe('unavailable');
    expect(report.coverage.declaredTemporalCoverage!.A.value).toBeNull();
    expect(report.coverage.declaredTemporalCoverage!.A.numerator).toBeNull();
    assertFiniteTree(report);
  });

  it('keeps unknown observation cutoff explicit rather than inferring follow-up completeness', async () => {
    const report = calculated(await reportFor([row], { ...explicitConfiguration, observationCutoff: null }));
    expect(report.limitations.join(' ')).toContain('Observation cutoff is unknown');
  });
});

describe('single analytical entry point and structured evidence', () => {
  it('returns only blocked evidence when periods are unselected or stale', async () => {
    const unselected = await reportFor(primaryRecords, { ...explicitConfiguration, periods: { kind: 'unselected' } });
    expect(unselected.status).toBe('blocked_by_file_or_configuration_error');
    expect(unselected.metrics).toBeNull();
    expect(unselected.comparisons).toBeNull();
    expect(unselected.validationSummary.accepted).toBe(12);
    const prepared = await prepare(primaryRecords);
    const stale = await analyze(prepared.input, explicitConfiguration);
    expect(stale.status).toBe('blocked_by_file_or_configuration_error');
    expect(stale.metrics).toBeNull();
    assertFiniteTree(stale);
  });

  it('returns unavailable accounting and no metrics for invalid cutoff configuration', async () => {
    const report = await reportFor(primaryRecords, { ...explicitConfiguration, observationCutoff: {
      atUtc: 'bad', provenance: { source: 'uploader', reference: 'invalid snapshot' },
    } });
    expect(report.status).toBe('blocked_by_file_or_configuration_error');
    expect(report.metrics).toBeNull();
    expect(report.quality.accounting).toBeNull();
    expect(report.validationSummary.accepted).toBeNull();
    expect(report.validationSummary.configurationIssues.map(issue => issue.code)).toContain('invalid_observation_cutoff');
    assertFiniteTree(report);
  });

  it('is repeatable, snapshots inputs and binds evidence to source/configuration/specification', async () => {
    const prepared = await prepare(primaryRecords);
    const before = JSON.stringify(prepared);
    const first = await analyze(prepared.input, prepared.config);
    const second = await analyze(prepared.input, prepared.config);
    expect(first).toEqual(second);
    expect(JSON.stringify(prepared)).toBe(before);
    expect(first.run.source).toEqual(prepared.input.source);
    expect(first.run.specification).toEqual({ data: 'FG-DATA-1', metrics: 'FG-METRIC-1' });
    expect(first.run.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const changed = await analyze(prepared.input, { ...prepared.config, observationCutoff: null });
    expect(changed.run.configurationFingerprint).not.toBe(first.run.configurationFingerprint);
    expect(first.run.configuration).not.toBe(prepared.config);
    expect(first.validationSummary).toMatchObject({ parsedNonblank: 12, accepted: 12, rejected: 0, quarantined: 0 });
    assertFiniteTree(first);
  });

  it('has unambiguous metric references and sufficient lineage to find every contributing record', async () => {
    const report = calculated(await reportFor(primaryRecords));
    const all = [...operationalMetricList(report.metrics.A), ...operationalMetricList(report.metrics.B)];
    expect(new Set(all.map(metric => metric.referenceId)).size).toBe(all.length);
    const ids = new Set(all.map(metric => metric.referenceId));
    for (const comparison of report.comparisons) {
      expect(comparison.sourceMetricIds.every(id => ids.has(id))).toBe(true);
    }
    expect(report.metrics.B.medianDoorToProvider.populationRecordNumbers).toEqual([8, 9, 10, 11, 12, 13]);
    expect(report.metrics.B.medianDoorToProvider.eligibleRecordNumbers).toEqual([8, 9]);
    expect(report.metrics.B.medianDoorToProvider.excludedRecordNumbers).toEqual([10, 11, 12, 13]);
    expect(report.metrics.B.seenProviderCompleteness.populationRecordNumbers).toEqual([8, 9, 10, 11]);
    expect(report.metrics.B.seenProviderCompleteness.numeratorRecordNumbers).toEqual([8, 9, 10]);
    expect(report.quality.globalDiagnostics.population).toBe('all_parsed_records');
  });

  it('does not mutate source records and remains JSON serializable without nonfinite output', async () => {
    const prepared = await prepare(primaryRecords);
    for (const row of prepared.input.records) Object.freeze(row.value);
    Object.freeze(prepared.input.records);
    const report = await analyze(prepared.input, prepared.config);
    assertFiniteTree(report);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(JSON.stringify(report)).not.toContain('Infinity');
    expect(JSON.stringify(report)).not.toContain('NaN');
  });
});
