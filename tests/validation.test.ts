import { describe, expect, it } from 'vitest';
import type { AnalysisConfiguration, CsvParsed, EncounterValidationResult, RawEncounterRecord } from '../src/core/contracts';
import { ENCOUNTER_HEADERS, parseCsv } from '../src/input/parse-csv';
import { validateEncounters } from '../src/core/validate';
import { explicitConfiguration, fixtureCases } from './fixtures/cases';
import { expectedCases } from './fixtures/expected';
import type { CaseExpectation } from './fixtures/expected';

async function ingest(records: readonly RawEncounterRecord[]): Promise<CsvParsed> {
  const quote = (s: string): string => '"' + s.replaceAll('"', '""') + '"';
  const text = ENCOUNTER_HEADERS.join(',') + '\n' + records.map(row =>
    ENCOUNTER_HEADERS.map(field => quote(row[field])).join(',')).join('\n');
  const parsed = await parseCsv(new TextEncoder().encode(text), 'independent-fixture.csv');
  if (parsed.kind !== 'parsed') throw new Error(JSON.stringify(parsed.issues));
  return parsed;
}
function confirmed(input: CsvParsed, configuration: AnalysisConfiguration = explicitConfiguration): AnalysisConfiguration {
  return { ...configuration, periods: configuration.periods.kind === 'explicit'
    ? { ...configuration.periods, confirmedForSourceSha256: input.source.sha256 }
    : configuration.periods };
}
async function validate(records: readonly RawEncounterRecord[], config: AnalysisConfiguration = explicitConfiguration): Promise<EncounterValidationResult> {
  const input = await ingest(records);
  return validateEncounters(input, confirmed(input, config));
}
const base: RawEncounterRecord = {
  encounter_id: 'X1', arrival_at_utc: '2026-10-05T12:00:00Z',
  first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'seen',
};

describe('CSV-to-validation against independently recorded fixture membership', () => {
  for (const fixture of fixtureCases) {
    it(fixture.id, async () => {
      const expected: CaseExpectation = expectedCases[fixture.id];
      const result = await validate(fixture.records, fixture.configuration);
      expect(result.kind).toBe(expected.blocking === 'configuration' ? 'blocked_configuration' : 'validated');
      expect(result.inspected).toHaveLength(expected.parsedRecords);
      expect(result.quality.quarantinedRecords.map(row => row.source.recordNumber)).toEqual(expected.quarantined);
      expect(result.coverage.metadata).toEqual(fixture.configuration.coverage);
      expect(result.coverage.independentlyVerifiedHospitalCoverage).toBe(false);
      expect('metrics' in result).toBe(false);
      if (!expected.periods || !expected.periodRecords) {
        expect(result.quality.accounting).toBeNull();
        expect(result.cohorts).toBeNull();
        return;
      }
      const accounting = result.quality.accounting;
      if (!accounting || !result.quality.periods) throw new Error('Missing record accounting');
      expect(accounting.invalidIdentity.recordNumbers).toEqual(expected.invalidIdentity);
      expect(accounting.unusableArrival.recordNumbers).toEqual(expected.unusableArrival);
      expect(accounting.outsidePeriods.recordNumbers).toEqual(expected.outsidePeriods);
      expect(accounting.periodA.recordNumbers).toEqual(expected.periodRecords.A);
      expect(accounting.periodB.recordNumbers).toEqual(expected.periodRecords.B);
      expect(accounting.duplicateQuarantined.count + accounting.invalidIdentity.count +
        accounting.unusableArrival.count + accounting.outsidePeriods.count +
        accounting.periodA.count + accounting.periodB.count).toBe(accounting.parsedNonblank);
      expect(result.accepted!.length + result.rejected!.length + result.quality.quarantinedRecords.length).toBe(fixture.records.length);
      for (const id of ['A', 'B'] as const) {
        const actual = result.quality.periods[id], oracle = expected.periods[id];
        expect(actual.countable.count).toBe(oracle.countable);
        expect(actual.timingEligible.recordNumbers).toEqual(oracle.eligibleRecordNumbers);
        expect(actual.timingEligible.count + actual.timingExcluded.count).toBe(actual.countable.count);
        for (const [reason, exclusion] of Object.entries(actual.primaryTimingExclusions)) {
          expect(exclusion.recordNumbers).toEqual(oracle.primaryExclusions[reason] ?? []);
        }
        expect(actual.recordedSeen.count).toBe(oracle.status.seen);
        expect(actual.seenProviderPopulated.count).toBe(oracle.seenPopulated);
        expect(actual.seenProviderParseValid.count).toBe(oracle.seenParseValid);
        expect(actual.seenProviderMissing.count).toBe(oracle.seenMissing);
        expect(actual.diagnostics.population).toBe('accepted_period_encounters');
        expect(actual.diagnostics.countsAreExclusive).toBe(false);
      }
      // Deliberately no assertions of computed medians or comparison KPIs: none exist.
    });
  }
});

