import type { AnalysisConfiguration } from '../core/contracts';

export const DEFAULT_SEED = 20261104;
const DAY_MS = 86400000;
const START_MS = Date.UTC(2026, 9, 5);
const A_START = '2026-10-05T00:00:00Z';
const B_START = '2026-10-12T00:00:00Z';
const END = '2026-10-19T00:00:00Z';
const CUTOFF = '2026-10-20T00:00:00Z';

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** FG-LCG32-1: unsigned state, update before output; unbiased integer rejection sampling. */
function sampler(seed: number): (bound: number) => number {
  let state = seed;
  return bound => {
    const limit = Math.floor(4294967296 / bound) * bound;
    do { state = (Math.imul(1664525, state) + 1013904223) >>> 0; } while (state >= limit);
    return state % bound;
  };
}

/** Pure generation: no filesystem, current clock, locale, timezone or unseeded randomness. */
export async function generateSynthetic(seed = DEFAULT_SEED): Promise<{ csv: string; manifest: string }> {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be an unsigned 32-bit integer.');
  const sample = sampler(seed);
  const rows: Record<'A' | 'B', string[]> = { A: [], B: [] };
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < 100; slot++) {
      const arrival = START_MS + day * DAY_MS + (slot * 864 + sample(864)) * 1000;
      const status = slot < 85 ? 'seen' : slot < 95 ? 'not_seen' : 'unknown';
      const wait = status === 'seen' ? 5 + sample(116) : null;
      const pair = String(day * 100 + slot + 1).padStart(6, '0');
      for (const period of ['A', 'B'] as const) {
        const at = arrival + (period === 'B' ? 7 * DAY_MS : 0);
        const provider = wait === null ? '' : new Date(at + (wait + (period === 'B' ? 10 : 0)) * 60000).toISOString();
        rows[period].push([`FG-${period}-${pair}`, new Date(at).toISOString(), provider, status].join(','));
      }
    }
  }
  const csv = ['encounter_id,arrival_at_utc,first_provider_at_utc,provider_status', ...rows.A, ...rows.B].join('\n') + '\n';
  const bytes = new TextEncoder().encode(csv);
  // Property insertion order is part of FG-SYNTHETIC-1's canonical serialization.
  const manifest = {
    manifestVersion: 'FG-SYNTHETIC-1',
    datasetId: 'flowguard-paired-wait-shift-v1',
    statement: 'Entirely fictional, intentionally constructed +10-minute paired-wait demonstration; not observed hospital deterioration.',
    provenance: 'Independently constructed for FlowGuard AI. No patient, hospital, academic project, workbook or external dataset inputs.',
    generator: {
      version: 'FG-GENERATOR-1', algorithm: 'FG-LCG32-1', seed,
      recurrence: 'state = (1664525 * state + 1013904223) mod 2^32; output updated unsigned state',
      sampling: 'For bound n, reject outputs >= floor(2^32/n)*n; return output mod n.',
      drawOrder: 'A day 0..6, slot 0..99: arrival sample(864), then seen-only wait sample(116). B uses no draws.',
    },
    parameters: {
      daysPerPeriod: 7, encountersPerDay: 100, seenPerDay: 85, notSeenPerDay: 10, unknownPerDay: 5,
      arrivalRule: 'UTC midnight + slot*864 seconds + sample(864) seconds; B = A + 7 days.',
      statusRule: 'Slots 0..84 seen, 85..94 not_seen, 95..99 unknown.',
      aWaitMinutesInclusive: [5, 120], bPairedWaitShiftMinutes: 10,
      pairingRule: 'FG-A-NNNNNN and FG-B-NNNNNN share pair number day*100+slot+1, padded to six digits.',
    },
    serialization: {
      encoding: 'UTF-8 without BOM', newline: 'LF', finalNewline: true,
      csvHeader: 'encounter_id,arrival_at_utc,first_provider_at_utc,provider_status',
      rowOrder: 'All A then all B; ascending day then slot within each period.',
      timestampFormat: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      json: 'Fixed property insertion order from FG-GENERATOR-1; JSON.stringify(value, null, 2) + LF; no volatile timestamps.',
    },
    periods: { A: { startUtc: A_START, endUtcExclusive: B_START }, B: { startUtc: B_START, endUtcExclusive: END } },
    observationCutoffUtc: CUTOFF,
    expectedCounts: { total: 1400, perPeriod: { countable: 700, seen: 595, notSeen: 70, unknown: 35, timingEligible: 595 } },
    coverage: {
      kind: 'declared', intervals: [{ startUtc: A_START, endUtcExclusive: END }],
      encounterCapture: 'declared_complete',
      provenance: { source: 'synthetic_manifest', reference: 'flowguard-paired-wait-shift-v1.manifest.json' },
      syntheticReproduction: 'not_checked', independentlyVerifiedHospitalCoverage: false,
    },
    csv: { file: 'flowguard-paired-wait-shift-v1.csv', byteLength: bytes.byteLength, sha256: await sha256(bytes) },
  };
  return { csv, manifest: JSON.stringify(manifest, null, 2) + '\n' };
}

/** Verify both canonical artifacts against the trusted generator and caller-selected seed.
 * This verifies construction, not authenticity or hospital capture. Never trust a manifest's matched claim.
 */
export async function verifySynthetic(csvBytes: Uint8Array, manifestBytes: Uint8Array, expectedSeed = DEFAULT_SEED): Promise<AnalysisConfiguration> {
  const expected = await generateSynthetic(expectedSeed);
  const equalBytes = (actual: Uint8Array, text: string): boolean => {
    const wanted = new TextEncoder().encode(text);
    return actual.length === wanted.length && actual.every((byte, i) => byte === wanted[i]);
  };
  if (!equalBytes(csvBytes, expected.csv)) throw new Error('Synthetic CSV checksum/reproduction mismatch.');
  if (!equalBytes(manifestBytes, expected.manifest)) throw new Error('Synthetic manifest mismatch (parameters, checksum, provenance or canonical serialization).');
  const checksum = await sha256(new TextEncoder().encode(expected.csv));
  return {
    periods: { kind: 'explicit', origin: 'synthetic_scenario', confirmedForSourceSha256: checksum,
      A: { id: 'A', startUtc: A_START, endUtcExclusive: B_START }, B: { id: 'B', startUtc: B_START, endUtcExclusive: END } },
    observationCutoff: { atUtc: CUTOFF, provenance: { source: 'synthetic_manifest', reference: 'flowguard-paired-wait-shift-v1.manifest.json' } },
    coverage: { kind: 'declared', intervals: [{ startUtc: A_START, endUtcExclusive: END }], encounterCapture: 'declared_complete',
      provenance: { source: 'synthetic_manifest', reference: 'flowguard-paired-wait-shift-v1.manifest.json' }, syntheticReproduction: 'matched' },
  };
}
