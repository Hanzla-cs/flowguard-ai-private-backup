/**
 * FG-DATA-1 / FG-METRIC-1 contracts only: no parsing, validation or calculations.
 * A string/number type is not evidence that runtime validation has succeeded.
 * Readonly contracts separate source values, diagnostics and analytical results.
 */
export type ProviderStatus = 'seen' | 'not_seen' | 'unknown';
export type PeriodId = 'A' | 'B';
export type EncounterField = keyof RawEncounterRecord;

/** Exactly the four source columns; invalid input remains representable. */
export interface RawEncounterRecord {
  readonly encounter_id: string;
  readonly arrival_at_utc: string;
  readonly first_provider_at_utc: string;
  readonly provider_status: string;
}

/** Four fields after representation checks; chronology still requires validation. */
export interface EncounterRecord {
  readonly encounter_id: string;
  readonly arrival_at_utc: string;
  readonly first_provider_at_utc: string | null;
  readonly provider_status: ProviderStatus;
}

/** Provenance wrapper, not an additional encounter column. Header is record 1. */
export interface SourceRecord {
  readonly recordNumber: number;
  readonly value: RawEncounterRecord;
}

export type IssueCode =
  | 'missing_header' | 'missing_column' | 'unexpected_column' | 'duplicate_header'
  | 'inconsistent_field_count' | 'malformed_csv' | 'invalid_utf8'
  | 'file_size_limit' | 'record_count_limit'
  | 'invalid_identifier' | 'duplicate_identifier'
  | 'missing_arrival' | 'malformed_arrival' | 'arrival_after_cutoff'
  | 'missing_provider' | 'malformed_provider' | 'provider_before_arrival'
  | 'provider_after_cutoff' | 'invalid_status' | 'status_timestamp_conflict'
  | 'period_selection_required' | 'invalid_period' | 'overlapping_periods'
  | 'coverage_unverified';

export type IssueEffect =
  | 'block_file' | 'block_period_calculations' | 'quarantine'
  | 'exclude_encounter' | 'exclude_timing' | 'informational';

export interface ValidationIssue {
  readonly code: IssueCode;
  readonly severity: 'fatal' | 'error' | 'warning' | 'info';
  readonly scope: 'file' | 'record' | 'configuration';
  readonly recordNumbers: readonly number[];
  readonly fields: readonly EncounterField[];
  readonly effects: readonly IssueEffect[];
  readonly message: string;
}

/** Every member of a repeated syntactically valid ID group is quarantined. */
export interface QuarantinedRecord {
  readonly source: SourceRecord;
  readonly reason: 'duplicate_identifier';
  readonly duplicateId: string;
  readonly groupRecordNumbers: readonly number[];
  readonly issues: readonly ValidationIssue[];
}

export interface DuplicateGroup {
  readonly encounterId: string;
  readonly recordNumbers: readonly number[];
}

export interface UtcInterval {
  readonly startUtc: string;
  readonly endUtcExclusive: string;
}

/** Runtime checks must establish midnight UTC, 168 hours and nonoverlap. */
export interface ComparisonPeriod extends UtcInterval {
  readonly id: PeriodId;
}

export type ComparisonSelection =
  | { readonly kind: 'unselected' }
  | {
      readonly kind: 'explicit';
      readonly confirmedForSourceSha256: string;
      readonly origin: 'synthetic_scenario' | 'user_selection';
      readonly A: ComparisonPeriod & { readonly id: 'A' };
      readonly B: ComparisonPeriod & { readonly id: 'B' };
    };

export interface AssertionProvenance {
  readonly source: 'synthetic_manifest' | 'uploader' | 'run_configuration';
  readonly reference: string;
}

export interface ObservationCutoff {
  readonly atUtc: string;
  readonly provenance: AssertionProvenance;
}

export type CoverageMetadata =
  | { readonly kind: 'unverified' }
  | {
      readonly kind: 'declared';
      readonly intervals: readonly UtcInterval[];
      readonly encounterCapture: 'declared_complete' | 'declared_partial' | 'unspecified';
      readonly provenance: AssertionProvenance;
      /** Reproduction is not independent hospital verification. */
      readonly syntheticReproduction: 'not_checked' | 'matched' | 'mismatched' | 'not_applicable';
    };

export interface AnalysisConfiguration {
  readonly periods: ComparisonSelection;
  readonly observationCutoff: ObservationCutoff | null;
  readonly coverage: CoverageMetadata;
}

