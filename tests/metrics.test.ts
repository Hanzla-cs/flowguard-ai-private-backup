import { describe, expect, it } from 'vitest';
import type { CaseExpectation } from './fixtures/expected';
import { expectedCases } from './fixtures/expected';
import { fixtureCases, primaryRecords, explicitConfiguration } from './fixtures/cases';
import { calculated, encounter, reportFor, assertFiniteTree } from './helpers/analysis';
import { operationalMetricList } from '../src/core/metrics';

describe('verified metrics against the independent Phase 2 oracle', () => {
  for (const fixture of fixtureCases) {
    it(fixture.id, async () => {
      const oracle: CaseExpectation = expectedCases[fixture.id];
      const report = await reportFor(fixture.records, fixture.configuration);
      assertFiniteTree(report);
      if (!oracle.periods) {
        expect(report.status).toBe('blocked_by_file_or_configuration_error');
        expect(report.metrics).toBeNull();
        return;
      }
      const actual = calculated(report);
      for (const period of ['A', 'B'] as const) {
        const metrics = actual.metrics[period], expected = oracle.periods[period];
        expect(metrics.encounterCount.value).toBe(expected.countable);
        expect(metrics.timingEligibleCount.value).toBe(expected.eligibleRecordNumbers.length);
        expect(metrics.timingExcludedCount.value).toBe(expected.countable - expected.eligibleRecordNumbers.length);
        expect(metrics.medianDoorToProvider.value).toBe(expected.medianMinutes);
        expect(metrics.medianDoorToProvider.denominator).toBe(expected.eligibleRecordNumbers.length);
        expect(metrics.medianDoorToProvider.eligibleRecordNumbers).toEqual(expected.eligibleRecordNumbers);
        expect(metrics.doorToProviderDurations.map(item => item.minutes)).toEqual(expected.waitMinutes);
        expect(metrics.statuses.seen.count.value).toBe(expected.status.seen);
        expect(metrics.statuses.not_seen.count.value).toBe(expected.status.notSeen);
        expect(metrics.statuses.unknown.count.value).toBe(expected.status.unknown);
        expect(metrics.statuses.invalid.count.value).toBe(expected.status.invalid);
        expect(metrics.timingEligibility.displayValue).toBe(expected.timingEligibility.displayedPercent);
        expect(metrics.timingEligibility.numerator).toBe(expected.timingEligibility.numerator);
        expect(metrics.timingEligibility.denominator).toBe(expected.timingEligibility.denominator);
        expect(metrics.seenProviderCompleteness.displayValue).toBe(expected.seenCompleteness.displayedPercent);
        expect(metrics.seenProviderCompleteness.denominator).toBe(expected.seenCompleteness.denominator);
        expect(metrics.seenProviderParseValidity.displayValue).toBe(expected.seenParseValidity.displayedPercent);
        expect(metrics.seenProviderParseValidity.denominator).toBe(expected.seenParseValidity.denominator);
        for (const metric of operationalMetricList(metrics)) {
          expect(metric.definitionId).toMatch(/^FG-METRIC-1#/);
          expect(metric.definition.length).toBeGreaterThan(10);
          expect(metric.eligibleN).toBe(metric.eligibleRecordNumbers.length);
          expect(metric.excludedN).toBe(metric.excludedRecordNumbers.length);
          expect(metric.displayValue === null).toBe(metric.value === null);
          expect(metric.period).toBe(period);
        }
      }
    });
  }

  it('produces the approved primary outputs and preserves both denominator definitions', async () => {
    const report = calculated(await reportFor(primaryRecords));
    expect(report.metrics.A.encounterCount.value).toBe(6);
    expect(report.metrics.B.encounterCount.value).toBe(6);
    expect(report.metrics.A.medianDoorToProvider.displayValue).toBe('25.0');
    expect(report.metrics.B.medianDoorToProvider.displayValue).toBe('15.0');
    expect(report.metrics.A.timingEligibility.displayValue).toBe('66.7');
    expect(report.metrics.B.timingEligibility.displayValue).toBe('33.3');
    expect(report.metrics.A.seenProviderCompleteness.displayValue).toBe('100.0');
    expect(report.metrics.B.seenProviderCompleteness.displayValue).toBe('75.0');
    expect(report.metrics.B.timingEligibility.denominator).toBe(6);
    expect(report.metrics.B.seenProviderCompleteness.denominator).toBe(4);
    expect(report.metrics.B.seenProviderParseValidity.value).toBe(75);
    expect(report.metrics.B.seenTimingEligibility.value).toBe(50);
    expect(report.metrics.B.statuses.seen.percentage.displayValue).toBe('66.7');
    expect(report.metrics.B.statuses.not_seen.percentage.displayValue).toBe('16.7');
    expect(report.metrics.B.statuses.unknown.percentage.displayValue).toBe('16.7');
    expect(report.metrics.B.statuses.invalid.percentage.value).toBe(0);
  });
});

describe('timing and population edge cases', () => {
  const arrival = '2026-10-05T12:00:00Z';
  it('calculates an unsorted odd sample median without changing source order', async () => {
    const report = calculated(await reportFor([
      encounter('a', arrival, '2026-10-05T12:40:00Z'),
      encounter('b', arrival, '2026-10-05T12:10:00Z'),
      encounter('c', arrival, '2026-10-05T12:20:00Z'),
    ]));
    expect(report.metrics.A.doorToProviderDurations.map(item => item.minutes)).toEqual([40, 10, 20]);
    expect(report.metrics.A.medianDoorToProvider.value).toBe(20);
  });

  it('preserves half-millisecond precision for an even sample before minute conversion', async () => {
    const report = calculated(await reportFor([
      encounter('a', arrival, '2026-10-05T12:00:00.001Z'),
      encounter('b', arrival, '2026-10-05T12:00:00.002Z'),
    ]));
    expect(report.metrics.A.doorToProviderDurations.map(item => item.durationMilliseconds)).toEqual([1, 2]);
    expect(report.metrics.A.medianDoorToProvider.value).toBe(0.000025);
    expect(report.metrics.A.medianDoorToProvider.displayValue).toBe('0.0');
  });

  it('reports a single zero observation and its limitation without treating it as missing', async () => {
    const report = calculated(await reportFor([encounter('z', arrival, arrival)]));
    expect(report.metrics.A.medianDoorToProvider.value).toBe(0);
    expect(report.metrics.A.medianDoorToProvider.denominator).toBe(1);
    expect(report.metrics.A.medianDoorToProvider.limitations.join(' ')).toContain('single eligible observation');
    expect(report.metrics.B.medianDoorToProvider.value).toBeNull();
    expect(report.metrics.B.statuses.seen.percentage.value).toBeNull();
    expect(report.metrics.B.statuses.seen.count.value).toBe(0);
  });

  it('separates provider presence, parse validity and timing eligibility', async () => {
    const report = calculated(await reportFor([
      encounter('bad', arrival, 'bad'),
      encounter('missing', arrival, ''),
      encounter('negative', arrival, '2026-10-05T11:55:00Z'),
      encounter('valid', arrival, '2026-10-05T12:20:00Z'),
    ]));
    const a = report.metrics.A;
    expect(a.encounterCount.value).toBe(4);
    expect(a.seenProviderCompleteness.value).toBe(75);
    expect(a.seenProviderParseValidity.value).toBe(50);
    expect(a.timingEligibility.value).toBe(25);
    expect(a.medianDoorToProvider.value).toBe(20);
    expect(report.quality.periods?.A.primaryTimingExclusions.malformed_provider.count).toBe(1);
    expect(report.quality.periods?.A.primaryTimingExclusions.missing_provider.count).toBe(1);
    expect(report.quality.periods?.A.primaryTimingExclusions.provider_before_arrival.count).toBe(1);
  });

  it('counts contradictory recorded statuses without reclassifying them as seen', async () => {
    const report = calculated(await reportFor([
      encounter('n', arrival, '2026-10-05T12:10:00Z', 'not_seen'),
      encounter('u', arrival, '2026-10-05T12:10:00Z', 'unknown'),
      encounter('x', arrival, '2026-10-05T12:10:00Z', 'SEEN'),
    ]));
    expect(report.metrics.A.statuses.not_seen.count.value).toBe(1);
    expect(report.metrics.A.statuses.unknown.count.value).toBe(1);
    expect(report.metrics.A.statuses.invalid.count.value).toBe(1);
    expect(report.metrics.A.statuses.seen.count.value).toBe(0);
    expect(report.metrics.A.seenProviderCompleteness.value).toBeNull();
    expect(report.metrics.A.timingEligibility.value).toBe(0);
    expect(report.metrics.A.medianDoorToProvider.value).toBeNull();
    expect(report.quality.globalDiagnostics.countsByCode.status_timestamp_conflict?.count).toBe(2);
  });

  it('does not cap or remove a long wait and allows provider contact after cohort end', async () => {
    const report = calculated(await reportFor([
      encounter('long', '2026-10-05T00:00:00Z', '2026-10-20T00:00:00Z'),
      encounter('cross', '2026-10-11T23:50:00Z', '2026-10-12T00:10:00Z'),
    ]));
    expect(report.metrics.A.doorToProviderDurations.map(item => item.minutes)).toEqual([21600, 20]);
    expect(report.metrics.A.medianDoorToProvider.value).toBe(10810);
    expect(report.metrics.B.encounterCount.value).toBe(0);
  });

  it('preserves cutoff exclusions in median lineage without erasing counts', async () => {
    const report = calculated(await reportFor([
      encounter('ok', arrival, '2026-10-05T12:10:00Z'),
      encounter('late', arrival, '2026-10-05T12:10:00.001Z'),
    ], { ...explicitConfiguration, observationCutoff: {
      atUtc: '2026-10-05T12:10:00Z', provenance: { source: 'uploader', reference: 'test snapshot' },
    } }));
    expect(report.metrics.A.encounterCount.value).toBe(2);
    expect(report.metrics.A.medianDoorToProvider.value).toBe(10);
    expect(report.metrics.A.medianDoorToProvider.excludedRecordNumbers).toEqual([3]);
    expect(report.quality.periods?.A.primaryTimingExclusions.provider_after_cutoff.recordNumbers).toEqual([3]);
  });

  it('gives zero accepted counts with explicit exclusion limitations when all rows are quarantined', async () => {
    const row = encounter('same', arrival, arrival);
    const report = calculated(await reportFor([row, row]));
    expect(report.validationSummary.quarantined).toBe(2);
    expect(report.metrics.A.encounterCount.value).toBe(0);
    expect(report.metrics.A.medianDoorToProvider.value).toBeNull();
    expect(report.metrics.A.timingEligibility.value).toBeNull();
    expect(report.limitations.join(' ')).toContain('All supplied records are quarantined or rejected');
  });

  it('excludes invalid identities/arrivals globally and preserves outside-period records', async () => {
    const report = calculated(await reportFor([
      encounter('', arrival, arrival), encounter('missing', '', ''),
      encounter('out', '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z'),
      encounter('in', arrival, arrival),
    ]));
    expect(report.quality.accounting?.invalidIdentity.recordNumbers).toEqual([2]);
    expect(report.quality.accounting?.unusableArrival.recordNumbers).toEqual([3]);
    expect(report.quality.accounting?.outsidePeriods.recordNumbers).toEqual([4]);
    expect(report.metrics.A.encounterCount.value).toBe(1);
    expect(report.metrics.B.encounterCount.value).toBe(0);
    expect(report.validationSummary.accepted).toBe(2);
  });

  it('reconciles every eligible/excluded record and status without summing overlapping diagnostics', async () => {
    const report = calculated(await reportFor(primaryRecords));
    for (const id of ['A', 'B'] as const) {
      const metrics = report.metrics[id], quality = report.quality.periods![id];
      expect(metrics.timingEligibleCount.value! + metrics.timingExcludedCount.value!).toBe(metrics.encounterCount.value);
      expect(Object.values(metrics.statuses).reduce((n, status) => n + status.count.value!, 0)).toBe(metrics.encounterCount.value);
      expect(Object.values(quality.primaryTimingExclusions).reduce((n, exclusion) => n + exclusion.count, 0)).toBe(metrics.timingExcludedCount.value);
      expect(new Set([...quality.timingEligible.recordNumbers, ...quality.timingExcluded.recordNumbers]).size).toBe(metrics.encounterCount.value);
      expect(quality.diagnostics.countsAreExclusive).toBe(false);
    }
  });

  it('is row-order independent for numerical metrics while lineage follows the new source', async () => {
    const forward = calculated(await reportFor(primaryRecords));
    const reversed = calculated(await reportFor([...primaryRecords].reverse()));
    for (const id of ['A', 'B'] as const) {
      expect(operationalMetricList(reversed.metrics[id]).map(metric => [metric.id, metric.unit, metric.value, metric.numerator, metric.denominator]))
        .toEqual(operationalMetricList(forward.metrics[id]).map(metric => [metric.id, metric.unit, metric.value, metric.numerator, metric.denominator]));
    }
    expect(reversed.run.source.sha256).not.toBe(forward.run.source.sha256);
  });
});
