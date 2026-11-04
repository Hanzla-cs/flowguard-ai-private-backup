import type {
  AnalysisConfiguration, CsvParsed, DataQualityResults, DiagnosticSummary, DuplicateGroup,
  EncounterField, EncounterValidationResult, InspectedEncounter, IssueCode, IssueEffect,
  PeriodDataQuality, PeriodId, ProviderStatus, QuarantinedRecord, RecordCount,
  SourceRecord, TimingExclusionReason, ValidationIssue,
} from './contracts';
import { assignArrival, validateObservationCutoff, validatePeriods } from './periods';
import { parseUtcTimestamp } from './timestamps';

const TIMING_REASONS: readonly TimingExclusionReason[] = [
  'invalid_status', 'not_seen', 'unknown', 'missing_provider', 'malformed_provider',
  'provider_before_arrival', 'provider_after_cutoff',
];

function validId(value: string): boolean {
  if (value === 'null' || value === 'N/A') return false;
  const match = /^[A-Za-z0-9_-]{1,64}$/.exec(value);
  return match !== null && match[0] === value;
}

function recordCount(records: readonly number[]): RecordCount {
  return { count: records.length, recordNumbers: [...records] };
}

function diagnostics(issues: readonly ValidationIssue[], period: PeriodId | null): DiagnosticSummary {
  const byCode: Partial<Record<IssueCode, Set<number>>> = {};
  for (const issue of issues) {
    if (issue.scope !== 'record') continue;
    const numbers = byCode[issue.code] ?? new Set<number>();
    issue.recordNumbers.forEach(n => numbers.add(n));
    byCode[issue.code] = numbers;
  }
  return {
    population: period === null ? 'all_parsed_records' : 'accepted_period_encounters',
    period, countsAreExclusive: false, issues: [...issues],
    countsByCode: Object.fromEntries(Object.entries(byCode).map(([code, numbers]) =>
      [code, recordCount([...numbers].sort((a, b) => a - b))])),
  };
}

function periodQuality(period: PeriodId, rows: readonly InspectedEncounter[]): PeriodDataQuality {
  const numbers = (predicate: (row: InspectedEncounter) => boolean): RecordCount =>
    recordCount(rows.filter(predicate).map(row => row.source.recordNumber));
  const seen = rows.filter(row => row.recordedStatus === 'seen');
  return {
    period,
    countable: numbers(() => true),
    timingEligible: numbers(row => row.timingExclusion === null),
    timingExcluded: numbers(row => row.timingExclusion !== null),
    primaryTimingExclusions: Object.fromEntries(TIMING_REASONS.map(reason => [
      reason, numbers(row => row.timingExclusion === reason),
    ])) as Record<TimingExclusionReason, RecordCount>,
    recordedSeen: recordCount(seen.map(row => row.source.recordNumber)),
    seenProviderPopulated: recordCount(seen.filter(row => row.source.value.first_provider_at_utc !== '').map(row => row.source.recordNumber)),
    seenProviderParseValid: recordCount(seen.filter(row => row.provider.kind === 'valid').map(row => row.source.recordNumber)),
    seenProviderMissing: recordCount(seen.filter(row => row.provider.kind === 'missing').map(row => row.source.recordNumber)),
    diagnostics: diagnostics(rows.flatMap(row => row.issues), period),
  };
}

/**
 * Record diagnostics and cohort membership only. No waits, medians, percentages,
 * comparison KPIs, coverage percentages, detection or AI are calculated.
 */