export interface SourceIdentity {
  readonly name: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface RunIdentity {
  readonly source: SourceIdentity;
  readonly specification: {
    readonly data: 'FG-DATA-1';
    readonly metrics: 'FG-METRIC-1';
  };
  /** Must change when source/configuration/specification changes. */
  readonly configurationFingerprint: string;
  readonly configuration: AnalysisConfiguration;
}

export type MetricPopulation =
  | 'accepted_period_encounters'
  | 'recorded_seen_encounters'
  | 'timing_eligible_encounters'
  | 'declared_collection_intervals';

export type MetricUnit = 'encounters' | 'minutes' | 'percent' | 'percentage_points' | 'hours';
export type MetricId =
  | 'encounter_count' | 'status_seen' | 'status_not_seen' | 'status_unknown'
  | 'status_invalid' | 'median_door_to_provider' | 'timing_eligibility'
  | 'seen_provider_completeness' | 'seen_provider_parse_validity'
  | 'seen_timing_eligibility' | 'declared_temporal_coverage';

export interface MetricContext {
  readonly id: MetricId;
  readonly period: PeriodId;
  readonly unit: MetricUnit;
  readonly population: MetricPopulation;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly eligibleRecordNumbers: readonly number[];
  readonly excludedRecordNumbers: readonly number[];
  readonly limitations: readonly string[];
}

export type MetricResult = MetricContext & (
  | { readonly status: 'calculated' | 'calculated_with_limitations'; readonly value: number }
  | { readonly status: 'unavailable'; readonly value: null; readonly reason: string }
);

export interface StatusCounts {
  readonly seen: number;
  readonly not_seen: number;
  readonly unknown: number;
  /** Quality bucket, never a fourth operational status. */
  readonly invalid: number;
}

export interface OperationalMetrics {
  readonly period: ComparisonPeriod;
  readonly encounterCount: MetricResult;
  readonly statuses: Readonly<Record<keyof StatusCounts, {
    readonly count: MetricResult;
    readonly percentage: MetricResult;
  }>>;
  readonly medianDoorToProvider: MetricResult;
  readonly timingEligibility: MetricResult;
  readonly seenProviderCompleteness: MetricResult;
  readonly seenProviderParseValidity: MetricResult;
  readonly seenTimingEligibility: MetricResult;
}

export type TimingExclusionReason =
  | 'invalid_status' | 'not_seen' | 'unknown' | 'missing_provider'
  | 'malformed_provider' | 'provider_before_arrival' | 'provider_after_cutoff';

export interface RecordCount {
  readonly count: number;
  readonly recordNumbers: readonly number[];
}

/** Nonexclusive diagnostics must never be summed as exclusive exclusions. */
export interface DiagnosticSummary {
  readonly population: 'all_parsed_records' | 'accepted_period_encounters';
  readonly period: PeriodId | null;
  readonly countsAreExclusive: false;
  readonly issues: readonly ValidationIssue[];
  readonly countsByCode: Readonly<Partial<Record<IssueCode, RecordCount>>>;
}

export interface PeriodDataQuality {
  readonly period: PeriodId;
  readonly countable: RecordCount;
  readonly timingEligible: RecordCount;
  readonly timingExcluded: RecordCount;
  readonly primaryTimingExclusions: Readonly<Record<TimingExclusionReason, RecordCount>>;
  readonly recordedSeen: RecordCount;
  readonly seenProviderPopulated: RecordCount;
  readonly seenProviderParseValid: RecordCount;
  readonly seenProviderMissing: RecordCount;
  readonly diagnostics: DiagnosticSummary;
}

export interface RowAccounting {
  readonly parsedNonblank: number;
  readonly skippedBlank: number;
  readonly duplicateQuarantined: RecordCount;
  readonly invalidIdentity: RecordCount;
  readonly unusableArrival: RecordCount;
  readonly outsidePeriods: RecordCount;
  readonly periodA: RecordCount;
  readonly periodB: RecordCount;
}

export interface DataQualityResults {
  readonly globalDiagnostics: DiagnosticSummary;
  readonly duplicateGroups: readonly DuplicateGroup[];
  readonly quarantinedRecords: readonly QuarantinedRecord[];
  /** Raw marked-seen records, including quarantines, with missing/invalid arrivals. */
  readonly rawSeenUnusableArrival: RecordCount;
  /** Null until file and comparison configuration permit complete accounting. */
  readonly accounting: RowAccounting | null;
  readonly periods: Readonly<Record<PeriodId, PeriodDataQuality>> | null;
}

export interface ObservedArrivalSpan {
  readonly earliestArrivalUtc: string;
  readonly latestArrivalUtc: string;
}

export interface CoverageEvidence {
  readonly metadata: CoverageMetadata;
  readonly observedArrivalSpan: ObservedArrivalSpan | null;
  /** Always false: declarations/checksums cannot independently verify hospital coverage. */
  readonly independentlyVerifiedHospitalCoverage: false;
  readonly declaredTemporalCoverage: Readonly<Record<PeriodId, MetricResult>> | null;
  readonly limitations: readonly string[];
}

export type DifferenceValue =
  | { readonly status: 'calculated' | 'calculated_with_limitations'; readonly value: number }
  | { readonly status: 'unavailable'; readonly value: null; readonly reason: string };

export interface MetricComparison {
  readonly metricId: MetricId;
  readonly baselinePeriod: 'A';
  readonly comparisonPeriod: 'B';
  readonly sourceMetricIds: readonly [string, string];
  readonly absoluteUnit: MetricUnit;
  readonly absoluteDifference: DifferenceValue;
  readonly relativePercentageDifference: DifferenceValue | null;
  /** Present for proportion metrics; distinguish from relative percentage change. */
  readonly percentagePointDifference: DifferenceValue | null;
  readonly limitations: readonly string[];
}

export interface EvidenceReportBase {
  readonly run: RunIdentity;
  readonly quality: DataQualityResults;
  readonly coverage: CoverageEvidence;
  readonly limitations: readonly string[];
  readonly kind: 'deterministic_evidence';
  /** No operational thresholds or AI narrative are implemented by this contract. */
}

export interface CalculatedEvidenceReport extends EvidenceReportBase {
  readonly status: 'calculated' | 'calculated_with_limitations';
  readonly metrics: Readonly<Record<PeriodId, OperationalMetrics>>;
  readonly comparisons: readonly MetricComparison[];
}

export interface BlockedEvidenceReport extends EvidenceReportBase {
  readonly status: 'blocked_by_file_or_configuration_error';
  readonly blockingIssues: readonly ValidationIssue[];
  readonly metrics: null;
  readonly comparisons: null;
}

export type EvidenceReport = CalculatedEvidenceReport | BlockedEvidenceReport;