describe('record-level defects and independent quarantine', () => {
  it.each(['', ' ', 'null', 'N/A', 'é', 'X\n', ' X', 'X'.repeat(65)])('rejects identifier %j without inventing a duplicate group', async encounter_id => {
    const result = await validate([{ ...base, encounter_id }, { ...base, encounter_id }]);
    expect(result.quality.duplicateGroups).toEqual([]);
    expect(result.rejected).toHaveLength(2);
    expect(result.quality.accounting?.invalidIdentity.recordNumbers).toEqual([2, 3]);
  });

  it('preserves case-sensitive IDs and accepts the maximum identifier length', async () => {
    const result = await validate([{ ...base, encounter_id: 'Case' }, { ...base, encounter_id: 'case' }, { ...base, encounter_id: 'X'.repeat(64) }]);
    expect(result.accepted).toHaveLength(3);
  });

  it.each([
    { arrival_at_utc: '2026-10-21T00:00:00Z' },
    { arrival_at_utc: 'malformed' },
    { arrival_at_utc: '2026-10-12T12:00:00Z' },
  ])('quarantines all duplicate members before arrival/period filtering (%j)', async override => {
    const result = await validate([base, { ...base, ...override }]);
    expect(result.quality.duplicateGroups).toEqual([{ encounterId: 'X1', recordNumbers: [2, 3] }]);
    expect(result.quality.quarantinedRecords.map(row => row.source.recordNumber)).toEqual([2, 3]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.quality.accounting?.duplicateQuarantined.count).toBe(2);
    expect(result.kind).toBe('validated');
  });

  it('preserves overlapping defects on quarantined rows without double exclusion', async () => {
    const result = await validate([base, { ...base, arrival_at_utc: '', provider_status: 'SEEN', first_provider_at_utc: '' }]);
    expect(result.quality.quarantinedRecords[1]?.issues.map(i => i.code))
      .toEqual(expect.arrayContaining(['duplicate_identifier', 'missing_arrival', 'missing_provider', 'invalid_status']));
    expect(result.quality.accounting?.unusableArrival.count).toBe(0);
    expect(result.quality.globalDiagnostics.countsByCode.missing_arrival?.recordNumbers).toEqual([3]);
  });

  it('reports globally unassignable seen records, including quarantines', async () => {
    const result = await validate([base, { ...base, arrival_at_utc: '' }, { ...base, encounter_id: 'Y', arrival_at_utc: 'bad' }]);
    expect(result.quality.rawSeenUnusableArrival.recordNumbers).toEqual([3, 4]);
    expect(result.quality.accounting?.unusableArrival.recordNumbers).toEqual([4]);
  });

  it.each(['seen', 'not_seen', 'unknown', '', 'SEEN', ' seen '])('preserves status %j and never infers an outcome', async provider_status => {
    const result = await validate([{ ...base, provider_status }]);
    expect(result.accepted).toHaveLength(1);
    expect(result.inspected[0]?.source.value.provider_status).toBe(provider_status);
    const conflict = result.inspected[0]?.issues.some(i => i.code === 'status_timestamp_conflict');
    expect(conflict).toBe(provider_status === 'not_seen' || provider_status === 'unknown');
    expect(result.quality.periods?.A.timingEligible.count).toBe(provider_status === 'seen' ? 1 : 0);
  });

  it.each(['', 'bad', '2026-02-30T12:00:00Z', '2026-10-05T11:55:00Z'])('keeps countable seen encounters with provider defect %j', async first_provider_at_utc => {
    const result = await validate([{ ...base, first_provider_at_utc }]);
    expect(result.accepted).toHaveLength(1);
    expect(result.quality.periods?.A.timingEligible.count).toBe(0);
    expect(result.quality.periods?.A.seenProviderPopulated.count).toBe(first_provider_at_utc === '' ? 0 : 1);
    expect(result.quality.periods?.A.seenProviderParseValid.count).toBe(first_provider_at_utc === '2026-10-05T11:55:00Z' ? 1 : 0);
  });

  it('treats missing provider for not_seen as expected information, without outcome inference', async () => {
    const result = await validate([{ ...base, first_provider_at_utc: '', provider_status: 'not_seen' }]);
    const issue = result.inspected[0]?.issues.find(i => i.code === 'missing_provider');
    expect(issue?.severity).toBe('info');
    expect(issue?.effects).toEqual(['informational']);
    expect(result.quality.periods?.A.primaryTimingExclusions.not_seen.count).toBe(1);
    expect(result.inspected[0]?.recordedStatus).toBe('not_seen');
  });

  it('accepts zero provider wait and applies no outlier ceiling', async () => {
    const result = await validate([
      { ...base, first_provider_at_utc: base.arrival_at_utc },
      { ...base, encounter_id: 'Y', first_provider_at_utc: '9999-12-31T23:59:59.999Z' },
    ], { ...explicitConfiguration, observationCutoff: null });
    expect(result.quality.periods?.A.timingEligible.count).toBe(2);
  });
});

