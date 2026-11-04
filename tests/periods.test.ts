import { describe, expect, it } from 'vitest';
import type { ComparisonSelection } from '../src/core/contracts';
import { assignArrival, demonstrationPeriods, validateObservationCutoff, validatePeriods } from '../src/core/periods';

const hash = 'a'.repeat(64);
function selection(): Extract<ComparisonSelection, { kind: 'explicit' }> {
  const value = demonstrationPeriods(hash);
  if (value.kind !== 'explicit') throw new Error('Demonstration helper must return explicit periods');
  return value;
}

describe('explicit comparison configuration', () => {
  it('retains the demonstration dates only through explicit opt-in', () => {
    expect(selection().A.startUtc).toBe('2026-10-05T00:00:00Z');
    expect(selection().B.endUtcExclusive).toBe('2026-10-19T00:00:00Z');
    expect(validatePeriods({ kind: 'unselected' }, hash).issues[0]?.code).toBe('period_selection_required');
  });

  it.each([
    ['2026-10-04T23:59:59.999Z', 'outside'],
    ['2026-10-05T00:00:00Z', 'A'],
    ['2026-10-11T23:59:59.999Z', 'A'],
    ['2026-10-12T00:00:00Z', 'B'],
    ['2026-10-19T00:00:00Z', 'outside'],
  ])('assigns arrival %s to %s', (arrival, cohort) => {
    const result = validatePeriods(selection(), hash);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') expect(assignArrival(Date.parse(arrival), result)).toBe(cohort);
  });

  it('permits a gap and does not swap chronologically reversed A/B labels', () => {
    const base = selection();
    const gap = { ...base, B: { id: 'B' as const, startUtc: '2026-10-19T00:00:00Z', endUtcExclusive: '2026-10-26T00:00:00Z' } };
    const result = validatePeriods(gap, hash);
    expect(result.kind).toBe('valid');
    if (result.kind === 'valid') expect(assignArrival(Date.parse('2026-10-15T00:00:00Z'), result)).toBe('outside');
    const reversed = { ...base, A: { ...gap.B, id: 'A' as const }, B: { ...base.A, id: 'B' as const } };
    const reverseResult = validatePeriods(reversed, hash);
    expect(reverseResult.kind).toBe('valid');
    if (reverseResult.kind === 'valid') expect(assignArrival(Date.parse('2026-10-05T00:00:00Z'), reverseResult)).toBe('B');
  });

  it('rejects overlap, including identical periods', () => {
    const base = selection();
    for (const B of [
      { id: 'B' as const, startUtc: '2026-10-11T00:00:00Z', endUtcExclusive: '2026-10-18T00:00:00Z' },
      { ...base.A, id: 'B' as const },
    ]) expect(validatePeriods({ ...base, B }, hash).issues[0]?.code).toBe('overlapping_periods');
  });

  it.each([
    ['2026-10-05T00:00:00Z', '2026-10-11T00:00:00Z'],
    ['2026-10-05T00:00:00Z', '2026-10-13T00:00:00Z'],
    ['2026-10-05T01:00:00Z', '2026-10-12T01:00:00Z'],
    ['2026-10-05T00:00:00.001Z', '2026-10-12T00:00:00.001Z'],
    ['2026-10-05T00:00:00+00:00', '2026-10-12T00:00:00Z'],
    ['2026-02-30T00:00:00Z', '2026-03-09T00:00:00Z'],
    ['2026-10-12T00:00:00Z', '2026-10-05T00:00:00Z'],
  ])('rejects invalid period bounds %s / %s', (startUtc, endUtcExclusive) => {
    expect(validatePeriods({ ...selection(), A: { id: 'A', startUtc, endUtcExclusive } }, hash).issues[0]?.code).toBe('invalid_period');
  });

  it('rejects period confirmation for other source bytes', () => {
    expect(validatePeriods(selection(), 'b'.repeat(64)).issues[0]?.code).toBe('period_source_mismatch');
    expect(validatePeriods({ ...selection(), confirmedForSourceSha256: hash + '\n' }, hash + '\n').kind).toBe('blocked');
  });

  it('rejects an inconsistent period label and a nonfinite assignment input', () => {
    const base = selection();
    const malformed = { ...base, A: { ...base.A, id: 'B' } } as unknown as ComparisonSelection;
    expect(validatePeriods(malformed, hash).kind).toBe('blocked');
    const valid = validatePeriods(base, hash);
    if (valid.kind !== 'valid') throw new Error('Invalid test setup');
    expect(() => assignArrival(NaN, valid)).toThrow(TypeError);
  });
});

describe('observation cutoff configuration', () => {
  it('allows explicit absence without inferring a cutoff', () => {
    expect(validateObservationCutoff(null)).toEqual({ kind: 'valid', epochMs: null, issues: [] });
  });

  it('requires a valid UTC cutoff and provenance', () => {
    expect(validateObservationCutoff({
      atUtc: '2026-10-20T00:00:00Z', provenance: { source: 'uploader', reference: 'fictional declaration' },
    }).kind).toBe('valid');
    for (const [atUtc, reference] of [['', 'declared'], ['2026-02-30T00:00:00Z', 'declared'], ['2026-10-20T00:00:00Z', ' ']]) {
      expect(validateObservationCutoff({
        atUtc: atUtc!, provenance: { source: 'uploader', reference: reference! },
      }).issues[0]?.code).toBe('invalid_observation_cutoff');
    }
  });
});
