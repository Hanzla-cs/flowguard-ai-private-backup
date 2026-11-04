import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateSynthetic, verifySynthetic } from '../src/synthetic/generate';
import { parseCsv } from '../src/input/parse-csv';
import { validateEncounters } from '../src/core/validate';
import { analyze } from '../src/core/analyze';

const csvBytes = readFileSync(new URL('../data/synthetic/flowguard-paired-wait-shift-v1.csv', import.meta.url));
const manifestBytes = readFileSync(new URL('../data/synthetic/flowguard-paired-wait-shift-v1.manifest.json', import.meta.url));
const encode = (value: string): Uint8Array => new TextEncoder().encode(value);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const lines = csvBytes.toString('utf8').trimEnd().split('\n');
const records = lines.slice(1).map(line => {
  const [id, arrival, provider, status] = line.split(',');
  return { id: id!, arrival: arrival!, provider: provider!, status: status! };
});

describe('independent fictional construction and byte reproducibility', () => {
  it('reproduces both checked-in artifacts exactly and repeats without state leakage', async () => {
    const first = await generateSynthetic();
    expect(first).toEqual(await generateSynthetic());
    expect(Buffer.from(first.csv)).toEqual(csvBytes);
    expect(Buffer.from(first.manifest)).toEqual(manifestBytes);
  });

  it('reproduces exact bytes in fresh processes under three timezones', () => {
    const cli = fileURLToPath(new URL('../scripts/generate-synthetic.mjs', import.meta.url));
    const outputs = ['UTC', 'America/Denver', 'Asia/Kathmandu'].map(TZ => execFileSync(process.execPath, [cli, '--stdout'], {
      env: { ...process.env, TZ }, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024,
    }));
    expect(outputs[0]).toBe(outputs[1]);
    expect(outputs[1]).toBe(outputs[2]);
    const generated = JSON.parse(outputs[0]!);
    expect(Buffer.from(generated.csv)).toEqual(csvBytes);
    expect(Buffer.from(generated.manifest)).toEqual(manifestBytes);
  });

  it('changes data with the seed and binds verification to the caller-selected seed', async () => {
    const other = await generateSynthetic(20261105);
    expect(other.csv).not.toBe(csvBytes.toString('utf8'));
    await expect(verifySynthetic(encode(other.csv), encode(other.manifest))).rejects.toThrow('mismatch');
    await expect(verifySynthetic(encode(other.csv), encode(other.manifest), 20261105)).resolves.toMatchObject({ coverage: { syntheticReproduction: 'matched' } });
  });

  it.each([-1, 4294967296, 1.5, NaN, Infinity])('rejects invalid seed %s', async seed => {
    await expect(generateSynthetic(seed)).rejects.toThrow(RangeError);
  });

  it('uses canonical UTF-8, LF, final newlines, four columns and stable JSON', () => {
    for (const bytes of [csvBytes, manifestBytes]) {
      expect(bytes.includes(13)).toBe(false);
      expect(bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))).toBe(false);
      expect(bytes.at(-1)).toBe(10);
      expect(bytes.at(-2)).not.toBe(10);
      expect(Buffer.from(new TextDecoder('utf-8', { fatal: true }).decode(bytes))).toEqual(bytes);
    }
    expect(lines[0]).toBe('encounter_id,arrival_at_utc,first_provider_at_utc,provider_status');
    expect(lines.every(line => line.split(',').length === 4)).toBe(true);
    expect(JSON.stringify(manifest, null, 2) + '\n').toBe(manifestBytes.toString('utf8'));
    expect(manifest.csv.byteLength).toBe(csvBytes.length);
    expect(manifest.csv.sha256).toBe(createHash('sha256').update(csvBytes).digest('hex'));
    expect(manifest.expectedCounts.total).toBe(1400);
    expect(manifest.generator.seed).toBe(20261104);
    expect(manifest.observationCutoffUtc).toBe('2026-10-20T00:00:00Z');
  });

  it('has unique ordered IDs and exact daily populations', () => {
    expect(records).toHaveLength(1400);
    expect(new Set(records.map(r => r.id)).size).toBe(1400);
    for (let day = 5; day <= 18; day++) {
      const daily = records.filter(r => r.arrival.startsWith(`2026-10-${String(day).padStart(2, '0')}T`));
      expect(daily).toHaveLength(100);
      expect(daily.filter(r => r.status === 'seen')).toHaveLength(85);
      expect(daily.filter(r => r.status === 'not_seen')).toHaveLength(10);
      expect(daily.filter(r => r.status === 'unknown')).toHaveLength(5);
    }
    expect(records.map(r => r.id)).toEqual([...records.map(r => r.id)].sort());
  });

  it('pairs A/B arrivals and waits exactly and preserves status semantics', () => {
    for (let i = 0; i < 700; i++) {
      const a = records[i]!, b = records[i + 700]!;
      expect(a.id.slice(5)).toBe(b.id.slice(5));
      expect(b.status).toBe(a.status);
      expect(Date.parse(b.arrival) - Date.parse(a.arrival)).toBe(604800000);
      for (const row of [a, b]) {
        expect(row.arrival).toMatch(/^2026-10-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
        if (row.status === 'seen') {
          expect(Date.parse(row.provider)).toBeGreaterThanOrEqual(Date.parse(row.arrival));
          expect(Date.parse(row.provider)).toBeLessThanOrEqual(Date.parse('2026-10-20T00:00:00Z'));
        } else expect(row.provider).toBe('');
      }
      if (a.status === 'seen') {
        const aw = (Date.parse(a.provider) - Date.parse(a.arrival)) / 60000;
        const bw = (Date.parse(b.provider) - Date.parse(b.arrival)) / 60000;
        expect(Number.isInteger(aw)).toBe(true);
        expect(aw).toBeGreaterThanOrEqual(5);
        expect(aw).toBeLessThanOrEqual(120);
        expect(bw - aw).toBe(10);
      }
    }
  });

  it('matches an independent BigInt recurrence and histogram rank oracle', () => {
    // Separate implementation: exact arbitrary-precision multiplication/modulus,
    // not production Math.imul/bitwise arithmetic, and rank counts, not the engine median.
    let state = 20261104n;
    const sample = (bound: bigint): number => {
      do { state = (1664525n * state + 1013904223n) % 4294967296n; }
      while (state >= 4294967296n - 4294967296n % bound);
      return Number(state % bound);
    };
    const histogram = new Map<number, number>();
    for (let i = 0; i < 700; i++) {
      const jitter = sample(864n);
      const row = records[i]!;
      const withinDay = Date.parse(row.arrival) % 86400000;
      expect(withinDay).toBe((i % 100 * 864 + jitter) * 1000);
      if (i % 100 < 85) {
        const wait = 5 + sample(116n);
        histogram.set(wait, (histogram.get(wait) ?? 0) + 1);
        expect(Date.parse(row.provider) - Date.parse(row.arrival)).toBe(wait * 60000);
      }
    }
    const below = [...histogram].filter(([wait]) => wait < 70).reduce((sum, [, n]) => sum + n, 0);
    expect(below).toBeLessThan(298);
    expect(below + histogram.get(70)!).toBeGreaterThanOrEqual(298);
    expect(records[0]).toEqual({ id: 'FG-A-000001', arrival: '2026-10-05T00:03:59.000Z', provider: '2026-10-05T01:18:59.000Z', status: 'seen' });
  });
});

