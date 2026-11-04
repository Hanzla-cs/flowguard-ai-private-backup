/**
 * Independently authored, tiny fictional records. No academic inputs or generator.
 * Each array position represents logical CSV record index + 2 (header is 1).
 * Only raw encounter records have the four CSV fields; metadata is separate.
 */
import type { AnalysisConfiguration, RawEncounterRecord } from '../../src/core/contracts';

export interface FixtureCase {
  readonly id: string;
  readonly description: string;
  readonly records: readonly RawEncounterRecord[];
  readonly configuration: AnalysisConfiguration;
}

/** Fixture-only identity sentinel; not a real dataset checksum or integrity proof. */
export const fixtureSourceSha256 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export const explicitConfiguration = {
  periods: {
    kind: 'explicit',
    confirmedForSourceSha256: fixtureSourceSha256,
    origin: 'user_selection',
    A: { id: 'A', startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-12T00:00:00Z' },
    B: { id: 'B', startUtc: '2026-10-12T00:00:00Z', endUtcExclusive: '2026-10-19T00:00:00Z' },
  },
  observationCutoff: {
    atUtc: '2026-10-20T00:00:00Z',
    provenance: { source: 'run_configuration', reference: 'FG-VERIFY-1 fixture cutoff' },
  },
  coverage: { kind: 'unverified' },
} as const satisfies AnalysisConfiguration;

export const primaryRecords = [
  { encounter_id: 'A1', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'seen' },
  { encounter_id: 'A2', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:20:00Z', provider_status: 'seen' },
  { encounter_id: 'A3', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:30:00Z', provider_status: 'seen' },
  { encounter_id: 'A4', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:40:00Z', provider_status: 'seen' },
  { encounter_id: 'A5', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '', provider_status: 'not_seen' },
  { encounter_id: 'A6', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '', provider_status: 'unknown' },
  { encounter_id: 'B1', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '2026-10-12T12:10:00Z', provider_status: 'seen' },
  { encounter_id: 'B2', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '2026-10-12T12:20:00Z', provider_status: 'seen' },
  { encounter_id: 'B3', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '2026-10-12T11:55:00Z', provider_status: 'seen' },
  { encounter_id: 'B4', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '', provider_status: 'seen' },
  { encounter_id: 'B5', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '', provider_status: 'not_seen' },
  { encounter_id: 'B6', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '', provider_status: 'unknown' },
] as const satisfies readonly RawEncounterRecord[];

const validRecords = [
  { encounter_id: 'V1', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'seen' },
  { encounter_id: 'V2', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:20:00Z', provider_status: 'seen' },
  { encounter_id: 'V3', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:40:00Z', provider_status: 'seen' },
] as const satisfies readonly RawEncounterRecord[];

export const fixtureCases = [
  { id: 'primary', description: 'Approved six-per-period example and misleading median decrease.', records: primaryRecords, configuration: explicitConfiguration },
  { id: 'valid', description: 'Three valid waits with a manually known odd median.', records: validRecords, configuration: explicitConfiguration },
  {
    id: 'missing', description: 'One unassignable seen arrival and one countable seen record without provider time.',
    records: [
      { encounter_id: 'M1', arrival_at_utc: '', first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'seen' },
      { encounter_id: 'M2', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '', provider_status: 'seen' },
    ], configuration: explicitConfiguration,
  },
  {
    id: 'chronology', description: 'A populated parse-valid provider time five minutes before arrival.',
    records: [
      { encounter_id: 'C1', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T11:55:00Z', provider_status: 'seen' },
    ], configuration: explicitConfiguration,
  },
  {
    id: 'duplicate-identical', description: 'Primary fixture plus identical A1 at logical record 14.',
    records: [
      ...primaryRecords,
      { encounter_id: 'A1', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'seen' },
    ], configuration: explicitConfiguration,
  },
  {
    id: 'duplicate-conflicting', description: 'Primary fixture plus conflicting A1 in B; quarantine precedes period filtering.',
    records: [
      ...primaryRecords,
      { encounter_id: 'A1', arrival_at_utc: '2026-10-12T12:00:00Z', first_provider_at_utc: '2026-10-12T12:50:00Z', provider_status: 'seen' },
    ], configuration: explicitConfiguration,
  },
  {
    id: 'contradictory', description: 'Populated provider values contradict not_seen and unknown; invalid status remains distinct.',
    records: [
      { encounter_id: 'S1', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:10:00Z', provider_status: 'not_seen' },
      { encounter_id: 'S2', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:20:00Z', provider_status: 'unknown' },
      { encounter_id: 'S3', arrival_at_utc: '2026-10-05T12:00:00Z', first_provider_at_utc: '2026-10-05T12:30:00Z', provider_status: 'SEEN' },
    ], configuration: explicitConfiguration,
  },
  { id: 'empty', description: 'No data records after a valid header; not a missing-header file.', records: [], configuration: explicitConfiguration },
  {
    id: 'boundaries', description: 'Half-open arrival cohorts and provider contact after the cohort end.',
    records: [
      { encounter_id: 'P1', arrival_at_utc: '2026-10-05T00:00:00Z', first_provider_at_utc: '2026-10-05T00:00:00Z', provider_status: 'seen' },
      { encounter_id: 'P2', arrival_at_utc: '2026-10-12T00:00:00Z', first_provider_at_utc: '2026-10-12T00:10:00Z', provider_status: 'seen' },
      { encounter_id: 'P3', arrival_at_utc: '2026-10-19T00:00:00Z', first_provider_at_utc: '2026-10-19T00:10:00Z', provider_status: 'seen' },
      { encounter_id: 'P4', arrival_at_utc: '2026-10-04T23:59:59.999Z', first_provider_at_utc: '2026-10-05T00:00:00Z', provider_status: 'seen' },
      { encounter_id: 'P5', arrival_at_utc: '2026-10-11T23:50:00Z', first_provider_at_utc: '2026-10-12T00:10:00Z', provider_status: 'seen' },
    ], configuration: explicitConfiguration,
  },
  {
    id: 'partial-coverage', description: 'Same valid encounters with two overlapping declared collection intervals.',
    records: validRecords,
    configuration: {
      ...explicitConfiguration,
      coverage: {
        kind: 'declared',
        intervals: [
          { startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-07T00:00:00Z' },
          { startUtc: '2026-10-06T00:00:00Z', endUtcExclusive: '2026-10-08T00:00:00Z' },
        ],
        encounterCapture: 'declared_partial',
        provenance: { source: 'uploader', reference: 'Fictional fixture declaration, not independent verification' },
        syntheticReproduction: 'not_applicable',
      },
    },
  },
  { id: 'unverified-coverage', description: 'Same valid encounters without coverage metadata.', records: validRecords, configuration: explicitConfiguration },
  {
    id: 'unselected-periods', description: 'An upload without confirmed periods must not receive synthetic defaults.',
    records: validRecords,
    configuration: { ...explicitConfiguration, periods: { kind: 'unselected' } },
  },
] as const satisfies readonly FixtureCase[];
