import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { ENCOUNTER_HEADERS, MAX_FILE_BYTES, parseCsv } from '../src/input/parse-csv';
import { csvCases } from './fixtures/csv-cases';

const header = ENCOUNTER_HEADERS.join(',');
const row = 'F1,2026-10-05T12:00:00Z,2026-10-05T12:10:00Z,seen';
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('strict full-file CSV ingestion', () => {
  for (const fixture of csvCases) {
    it(fixture.id, async () => {
      const result = await parseCsv(bytes(fixture.text));
      expect(result.kind).toBe(fixture.expected.metricsBlocked ? 'fatal' : 'parsed');
      if (fixture.expected.issue) expect(result.issues.map(issue => issue.code)).toContain(fixture.expected.issue);
      if (result.kind === 'parsed') expect(result.records).toEqual([]);
    });
  }

  it('supports reordered quoted headers and fields without coercion', async () => {
    const result = await parseCsv(bytes('"provider_status","first_provider_at_utc","encounter_id","arrival_at_utc"\r\n"seen","2026-10-05T12:10:00Z","001","2026-10-05T12:00:00Z"\r\n'));
    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') return;
    expect(result.records).toEqual([{ recordNumber: 2, value: {
      encounter_id: '001', arrival_at_utc: '2026-10-05T12:00:00Z',
      first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'seen',
    } }]);
  });

  it('preserves quoted commas, escaped quotes and multiline raw field values', async () => {
    const result = await parseCsv(bytes(header + '\n"a,b","line1\nline2","a""b"," seen "\n' + row));
    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') return;
    expect(result.records[0]).toEqual({ recordNumber: 2, value: {
      encounter_id: 'a,b', arrival_at_utc: 'line1\nline2', first_provider_at_utc: 'a"b', provider_status: ' seen ',
    } });
    expect(result.records[1]?.recordNumber).toBe(3);
  });

  it.each(['\n', '\r\n'])('counts blank logical records and preserves later record numbers for %j', async newline => {
    const result = await parseCsv(bytes(header + newline + newline + row + newline + ',,,' + newline));
    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') return;
    expect(result.skippedBlank).toBe(1);
    expect(result.records.map(record => record.recordNumber)).toEqual([3, 4]);
    expect(Object.values(result.records[1]!.value)).toEqual(['', '', '', '']);
  });

  it('supports a BOM and hashes original bytes, not normalized text', async () => {
    const input = bytes('\uFEFF' + header + '\n' + row);
    const result = await parseCsv(input, 'fictional.csv');
    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') return;
    expect(result.source).toEqual({ name: 'fictional.csv', byteLength: input.byteLength, sha256: createHash('sha256').update(input).digest('hex') });
    expect(result.records).toHaveLength(1);
  });

  it('snapshots input bytes before asynchronous hashing', async () => {
    const input = bytes(header + '\n' + row);
    const hash = createHash('sha256').update(input).digest('hex');
    const pending = parseCsv(input);
    input.fill(0);
    const result = await pending;
    expect(result.kind).toBe('parsed');
    if (result.kind === 'parsed') expect(result.source.sha256).toBe(hash);
  });

  it.each([
    [header.replace('provider_status', 'unexpected'), 'missing_column'],
    [header + ',extra', 'unexpected_column'],
    [header + '\nF1,too,few', 'inconsistent_field_count'],
    [header + '\n' + row + ',extra', 'inconsistent_field_count'],
    [header + '\nF"1,a,b,seen', 'malformed_csv'],
    [header + '\n"F1"trailing,a,b,seen', 'malformed_csv'],
    [header + '\n"F1" ,a,b,seen', 'malformed_csv'],
    [header + '\n""', 'inconsistent_field_count'],
    [header + '\n ', 'inconsistent_field_count'],
    ['\n' + header, 'missing_header'],
  ])('rejects structural errors: %s', async (text, code) => {
    const result = await parseCsv(bytes(text));
    expect(result.kind).toBe('fatal');
    expect(result.issues.map(issue => issue.code)).toContain(code);
    expect('records' in result).toBe(false);
  });

  it('reports malformed logical record after a valid multiline record, with no partial result', async () => {
    const result = await parseCsv(bytes(header + '\n"multi\nline",a,b,seen\n"unclosed'));
    expect(result.kind).toBe('fatal');
    expect(result.issues[0]?.recordNumbers).toEqual([3]);
    expect('records' in result).toBe(false);
  });

  it('rejects invalid UTF-8 instead of replacement decoding', async () => {
    expect((await parseCsv(new Uint8Array([0xc3, 0x28]))).issues[0]?.code).toBe('invalid_utf8');
  });

  it('enforces the byte limit including multibyte input, before parsing', async () => {
    const tooLarge = bytes('é'.repeat(MAX_FILE_BYTES / 2 + 1));
    expect((await parseCsv(tooLarge)).issues[0]?.code).toBe('file_size_limit');
    const prefix = header + '\n';
    const suffix = ',2026-10-05T12:00:00Z,,unknown';
    const exact = bytes(prefix + 'x'.repeat(MAX_FILE_BYTES - prefix.length - suffix.length) + suffix);
    expect(exact.byteLength).toBe(MAX_FILE_BYTES);
    expect((await parseCsv(exact)).kind).toBe('parsed'); // ID validity is a record-layer concern.
  });

  it('accepts exactly 10,000 records and rejects 10,001 without exposing a prefix', async () => {
    // In-memory limit test only; not the main synthetic demonstration dataset.
    const text = header + '\n' + Array.from({ length: 10000 }, (_, i) => `L${i},2026-10-05T12:00:00Z,,unknown`).join('\n');
    const accepted = await parseCsv(bytes(text));
    expect(accepted.kind).toBe('parsed');
    if (accepted.kind === 'parsed') expect(accepted.records).toHaveLength(10000);
    const rejected = await parseCsv(bytes(text + '\n' + row));
    expect(rejected.kind).toBe('fatal');
    expect(rejected.issues[0]?.code).toBe('record_count_limit');
    expect(rejected.issues[0]?.recordNumbers).toEqual([10002]);
    expect('records' in rejected).toBe(false);
  });
});