export function validateEncounters(input: CsvParsed, configuration: AnalysisConfiguration): EncounterValidationResult {
  const cutoff = validateObservationCutoff(configuration.observationCutoff);
  const periods = validatePeriods(configuration.periods, input.source.sha256);
  const configIssues = [...cutoff.issues, ...periods.issues];
  const cutoffMs = cutoff.kind === 'valid' ? cutoff.epochMs : null;
  const sources: SourceRecord[] = input.records.map(row => ({
    recordNumber: row.recordNumber, value: { ...row.value },
  }));
  if (new Set(sources.map(row => row.recordNumber)).size !== sources.length ||
      sources.some(row => !Number.isSafeInteger(row.recordNumber) || row.recordNumber < 2)) {
    throw new TypeError('Parsed source records require unique logical record numbers starting at 2.');
  }

  const idGroups = new Map<string, number[]>();
  for (const row of sources) {
    if (!validId(row.value.encounter_id)) continue;
    const numbers = idGroups.get(row.value.encounter_id) ?? [];
    numbers.push(row.recordNumber);
    idGroups.set(row.value.encounter_id, numbers);
  }
  const duplicateGroups: DuplicateGroup[] = [...idGroups.entries()]
    .filter(([, numbers]) => numbers.length > 1)
    .map(([encounterId, recordNumbers]) => ({ encounterId, recordNumbers }));
  const duplicates = new Map(duplicateGroups.map(group => [group.encounterId, group.recordNumbers]));

  const inspected: InspectedEncounter[] = sources.map(source => {
    const raw = source.value;
    const issues: ValidationIssue[] = [];
    const add = (code: IssueCode, field: readonly EncounterField[], effects: readonly IssueEffect[],
      message: string, severity: ValidationIssue['severity'] = 'error'): void => {
      issues.push({ code, fields: field, effects, message, severity, scope: 'record', recordNumbers: [source.recordNumber] });
    };
    const identifierValid = validId(raw.encounter_id);
    if (!identifierValid) add('invalid_identifier', ['encounter_id'], ['exclude_encounter'], 'Identifier must be 1–64 ASCII letters, digits, hyphens or underscores.');
    const group = duplicates.get(raw.encounter_id);
    if (group) add('duplicate_identifier', ['encounter_id'], ['quarantine'], 'Every record with this repeated valid ID is quarantined.');

    const arrival = parseUtcTimestamp(raw.arrival_at_utc);
    const provider = parseUtcTimestamp(raw.first_provider_at_utc);
    const status: ProviderStatus | null = ['seen', 'not_seen', 'unknown'].includes(raw.provider_status)
      ? raw.provider_status as ProviderStatus : null;
    if (status === null) add('invalid_status', ['provider_status'], ['exclude_timing'], 'Provider status is missing or unsupported; no status is inferred.');
    if (arrival.kind !== 'valid') {
      add(arrival.kind === 'missing' ? 'missing_arrival' : 'malformed_arrival', ['arrival_at_utc'],
        ['exclude_encounter'], 'Arrival is missing or is not a valid timestamp in the approved UTC format.');
    }
    if (provider.kind === 'missing') {
      add('missing_provider', ['first_provider_at_utc'], status === 'seen' ? ['exclude_timing'] : ['informational'],
        status === 'not_seen' ? 'Missing provider time is expected for recorded not_seen; no final outcome inferred.' :
          'Provider timestamp is missing; recorded status is preserved.', status === 'seen' ? 'warning' : 'info');
    } else if (provider.kind === 'invalid') {
      add('malformed_provider', ['first_provider_at_utc'], ['exclude_timing'], 'Provider timestamp is not a valid UTC timestamp.');
    }
    if ((status === 'not_seen' || status === 'unknown') && raw.first_provider_at_utc !== '') {
      add('status_timestamp_conflict', ['provider_status', 'first_provider_at_utc'], ['exclude_timing'],
        'Populated provider time contradicts the recorded status; the status is not changed.');
    }
    const negative = arrival.kind === 'valid' && provider.kind === 'valid' && provider.epochMs < arrival.epochMs;
    if (negative) add('provider_before_arrival', ['arrival_at_utc', 'first_provider_at_utc'], ['exclude_timing'], 'Provider contact precedes arrival.');
    const arrivalAfter = cutoffMs !== null && arrival.kind === 'valid' && arrival.epochMs > cutoffMs;
    const providerAfter = cutoffMs !== null && provider.kind === 'valid' && provider.epochMs > cutoffMs;
    if (arrivalAfter) add('arrival_after_cutoff', ['arrival_at_utc'], ['exclude_encounter'], 'Arrival occurs after the declared observation cutoff.');
    if (providerAfter) add('provider_after_cutoff', ['first_provider_at_utc'], ['exclude_timing'], 'Provider contact occurs after the declared observation cutoff.');

    const rejection = !identifierValid ? 'invalid_identity' :
      arrival.kind !== 'valid' || arrivalAfter ? 'unusable_arrival' : null;
    const timingExclusion: TimingExclusionReason | null =
      status === null ? 'invalid_status' : status === 'not_seen' ? 'not_seen' :
        status === 'unknown' ? 'unknown' : provider.kind === 'missing' ? 'missing_provider' :
          provider.kind === 'invalid' ? 'malformed_provider' : negative ? 'provider_before_arrival' :
            providerAfter ? 'provider_after_cutoff' : null;
    return { source, identifierValid, recordedStatus: status, arrival, provider,
      rejection, timingExclusion, quarantined: group !== undefined, issues };
  });

  const quarantinedRecords: QuarantinedRecord[] = inspected.filter(row => row.quarantined).map(row => ({
    source: row.source, reason: 'duplicate_identifier', duplicateId: row.source.value.encounter_id,
    groupRecordNumbers: [...duplicates.get(row.source.value.encounter_id)!], issues: row.issues,
  }));
  // An invalid cutoff is not silently treated as absent. Diagnostics survive, acceptance waits.
  const accepted = cutoff.kind === 'valid' ? inspected.filter(row => !row.quarantined && row.rejection === null) : null;
  const rejected = cutoff.kind === 'valid' ? inspected.filter(row => !row.quarantined && row.rejection !== null) : null;
  const cohorts: Record<PeriodId, InspectedEncounter[]> = { A: [], B: [] };
  const outside: InspectedEncounter[] = [];
  if (accepted && periods.kind === 'valid') {
    for (const row of accepted) {
      if (row.arrival.kind !== 'valid') throw new Error('Accepted record lacks a valid arrival.');
      const cohort = assignArrival(row.arrival.epochMs, periods);
      if (cohort === 'outside') outside.push(row);
      else cohorts[cohort].push(row);
    }
  }
  const ready = accepted !== null && rejected !== null && periods.kind === 'valid';
  const allRecordIssues = inspected.flatMap(row => row.issues);
  const quality: DataQualityResults = {
    globalDiagnostics: diagnostics(allRecordIssues, null),
    duplicateGroups, quarantinedRecords,
    rawSeenUnusableArrival: recordCount(inspected.filter(row => row.recordedStatus === 'seen' &&
      (row.arrival.kind !== 'valid' || (cutoffMs !== null && row.arrival.epochMs > cutoffMs))).map(row => row.source.recordNumber)),
    accounting: ready ? {
      parsedNonblank: sources.length, skippedBlank: input.skippedBlank,
      duplicateQuarantined: recordCount(quarantinedRecords.map(row => row.source.recordNumber)),
      invalidIdentity: recordCount(rejected.filter(row => row.rejection === 'invalid_identity').map(row => row.source.recordNumber)),
      unusableArrival: recordCount(rejected.filter(row => row.rejection === 'unusable_arrival').map(row => row.source.recordNumber)),
      outsidePeriods: recordCount(outside.map(row => row.source.recordNumber)),
      periodA: recordCount(cohorts.A.map(row => row.source.recordNumber)),
      periodB: recordCount(cohorts.B.map(row => row.source.recordNumber)),
    } : null,
    periods: ready ? { A: periodQuality('A', cohorts.A), B: periodQuality('B', cohorts.B) } : null,
  };
  return {
    kind: ready ? 'validated' : 'blocked_configuration',
    source: { ...input.source }, inspected, accepted, rejected,
    cohorts: ready ? cohorts : null, outsidePeriods: ready ? outside : null,
    configurationIssues: configIssues, quality,
    coverage: { metadata: structuredClone(configuration.coverage), independentlyVerifiedHospitalCoverage: false },
  };
}
