/** Strict FG-DATA-1 parsing; never normalizes an invalid calendar value. */
export type TimestampResult =
  | { readonly kind: 'valid'; readonly epochMs: number }
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid' };

export function parseUtcTimestamp(value: string): TimestampResult {
  if (value === '') return { kind: 'missing' };
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
  // $ can match before a final newline: require the entire source string.
  if (!match || match[0] !== value) return { kind: 'invalid' };
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  const millis = Number(match[7] ?? 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return { kind: 'invalid' };
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (days === undefined || day > days) return { kind: 'invalid' };
  // Date.UTC treats 0–99 specially; setUTCFullYear preserves years 0001–0099.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);
  return { kind: 'valid', epochMs: date.getTime() };
}