describe('cutoffs, configuration and provenance', () => {
  it('applies inclusive cutoff equality and separate arrival/provider exclusions', async () => {
    const cutoff = { atUtc: '2026-10-05T12:10:00Z', provenance: { source: 'uploader' as const, reference: 'fictional snapshot' } };
    const result = await validate([
      base,
      { ...base, encounter_id: 'Y', first_provider_at_utc: '2026-10-05T12:10:00.001Z' },
      { ...base, encounter_id: 'Z', arrival_at_utc: '2026-10-05T12:10:00.001Z', first_provider_at_utc: '2026-10-05T12:10:00.001Z' },
      { ...base, encounter_id: 'W', arrival_at_utc: cutoff.atUtc, first_provider_at_utc: cutoff.atUtc },
    ], { ...explicitConfiguration, observationCutoff: cutoff });
    expect(result.accepted?.map(row => row.source.recordNumber)).toEqual([2, 3, 5]);
    expect(result.quality.accounting?.unusableArrival.recordNumbers).toEqual([4]);
    expect(result.quality.periods?.A.timingEligible.recordNumbers).toEqual([2, 5]);
    expect(result.quality.periods?.A.primaryTimingExclusions.provider_after_cutoff.recordNumbers).toEqual([3]);
  });

  it('blocks acceptance/accounting for an invalid cutoff instead of silently ignoring it', async () => {
    const result = await validate([base], {
      ...explicitConfiguration,
      observationCutoff: { atUtc: 'bad', provenance: { source: 'uploader', reference: 'bad cutoff' } },
    });
    expect(result.kind).toBe('blocked_configuration');
    expect(result.configurationIssues[0]?.code).toBe('invalid_observation_cutoff');
    expect(result.accepted).toBeNull();
    expect(result.rejected).toBeNull();
    expect(result.quality.accounting).toBeNull();
    expect(result.inspected).toHaveLength(1);
  });

  it('requires period reconfirmation after source replacement', async () => {
    const input = await ingest([base]);
    const oldConfig = confirmed(input);
    const replacement = await ingest([{ ...base, encounter_id: 'replacement' }]);
    const result = validateEncounters(replacement, oldConfig);
    expect(result.kind).toBe('blocked_configuration');
    expect(result.configurationIssues.map(i => i.code)).toContain('period_source_mismatch');
    expect(result.cohorts).toBeNull();
    expect(result.accepted).toHaveLength(1);
  });

  it('preserves raw input and keeps returned source records independent of later mutation', async () => {
    const input = await ingest([base]);
    const config = confirmed(input);
    const before = JSON.stringify({ input, config });
    Object.freeze(input.records[0]!.value);
    const result = validateEncounters(input, config);
    expect(JSON.stringify({ input, config })).toBe(before);
    expect(result.inspected[0]?.source.value).not.toBe(input.records[0]?.value);
    expect(validateEncounters(input, config)).toEqual(result);
  });

  it('reconciles blank logical records independently of encounter counts', async () => {
    const input = await parseCsv(new TextEncoder().encode(ENCOUNTER_HEADERS.join(',') + '\n\nX,2026-10-05T12:00:00Z,,unknown\n'));
    if (input.kind !== 'parsed') throw new Error('Unexpected ingestion failure');
    const result = validateEncounters(input, confirmed(input));
    expect(result.quality.accounting?.skippedBlank).toBe(1);
    expect(result.quality.accounting?.parsedNonblank).toBe(1);
    expect(result.quality.accounting?.periodA.recordNumbers).toEqual([3]);
  });

  it('does not turn self-declared coverage into verification', async () => {
    const result = await validate([base], {
      ...explicitConfiguration,
      coverage: { kind: 'declared', intervals: [{ startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-12T00:00:00Z' }],
        encounterCapture: 'declared_complete', provenance: { source: 'uploader', reference: 'self declaration' },
        syntheticReproduction: 'not_applicable' },
    });
    expect(result.coverage.metadata.kind).toBe('declared');
    expect(result.coverage.independentlyVerifiedHospitalCoverage).toBe(false);
    expect('declaredTemporalCoverage' in result.coverage).toBe(false);
  });
});
