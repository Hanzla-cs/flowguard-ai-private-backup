import { describe, expect, it } from 'vitest';
import { parseUtcTimestamp } from '../src/core/timestamps';

describe('strict UTC timestamps', () => {
  it.each([
    ['2026-10-05T12:00:00Z', 1791201600000],
    ['1970-01-01T00:00:00Z', 0],
    ['1970-01-01T00:00:00.001Z', 1],
    ['1969-12-31T23:59:59.999Z', -1],
  ])('parses %s without local timezone assumptions', (value, epochMs) => {
    expect(parseUtcTimestamp(value)).toEqual({ kind: 'valid', epochMs });
  });
  it.each(['0001-01-01T00:00:00Z', '0099-12-31T23:59:59Z', '2000-02-29T00:00:00Z', '2024-02-29T00:00:00Z', '9999-12-31T23:59:59.999Z'])('round trips valid calendar %s', value => {
    const result = parseUtcTimestamp(value);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') expect(new Date(result.epochMs).toISOString()).toBe(value.replace(/(?<!\.\d{3})Z$/, '.000Z'));
  });
  it.each([
    '2026-02-30T12:00:00Z', '1900-02-29T00:00:00Z', '2026-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z', '0000-01-01T00:00:00Z', '10000-01-01T00:00:00Z',
    '2026-00-01T00:00:00Z', '2026-13-01T00:00:00Z', '2026-01-00T00:00:00Z',
    '2026-01-01T24:00:00Z', '2026-01-01T00:60:00Z', '2026-01-01T00:00:60Z',
    '2026-01-01T00:00:00', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00z',
    '2026-01-01 00:00:00Z', '2026-01-01T00:00:00.1Z', '2026-01-01T00:00:00.0000Z',
    '2026-01-01T00:00:00Z\n', ' 2026-01-01T00:00:00Z', 'null', 'N/A', ' ',
  ])('rejects %s without repair', value => expect(parseUtcTimestamp(value)).toEqual({ kind: 'invalid' }));
  it('distinguishes an empty field from malformed text', () => expect(parseUtcTimestamp('')).toEqual({ kind: 'missing' }));
});
