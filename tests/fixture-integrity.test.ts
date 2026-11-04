/**
 * Checks the fixture/oracle artifacts, NOT an analytical engine.
 * Record memberships, waits and medians are manually supplied.
 * Native Date.parse is used only to inspect literal fixture timestamps; it is
 * not the future strict UTC parser. No general validator or median is implemented.
 */
import { describe, expect, it } from 'vitest';
import { fixtureCases, primaryRecords } from './fixtures/cases';
import type { FixtureCase } from './fixtures/cases';
import { expectedCases, manualComparisons } from './fixtures/expected';
import type { CaseExpectation, PeriodExpectation } from './fixtures/expected';
import { csvCases } from './fixtures/csv-cases';

const fields = ['arrival_at_utc', 'encounter_id', 'first_provider_at_utc', 'provider_status'];
const cases: readonly FixtureCase[] = fixtureCases;
const oracles: Readonly<Record<string, CaseExpectation>> = expectedCases;

describe('fixture integrity and independent expectation consistency', () => {
  it('has one oracle per uniquely named scenario', () => {
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
    expect(Object.keys(oracles).sort()).toEqual(cases.map(c => c.id).sort());
  });

  for (const fixture of cases) {
    it(`${fixture.id}: preserves raw four-field records and declared oracle accounting`, () => {
      const expected = oracles[fixture.id];
      if (!expected) throw new Error(`Missing oracle for ${fixture.id}`);
      expect(fixture.records).toHaveLength(expected.parsedRecords);
      for (const record of fixture.records) {
        expect(Object.keys(record).sort()).toEqual(fields);
        expect(Object.values(record).every(value => typeof value === 'string')).toBe(true);
      }
      expect(fixture.configuration.coverage.kind).toBe(expected.coverageKind);
      expect(expected.independentlyVerifiedHospitalCoverage).toBe(false);

      if (expected.blocking === 'configuration') {
        expect(fixture.configuration.periods.kind).toBe('unselected');
        expect(expected.periodRecords).toBeNull();
        expect(expected.periods).toBeNull();
        return;
      }

      const groups = expected.periodRecords;
      const periods = expected.periods;
      if (!groups || !periods) throw new Error('Selected-period oracle must contain both periods');
      const accounted = [
        ...expected.quarantined, ...expected.invalidIdentity, ...expected.unusableArrival,
        ...expected.outsidePeriods, ...groups.A, ...groups.B,
      ];
      expect(accounted.slice().sort((a, b) => a - b))
        .toEqual(fixture.records.map((_, i) => i + 2));
      expect(new Set(accounted).size).toBe(accounted.length);

      for (const period of ['A', 'B'] as const) {
        const oracle: PeriodExpectation = periods[period];
        const cohort = groups[period];
        expect(cohort).toHaveLength(oracle.countable);
        expect(Object.values(oracle.status).reduce((sum, n) => sum + n, 0)).toBe(oracle.countable);
        const excluded = Object.values(oracle.primaryExclusions).flat();
        expect([...oracle.eligibleRecordNumbers, ...excluded].sort((a, b) => a - b)).toEqual([...cohort].sort((a, b) => a - b));
        expect(oracle.waitMinutes).toHaveLength(oracle.eligibleRecordNumbers.length);
        expect(oracle.seenPopulated + oracle.seenMissing).toBe(oracle.status.seen);
        expect(oracle.eligibleRecordNumbers.length).toBeLessThanOrEqual(oracle.seenParseValid);
        expect(oracle.seenParseValid).toBeLessThanOrEqual(oracle.seenPopulated);
        expect(oracle.seenPopulated).toBeLessThanOrEqual(oracle.status.seen);

        expect(oracle.timingEligibility.numerator).toBe(oracle.eligibleRecordNumbers.length);
        expect(oracle.timingEligibility.denominator).toBe(oracle.countable);
        expect(oracle.seenCompleteness.numerator).toBe(oracle.seenPopulated);
        expect(oracle.seenCompleteness.denominator).toBe(oracle.status.seen);
        expect(oracle.seenParseValidity.numerator).toBe(oracle.seenParseValid);
        expect(oracle.seenParseValidity.denominator).toBe(oracle.status.seen);

        for (const fraction of [oracle.timingEligibility, oracle.seenCompleteness, oracle.seenParseValidity]) {
          if (fraction.denominator === 0) expect(fraction.displayedPercent).toBeNull();
          else expect(fraction.displayedPercent).toBe((100 * fraction.numerator / fraction.denominator).toFixed(1));
        }
        if (oracle.eligibleRecordNumbers.length === 0) expect(oracle.medianMinutes).toBeNull();

        // Cross-check only preselected literal eligible records, not eligibility decisions.
        oracle.eligibleRecordNumbers.forEach((recordNumber, i) => {
          const record = fixture.records[recordNumber - 2];
          if (!record) throw new Error('Oracle references nonexistent record');
          expect(record.provider_status).toBe('seen');
          expect((Date.parse(record.first_provider_at_utc) - Date.parse(record.arrival_at_utc)) / 60000).toBe(oracle.waitMinutes[i]);
          expect(expected.quarantined).not.toContain(recordNumber);
        });

        // Check preassigned cohort membership; no search/inference of periods.
        const selection = fixture.configuration.periods;
        if (selection.kind !== 'explicit') throw new Error('Unexpected unselected fixture');
        for (const number of cohort) {
          const record = fixture.records[number - 2];
          if (!record) throw new Error('Missing cohort record');
          expect(Date.parse(record.arrival_at_utc)).toBeGreaterThanOrEqual(Date.parse(selection[period].startUtc));
          expect(Date.parse(record.arrival_at_utc)).toBeLessThan(Date.parse(selection[period].endUtcExclusive));
        }
      }
    });
  }

  it('preserves the approved primary arithmetic without a median implementation', () => {
    expect(primaryRecords).toHaveLength(12);
    expect(expectedCases.primary.periods.A.medianMinutes).toBe((20 + 30) / 2);
    expect(expectedCases.primary.periods.B.medianMinutes).toBe((10 + 20) / 2);
    expect(manualComparisons.primary.medianDifferenceMinutes).toBe(15 - 25);
    expect(manualComparisons.primary.medianRelativePercent).toBe(100 * (-10) / 25);
    expect(manualComparisons.primary.eligibilityDifferencePercentagePoints.numerator /
      manualComparisons.primary.eligibilityDifferencePercentagePoints.denominator)
      .toBeCloseTo(100 * (2 / 6 - 4 / 6), 9);
    expect(manualComparisons.primary.seenCompletenessDifferencePercentagePoints).toBe(75 - 100);
    expect(expectedCases.primary.periods.B.timingEligibility.displayedPercent).toBe('33.3');
    expect(expectedCases.primary.periods.B.seenCompleteness.displayedPercent).toBe('75.0');
  });

  it('keeps all duplicated-ID members quarantined in identical and conflicting fixtures', () => {
    for (const id of ['duplicate-identical', 'duplicate-conflicting'] as const) {
      const fixture = cases.find(c => c.id === id);
      if (!fixture) throw new Error('Missing duplicate fixture');
      const expected = expectedCases[id];
      const a1Numbers = fixture.records.flatMap((r, i) => r.encounter_id === 'A1' ? [i + 2] : []);
      expect(a1Numbers).toEqual([2, 14]);
      expect(expected.quarantined).toEqual(a1Numbers);
      expect(expected.blocking).toBe('none');
      expect(expected.periods.A.medianMinutes).toBe(30);
      expect(manualComparisons.duplicate.medianDifferenceMinutes).toBe(15 - 30);
      expect(manualComparisons.duplicate.medianRelativePercent).toBe(100 * (-15) / 30);
    }
  });

  it('retains missingness, negative chronology and status contradictions as intentional inputs', () => {
    const missing = cases.find(c => c.id === 'missing');
    const chronology = cases.find(c => c.id === 'chronology');
    const contradictory = cases.find(c => c.id === 'contradictory');
    expect(missing?.records[0]?.arrival_at_utc).toBe('');
    expect(missing?.records[1]?.first_provider_at_utc).toBe('');
    const row = chronology?.records[0];
    if (!row) throw new Error('Missing chronology fixture');
    expect(Date.parse(row.first_provider_at_utc) - Date.parse(row.arrival_at_utc)).toBe(-300000);
    expect(contradictory?.records.map(r => r.provider_status)).toEqual(['not_seen', 'unknown', 'SEEN']);
    expect(contradictory?.records.every(r => r.first_provider_at_utc !== '')).toBe(true);
  });

  it('retains boundary literals and the independent declared-overlap arithmetic', () => {
    const fixture = cases.find(c => c.id === 'boundaries');
    expect(fixture?.records.map(r => r.arrival_at_utc)).toEqual([
      '2026-10-05T00:00:00Z', '2026-10-12T00:00:00Z', '2026-10-19T00:00:00Z',
      '2026-10-04T23:59:59.999Z', '2026-10-11T23:50:00Z',
    ]);
    const coverage = cases.find(c => c.id === 'partial-coverage')?.configuration.coverage;
    if (coverage?.kind !== 'declared') throw new Error('Missing coverage declaration');
    expect(coverage.intervals).toEqual([
      { startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-07T00:00:00Z' },
      { startUtc: '2026-10-06T00:00:00Z', endUtcExclusive: '2026-10-08T00:00:00Z' },
    ]);
    expect(manualComparisons.partialCoverage.unionHoursA).toBe(48 + 48 - 24);
    expect(manualComparisons.partialCoverage.displayedPercentA).toBe((100 * 72 / 168).toFixed(1));
    expect(manualComparisons.partialCoverage.independentlyVerifiedHospitalCoverage).toBe(false);
  });
});

describe('literal CSV examples only; parser behavior remains unimplemented', () => {
  it('distinguishes valid empty data from fatal missing structure', () => {
    expect(csvCases[0].text.split('\n').filter(Boolean)).toHaveLength(1);
    expect(csvCases[0].expected.metricsBlocked).toBe(false);
    expect(csvCases[1].text).toBe('');
    expect(csvCases[1].expected.metricsBlocked).toBe(true);
  });

  it('preserves intentionally duplicated headers, wrong width and an unclosed quote', () => {
    expect(csvCases[2].text.match(/arrival_at_utc/g)).toHaveLength(2);
    // These two literal lines contain no quoted commas; this is not a CSV parser.
    expect(csvCases[3].text.split('\n')[1]?.split(',')).toHaveLength(3);
    expect(csvCases[4].text.match(/"/g)).toHaveLength(1);
    for (const fixture of csvCases.slice(1)) expect(fixture.expected.scope).toBe('fatal_file');
  });
});
