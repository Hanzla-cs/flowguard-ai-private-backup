import { parse } from 'csv-parse/browser/esm/sync';
import type { EncounterField, SourceRecord, ValidationIssue, CsvIngestionResult } from '../core/contracts';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_DATA_RECORDS = 10000;
export const ENCOUNTER_HEADERS = [
  'encounter_id', 'arrival_at_utc', 'first_provider_at_utc', 'provider_status',
] as const satisfies readonly EncounterField[];

function fatal(code: ValidationIssue['code'], message: string, recordNumber?: number): ValidationIssue {
  return { code, message, severity: 'fatal', scope: 'file',
    recordNumbers: recordNumber === undefined ? [] : [recordNumber], fields: [], effects: ['block_file'] };
}

class IngestionFailure extends Error {
  constructor(readonly issues: readonly ValidationIssue[]) { super('CSV ingestion blocked'); }
}

/** UTF-8 bytes, not a pre-normalized string. Only successful full parses expose records. */
export async function parseCsv(input: Uint8Array, name = 'upload.csv'): Promise<CsvIngestionResult> {
  if (input.byteLength > MAX_FILE_BYTES) {
    return { kind: 'fatal', issues: [fatal('file_size_limit', 'CSV exceeds the 2 MiB limit.')] };
  }
  const bytes = new Uint8Array(input); // Snapshot before the asynchronous checksum.
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return { kind: 'fatal', issues: [fatal('invalid_utf8', 'CSV must contain valid UTF-8 bytes.')] };
  }
  let logicalNumber = 0, skippedBlank = 0;
  let positions: Record<EncounterField, number> | null = null;
  const records: SourceRecord[] = [];
  try {
    parse(text, {
      bom: true, delimiter: ',', record_delimiter: ['\r\n', '\n'],
      columns: false, cast: false, trim: false, relax_quotes: false,
      skip_empty_lines: false, skip_records_with_error: false,
      // Width is checked below so genuinely blank records can be counted/skipped.
      // No nonblank inconsistent-width record is accepted.
      relax_column_count: true, raw: true,
      on_record(entry: unknown) {
        // The parser's declarations do not specialize the callback for raw:true.
        if (typeof entry !== 'object' || entry === null || !('record' in entry) ||
            !Array.isArray(entry.record) || !entry.record.every((cell: unknown) => typeof cell === 'string') ||
            !('raw' in entry) || typeof entry.raw !== 'string') {
          throw new Error('Unexpected raw CSV parser output.');
        }
        logicalNumber += 1;
        const cells: string[] = entry.record;
        if (logicalNumber === 1) {
          if (cells.length === 1 && cells[0] === '') {
            throw new IngestionFailure([fatal('missing_header', 'The first logical record must contain the required headers.', 1)]);
          }
          const issues: ValidationIssue[] = [];
          if (new Set(cells).size !== cells.length) issues.push(fatal('duplicate_header', 'CSV headers must be unique.', 1));
          if (ENCOUNTER_HEADERS.some(field => !cells.includes(field))) issues.push(fatal('missing_column', 'One or more required encounter headers are missing.', 1));
          if (cells.some(field => !(ENCOUNTER_HEADERS as readonly string[]).includes(field))) issues.push(fatal('unexpected_column', 'CSV contains an unexpected header.', 1));
          if (issues.length) throw new IngestionFailure(issues);
          positions = Object.fromEntries(ENCOUNTER_HEADERS.map(field => [field, cells.indexOf(field)])) as Record<EncounterField, number>;
          return null;
        }
        // csv-parse raw output retains only CR for a CRLF record separator.
        if (cells.length === 1 && cells[0] === '' &&
            (entry.raw === '\n' || entry.raw === '\r\n' || entry.raw === '\r' || entry.raw === '')) {
          skippedBlank += 1;
          return null;
        }
        if (cells.length !== ENCOUNTER_HEADERS.length) {
          throw new IngestionFailure([fatal('inconsistent_field_count', 'Each nonblank data record must have exactly four fields.', logicalNumber)]);
        }
        if (records.length === MAX_DATA_RECORDS) {
          throw new IngestionFailure([fatal('record_count_limit', 'CSV exceeds 10,000 nonblank data records.', logicalNumber)]);
        }
        if (!positions) throw new Error('Header positions unavailable after header validation.');
        // The width/header checks guarantee every indexed string exists.
        const field = (key: EncounterField): string => cells[positions![key]]!;
        records.push({ recordNumber: logicalNumber, value: {
          encounter_id: field('encounter_id'), arrival_at_utc: field('arrival_at_utc'),
          first_provider_at_utc: field('first_provider_at_utc'), provider_status: field('provider_status'),
        } });
        return null; // Avoid a second accumulated parser result array.
      },
    });
    if (logicalNumber === 0) throw new IngestionFailure([fatal('missing_header', 'CSV is empty or has no header.', 1)]);
  } catch (error) {
    if (error instanceof IngestionFailure) return { kind: 'fatal', issues: error.issues };
    if (error instanceof Error && 'code' in error) {
      return { kind: 'fatal', issues: [fatal('malformed_csv', 'Malformed CSV quoting or record structure.', logicalNumber + 1)] };
    }
    throw error; // Do not disguise programming errors as bad user data.
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { kind: 'parsed', source: { name, byteLength: bytes.byteLength, sha256 },
    records, skippedBlank, issues: [] };
}
