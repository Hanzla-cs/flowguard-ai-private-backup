import type {
  ComparisonSelection, ObservationCutoff, PeriodId, ValidationIssue,
} from './contracts';
import { parseUtcTimestamp } from './timestamps';

export const SEVEN_DAYS_MS = 168 * 60 * 60 * 1000;

/** Explicit opt-in demonstration configuration; never a fallback for uploads. */
export function demonstrationPeriods(sourceSha256: string): ComparisonSelection {
  return {
    kind: 'explicit', origin: 'synthetic_scenario', confirmedForSourceSha256: sourceSha256,
    A: { id: 'A', startUtc: '2026-10-05T00:00:00Z', endUtcExclusive: '2026-10-12T00:00:00Z' },
    B: { id: 'B', startUtc: '2026-10-12T00:00:00Z', endUtcExclusive: '2026-10-19T00:00:00Z' },
  };
}

export type ValidatedPeriods =
  | { readonly kind: 'blocked'; readonly issues: readonly ValidationIssue[] }
  | {
      readonly kind: 'valid';
      readonly bounds: Readonly<Record<PeriodId, { readonly startMs: number; readonly endMs: number }>>;
      readonly issues: readonly [];
    };

function configurationIssue(code: ValidationIssue['code'], message: string): ValidationIssue {
  return { code, message, scope: 'configuration', severity: 'error',
    recordNumbers: [], fields: [], effects: ['block_period_calculations'] };
}

export function validatePeriods(selection: ComparisonSelection, sourceSha256: string): ValidatedPeriods {
  if (selection.kind !== 'explicit') {
    return { kind: 'blocked', issues: [configurationIssue('period_selection_required', 'Explicit comparison periods are required for this source.')] };
  }
  if (sourceSha256.length !== 64 || !/^[a-f0-9]{64}$/.test(sourceSha256) || selection.confirmedForSourceSha256 !== sourceSha256) {
    return { kind: 'blocked', issues: [configurationIssue('period_source_mismatch', 'Confirm comparison periods for the current source bytes.')] };
  }
  const bounds = {} as Record<PeriodId, { startMs: number; endMs: number }>;
  const issues: ValidationIssue[] = [];
  for (const id of ['A', 'B'] as const) {
    const period = selection[id];
    const start = parseUtcTimestamp(period.startUtc), end = parseUtcTimestamp(period.endUtcExclusive);
    if (period.id !== id || start.kind !== 'valid' || end.kind !== 'valid' ||
        new Date(start.epochMs).getUTCHours() !== 0 || new Date(start.epochMs).getUTCMinutes() !== 0 ||
        new Date(start.epochMs).getUTCSeconds() !== 0 || new Date(start.epochMs).getUTCMilliseconds() !== 0 ||
        new Date(end.epochMs).getUTCHours() !== 0 || new Date(end.epochMs).getUTCMinutes() !== 0 ||
        new Date(end.epochMs).getUTCSeconds() !== 0 || new Date(end.epochMs).getUTCMilliseconds() !== 0 ||
        end.epochMs - start.epochMs !== SEVEN_DAYS_MS) {
      issues.push(configurationIssue('invalid_period', `Period ${id} must have valid UTC-midnight bounds exactly seven days apart.`));
    } else bounds[id] = { startMs: start.epochMs, endMs: end.epochMs };
  }
  if (issues.length) return { kind: 'blocked', issues };
  if (bounds.A.startMs < bounds.B.endMs && bounds.B.startMs < bounds.A.endMs) {
    return { kind: 'blocked', issues: [configurationIssue('overlapping_periods', 'Comparison periods must not overlap.')] };
  }
  return { kind: 'valid', bounds, issues: [] };
}

export function assignArrival(epochMs: number, periods: Extract<ValidatedPeriods, { kind: 'valid' }>): PeriodId | 'outside' {
  if (!Number.isSafeInteger(epochMs)) throw new TypeError('Cohort assignment requires validated integer epoch milliseconds.');
  for (const id of ['A', 'B'] as const) {
    if (epochMs >= periods.bounds[id].startMs && epochMs < periods.bounds[id].endMs) return id;
  }
  return 'outside';
}

export type ValidatedCutoff =
  | { readonly kind: 'valid'; readonly epochMs: number | null; readonly issues: readonly [] }
  | { readonly kind: 'blocked'; readonly issues: readonly ValidationIssue[] };

export function validateObservationCutoff(cutoff: ObservationCutoff | null): ValidatedCutoff {
  if (cutoff === null) return { kind: 'valid', epochMs: null, issues: [] };
  const parsed = parseUtcTimestamp(cutoff.atUtc);
  if (parsed.kind !== 'valid' || !cutoff.provenance.reference.trim() ||
      !['synthetic_manifest', 'uploader', 'run_configuration'].includes(cutoff.provenance.source)) {
    return { kind: 'blocked', issues: [configurationIssue('invalid_observation_cutoff', 'Supply a valid UTC observation cutoff with its provenance, or explicitly omit it.')] };
  }
  return { kind: 'valid', epochMs: parsed.epochMs, issues: [] };
}
