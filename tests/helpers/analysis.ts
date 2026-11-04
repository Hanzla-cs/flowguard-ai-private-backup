import type { AnalysisConfiguration, CalculatedEvidenceReport, CsvParsed, EvidenceReport, RawEncounterRecord } from '../../src/core/contracts';
import { ENCOUNTER_HEADERS, parseCsv } from '../../src/input/parse-csv';
import { analyze } from '../../src/core/analyze';
import { explicitConfiguration } from '../fixtures/cases';

/** Test input serialization only; never computes the expected analytical values. */
export async function prepare(records: readonly RawEncounterRecord[], config: AnalysisConfiguration = explicitConfiguration): Promise<{ input: CsvParsed; config: AnalysisConfiguration }> {
  const quote = (text: string): string => '"' + text.replaceAll('"', '""') + '"';
  const csv = ENCOUNTER_HEADERS.join(',') + '\n' + records.map(row => ENCOUNTER_HEADERS.map(field => quote(row[field])).join(',')).join('\n');
  const input = await parseCsv(new TextEncoder().encode(csv), 'independent-analytical-fixture.csv');
  if (input.kind !== 'parsed') throw new Error('Unexpected fixture structural failure.');
  return { input, config: { ...config, periods: config.periods.kind === 'explicit'
    ? { ...config.periods, confirmedForSourceSha256: input.source.sha256 } : config.periods } };
}
export async function reportFor(records: readonly RawEncounterRecord[], config: AnalysisConfiguration = explicitConfiguration): Promise<EvidenceReport> {
  const prepared = await prepare(records, config);
  return analyze(prepared.input, prepared.config);
}
export function calculated(report: EvidenceReport): CalculatedEvidenceReport {
  if (report.status === 'blocked_by_file_or_configuration_error') throw new Error('Expected calculable report.');
  return report;
}
export function encounter(id: string, arrival: string, provider: string, status = 'seen'): RawEncounterRecord {
  return { encounter_id: id, arrival_at_utc: arrival, first_provider_at_utc: provider, provider_status: status };
}
export function assertFiniteTree(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite numeric output.');
  if (Array.isArray(value)) value.forEach(assertFiniteTree);
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(assertFiniteTree);
}
