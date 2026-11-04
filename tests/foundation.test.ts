import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  BlockedEvidenceReport, ComparisonSelection, CoverageEvidence,
  EncounterRecord, MetricResult, ProviderStatus, RawEncounterRecord,
} from '../src/core/contracts';
import { fixtureCases } from './fixtures/cases';

describe('foundation smoke and compile-time contracts (no engine)', () => {
  it('runs Vitest in Node and loads independent fixtures', () => {
    expect(process.versions.node.split('.')[0]).toBe('24');
    expect(fixtureCases).toHaveLength(12);
  });

  it('retains exactly four raw fields and three valid provider statuses', () => {
    expectTypeOf<keyof RawEncounterRecord>().toEqualTypeOf<
      'encounter_id' | 'arrival_at_utc' | 'first_provider_at_utc' | 'provider_status'
    >();
    expectTypeOf<ProviderStatus>().toEqualTypeOf<'seen' | 'not_seen' | 'unknown'>();
    expectTypeOf<EncounterRecord['provider_status']>().toEqualTypeOf<ProviderStatus>();
    expectTypeOf<RawEncounterRecord['provider_status']>().toEqualTypeOf<string>();
  });

  it('represents missing configuration and unavailable/blocked values explicitly', () => {
    expectTypeOf<Extract<ComparisonSelection, { kind: 'unselected' }>>()
      .toEqualTypeOf<{ readonly kind: 'unselected' }>();
    expectTypeOf<Extract<MetricResult, { status: 'unavailable' }>['value']>().toEqualTypeOf<null>();
    expectTypeOf<BlockedEvidenceReport['metrics']>().toEqualTypeOf<null>();
    expectTypeOf<BlockedEvidenceReport['comparisons']>().toEqualTypeOf<null>();
  });

  it('cannot label declared coverage independently verified through the contract', () => {
    expectTypeOf<CoverageEvidence['independentlyVerifiedHospitalCoverage']>().toEqualTypeOf<false>();
  });
});
