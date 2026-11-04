/**
 * Literal CSV failure examples for a future parser. No parser is implemented here.
 * Shape checks only establish that these examples retain their intended defects.
 */
export const csvCases = [
  {
    id: 'header-only',
    text: 'encounter_id,arrival_at_utc,first_provider_at_utc,provider_status\n',
    expected: { scope: 'valid_empty', metricsBlocked: false, issue: null },
  },
  {
    id: 'no-header',
    text: '',
    expected: { scope: 'fatal_file', metricsBlocked: true, issue: 'missing_header' },
  },
  {
    id: 'duplicate-header',
    text: 'encounter_id,arrival_at_utc,arrival_at_utc,provider_status\n',
    expected: { scope: 'fatal_file', metricsBlocked: true, issue: 'duplicate_header' },
  },
  {
    id: 'wrong-width',
    text: 'encounter_id,arrival_at_utc,first_provider_at_utc,provider_status\nF1,2026-10-05T12:00:00Z,seen\n',
    expected: { scope: 'fatal_file', metricsBlocked: true, issue: 'inconsistent_field_count' },
  },
  {
    id: 'unclosed-quote',
    text: 'encounter_id,arrival_at_utc,first_provider_at_utc,provider_status\n"F1,2026-10-05T12:00:00Z,,seen\n',
    expected: { scope: 'fatal_file', metricsBlocked: true, issue: 'malformed_csv' },
  },
] as const;
