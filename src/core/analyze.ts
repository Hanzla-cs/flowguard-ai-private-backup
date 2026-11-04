import type { AnalysisConfiguration, CsvParsed, EvidenceReport, RunIdentity } from './contracts';
import { comparePeriods } from './compare';
import { coverageEvidence } from './coverage';
import { calculatePeriodMetrics } from './metrics';
import { validateEncounters } from './validate';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const text = JSON.stringify(value);
    if (text === undefined) throw new TypeError('Unsupported analytical configuration value.');
    return text;
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
}

/**
 * Single analytical entry point after successful Phase 3A parseCsv ingestion.
 * Fatal CSV failures remain ingestion results; never pass them as parsed data.
 * Snapshot inputs, reuse Phase 3A validation, then return only structured evidence.
 */
export async function analyze(input: CsvParsed, configuration: AnalysisConfiguration): Promise<EvidenceReport> {
  const source = structuredClone(input);
  const config = structuredClone(configuration);
  const validation = validateEncounters(source, config);
  const coverage = coverageEvidence(validation, config);
  const limitations = [
    'Encounter counts describe supplied accepted records, not a verified hospital census.',
    'Findings are descriptive only; no clinical validity, causation, significance or operational improvement is established.',
    'Review timing eligibility and seen timestamp completeness alongside median differences.',
    ...coverage.limitations,
  ];
  if (validation.quality.quarantinedRecords.length) limitations.push('All records with duplicated valid IDs are quarantined and excluded from aggregates.');
  if (validation.rejected?.length) limitations.push('Identity/arrival-invalid records are excluded globally; their intended periods cannot be assumed.');
  if (validation.accepted?.length === 0 && source.records.length > 0) {
    limitations.push('All supplied records are quarantined or rejected; zero accepted counts do not mean zero actual encounters.');
  }
  if (config.observationCutoff === null) limitations.push('Observation cutoff is unknown; completeness of provider follow-up is unverified.');
  else limitations.push('Observation cutoff is declared metadata, not independent confirmation of outcome completeness.');

  const specification = { data: 'FG-DATA-1', metrics: 'FG-METRIC-1' } as const;
  const fingerprintBytes = new TextEncoder().encode(canonicalJson({ source: source.source.sha256, specification, configuration: config }));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', fingerprintBytes);
  const configurationFingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const run: RunIdentity = { source: source.source, specification, configurationFingerprint, configuration: config };
  const base = {
    run, quality: validation.quality, coverage, limitations,
    kind: 'deterministic_evidence' as const, interpretation: 'descriptive_only' as const,
    validationSummary: {
      parsedNonblank: source.records.length, skippedBlank: source.skippedBlank,
      accepted: validation.accepted?.length ?? null, rejected: validation.rejected?.length ?? null,
      quarantined: validation.quality.quarantinedRecords.length, configurationIssues: validation.configurationIssues,
    },
  };
  if (validation.kind !== 'validated' || config.periods.kind !== 'explicit') {
    return { ...base, status: 'blocked_by_file_or_configuration_error', blockingIssues: validation.configurationIssues,
      metrics: null, comparisons: null };
  }
  const A = calculatePeriodMetrics(validation, config.periods.A, limitations);
  const B = calculatePeriodMetrics(validation, config.periods.B, limitations);
  return { ...base, status: 'calculated_with_limitations', metrics: { A, B }, comparisons: comparePeriods(A, B) };
}