describe('manifest verification and existing analytical pipeline', () => {
  it('rejects CSV tampering, even if a matching checksum is substituted', async () => {
    const changed = Buffer.from(csvBytes);
    changed[80] = changed[80]! ^ 1;
    await expect(verifySynthetic(changed, manifestBytes)).rejects.toThrow('mismatch');
    const forged = { ...manifest, csv: { ...manifest.csv, sha256: createHash('sha256').update(changed).digest('hex') } };
    await expect(verifySynthetic(changed, encode(JSON.stringify(forged, null, 2) + '\n'))).rejects.toThrow('mismatch');
  });

  it.each(['checksum', 'seed', 'counts', 'coverage', 'unknown field', 'invalid JSON'])('rejects %s manifest tampering', async field => {
    const changed = JSON.parse(manifestBytes.toString('utf8'));
    if (field === 'checksum') changed.csv.sha256 = '0'.repeat(64);
    if (field === 'seed') changed.generator.seed++;
    if (field === 'counts') changed.expectedCounts.total--;
    if (field === 'coverage') changed.coverage.independentlyVerifiedHospitalCoverage = true;
    if (field === 'unknown field') changed.unapproved = true;
    const text = field === 'invalid JSON' ? '{' : JSON.stringify(changed, null, 2) + '\n';
    await expect(verifySynthetic(csvBytes, encode(text))).rejects.toThrow('manifest mismatch');
  });

  it('verifies provenance, validation, exact analytical outputs and evidence accounting end to end', async () => {
    const config = await verifySynthetic(csvBytes, manifestBytes);
    const parsed = await parseCsv(csvBytes, manifest.csv.file);
    if (parsed.kind !== 'parsed') throw new Error('Generated CSV failed ingestion.');
    const validated = validateEncounters(parsed, config);
    expect(validated.kind).toBe('validated');
    expect(validated.accepted).toHaveLength(1400);
    expect(validated.rejected).toHaveLength(0);
    expect(validated.quality.quarantinedRecords).toHaveLength(0);
    expect(validated.outsidePeriods).toHaveLength(0);
    expect(validated.quality.globalDiagnostics.issues.every(issue => issue.code === 'missing_provider' && issue.severity === 'info')).toBe(true);
    const report = await analyze(parsed, config);
    if (report.metrics === null) throw new Error('Generated analysis unexpectedly blocked.');
    expect(report.validationSummary).toMatchObject({ parsedNonblank: 1400, skippedBlank: 0, accepted: 1400, rejected: 0, quarantined: 0 });
    for (const p of ['A', 'B'] as const) {
      const m = report.metrics[p];
      expect(m.encounterCount.value).toBe(700);
      expect(m.timingEligibleCount.value).toBe(595);
      expect(m.timingExcludedCount.value).toBe(105);
      expect(m.statuses.seen.count.value).toBe(595);
      expect(m.statuses.not_seen.count.value).toBe(70);
      expect(m.statuses.unknown.count.value).toBe(35);
      expect(m.statuses.invalid.count.value).toBe(0);
      expect(m.statuses.seen.percentage.value).toBe(85);
      expect(m.timingEligibility.value).toBe(85);
      expect(m.seenProviderCompleteness.value).toBe(100);
      expect(m.seenProviderParseValidity.value).toBe(100);
      expect(m.seenTimingEligibility.value).toBe(100);
      expect(m.medianDoorToProvider.value).toBe(p === 'A' ? 70 : 80);
      expect(report.coverage.declaredTemporalCoverage![p].value).toBe(100);
    }
    const median = report.comparisons.find(c => c.metricId === 'median_door_to_provider')!;
    expect(median.absoluteDifference.value).toBe(10);
    expect(median.relativePercentageDifference!.value).toBeCloseTo(100 / 7, 9);
    expect(median.relativePercentageDifference!.displayValue).toBe('14.3');
    expect(median.interpretation).toBe('descriptive_only');
    expect(report.coverage.metadata).toMatchObject({ kind: 'declared', provenance: { source: 'synthetic_manifest' }, syntheticReproduction: 'matched' });
    expect(manifest.coverage.syntheticReproduction).toBe('not_checked');
    expect(report.coverage.independentlyVerifiedHospitalCoverage).toBe(false);
    expect(report.limitations.join(' ')).toContain('source-declared');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
