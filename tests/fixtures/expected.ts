/**
 * Manual oracle, independently transcribed from FG-VERIFY-1 and simple arithmetic.
 * No production imports, generator, timestamp parsing, median or eligibility logic.
 * These are expectations for a future engine, not engine-produced results.
 */
export interface FractionExpectation {
  readonly numerator: number;
  readonly denominator: number;
  readonly displayedPercent: string | null;
}

export interface PeriodExpectation {
  readonly countable: number;
  readonly status: { readonly seen: number; readonly notSeen: number; readonly unknown: number; readonly invalid: number };
  readonly eligibleRecordNumbers: readonly number[];
  readonly primaryExclusions: Readonly<Record<string, readonly number[]>>;
  readonly waitMinutes: readonly number[];
  readonly medianMinutes: number | null;
  readonly seenPopulated: number;
  readonly seenParseValid: number;
  readonly seenMissing: number;
  readonly timingEligibility: FractionExpectation;
  readonly seenCompleteness: FractionExpectation;
  readonly seenParseValidity: FractionExpectation;
}

export interface CaseExpectation {
  readonly parsedRecords: number;
  readonly quarantined: readonly number[];
  readonly invalidIdentity: readonly number[];
  readonly unusableArrival: readonly number[];
  readonly outsidePeriods: readonly number[];
  readonly periodRecords: { readonly A: readonly number[]; readonly B: readonly number[] } | null;
  readonly periods: { readonly A: PeriodExpectation; readonly B: PeriodExpectation } | null;
  readonly coverageKind: 'unverified' | 'declared';
  readonly independentlyVerifiedHospitalCoverage: false;
  readonly blocking: 'none' | 'configuration';
}

const emptyPeriod = {
  countable: 0, status: { seen: 0, notSeen: 0, unknown: 0, invalid: 0 },
  eligibleRecordNumbers: [], primaryExclusions: {}, waitMinutes: [], medianMinutes: null,
  seenPopulated: 0, seenParseValid: 0, seenMissing: 0,
  timingEligibility: { numerator: 0, denominator: 0, displayedPercent: null },
  seenCompleteness: { numerator: 0, denominator: 0, displayedPercent: null },
  seenParseValidity: { numerator: 0, denominator: 0, displayedPercent: null },
} as const satisfies PeriodExpectation;

const primaryA = {
  countable: 6, status: { seen: 4, notSeen: 1, unknown: 1, invalid: 0 },
  eligibleRecordNumbers: [2, 3, 4, 5], primaryExclusions: { not_seen: [6], unknown: [7] },
  waitMinutes: [10, 20, 30, 40], medianMinutes: 25,
  seenPopulated: 4, seenParseValid: 4, seenMissing: 0,
  timingEligibility: { numerator: 4, denominator: 6, displayedPercent: '66.7' },
  seenCompleteness: { numerator: 4, denominator: 4, displayedPercent: '100.0' },
  seenParseValidity: { numerator: 4, denominator: 4, displayedPercent: '100.0' },
} as const satisfies PeriodExpectation;

const primaryB = {
  countable: 6, status: { seen: 4, notSeen: 1, unknown: 1, invalid: 0 },
  eligibleRecordNumbers: [8, 9],
  primaryExclusions: { provider_before_arrival: [10], missing_provider: [11], not_seen: [12], unknown: [13] },
  waitMinutes: [10, 20], medianMinutes: 15,
  seenPopulated: 3, seenParseValid: 3, seenMissing: 1,
  timingEligibility: { numerator: 2, denominator: 6, displayedPercent: '33.3' },
  seenCompleteness: { numerator: 3, denominator: 4, displayedPercent: '75.0' },
  seenParseValidity: { numerator: 3, denominator: 4, displayedPercent: '75.0' },
} as const satisfies PeriodExpectation;

const validA = {
  countable: 3, status: { seen: 3, notSeen: 0, unknown: 0, invalid: 0 },
  eligibleRecordNumbers: [2, 3, 4], primaryExclusions: {}, waitMinutes: [10, 20, 40], medianMinutes: 20,
  seenPopulated: 3, seenParseValid: 3, seenMissing: 0,
  timingEligibility: { numerator: 3, denominator: 3, displayedPercent: '100.0' },
  seenCompleteness: { numerator: 3, denominator: 3, displayedPercent: '100.0' },
  seenParseValidity: { numerator: 3, denominator: 3, displayedPercent: '100.0' },
} as const satisfies PeriodExpectation;

const primary = {
  parsedRecords: 12, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
  periodRecords: { A: [2, 3, 4, 5, 6, 7], B: [8, 9, 10, 11, 12, 13] },
  periods: { A: primaryA, B: primaryB }, coverageKind: 'unverified',
  independentlyVerifiedHospitalCoverage: false, blocking: 'none',
} as const satisfies CaseExpectation;

const valid = {
  parsedRecords: 3, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
  periodRecords: { A: [2, 3, 4], B: [] }, periods: { A: validA, B: emptyPeriod },
  coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
} as const satisfies CaseExpectation;

const duplicate = {
  parsedRecords: 13, quarantined: [2, 14], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
  periodRecords: { A: [3, 4, 5, 6, 7], B: [8, 9, 10, 11, 12, 13] },
  periods: {
    A: {
      countable: 5, status: { seen: 3, notSeen: 1, unknown: 1, invalid: 0 },
      eligibleRecordNumbers: [3, 4, 5], primaryExclusions: { not_seen: [6], unknown: [7] },
      waitMinutes: [20, 30, 40], medianMinutes: 30, seenPopulated: 3, seenParseValid: 3, seenMissing: 0,
      timingEligibility: { numerator: 3, denominator: 5, displayedPercent: '60.0' },
      seenCompleteness: { numerator: 3, denominator: 3, displayedPercent: '100.0' },
      seenParseValidity: { numerator: 3, denominator: 3, displayedPercent: '100.0' },
    }, B: primaryB,
  }, coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
} as const satisfies CaseExpectation;

export const expectedCases = {
  primary,
  valid,
  missing: {
    parsedRecords: 2, quarantined: [], invalidIdentity: [], unusableArrival: [2], outsidePeriods: [],
    periodRecords: { A: [3], B: [] },
    periods: {
      A: {
        countable: 1, status: { seen: 1, notSeen: 0, unknown: 0, invalid: 0 },
        eligibleRecordNumbers: [], primaryExclusions: { missing_provider: [3] }, waitMinutes: [], medianMinutes: null,
        seenPopulated: 0, seenParseValid: 0, seenMissing: 1,
        timingEligibility: { numerator: 0, denominator: 1, displayedPercent: '0.0' },
        seenCompleteness: { numerator: 0, denominator: 1, displayedPercent: '0.0' },
        seenParseValidity: { numerator: 0, denominator: 1, displayedPercent: '0.0' },
      }, B: emptyPeriod,
    }, coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
  },
  chronology: {
    parsedRecords: 1, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
    periodRecords: { A: [2], B: [] },
    periods: {
      A: {
        countable: 1, status: { seen: 1, notSeen: 0, unknown: 0, invalid: 0 },
        eligibleRecordNumbers: [], primaryExclusions: { provider_before_arrival: [2] }, waitMinutes: [], medianMinutes: null,
        seenPopulated: 1, seenParseValid: 1, seenMissing: 0,
        timingEligibility: { numerator: 0, denominator: 1, displayedPercent: '0.0' },
        seenCompleteness: { numerator: 1, denominator: 1, displayedPercent: '100.0' },
        seenParseValidity: { numerator: 1, denominator: 1, displayedPercent: '100.0' },
      }, B: emptyPeriod,
    }, coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
  },
  'duplicate-identical': duplicate,
  'duplicate-conflicting': duplicate,
  contradictory: {
    parsedRecords: 3, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
    periodRecords: { A: [2, 3, 4], B: [] },
    periods: {
      A: {
        countable: 3, status: { seen: 0, notSeen: 1, unknown: 1, invalid: 1 },
        eligibleRecordNumbers: [], primaryExclusions: { not_seen: [2], unknown: [3], invalid_status: [4] },
        waitMinutes: [], medianMinutes: null, seenPopulated: 0, seenParseValid: 0, seenMissing: 0,
        timingEligibility: { numerator: 0, denominator: 3, displayedPercent: '0.0' },
        seenCompleteness: { numerator: 0, denominator: 0, displayedPercent: null },
        seenParseValidity: { numerator: 0, denominator: 0, displayedPercent: null },
      }, B: emptyPeriod,
    }, coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
  },
  empty: {
    parsedRecords: 0, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
    periodRecords: { A: [], B: [] }, periods: { A: emptyPeriod, B: emptyPeriod },
    coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
  },
  boundaries: {
    parsedRecords: 5, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [4, 5],
    periodRecords: { A: [2, 6], B: [3] },
    periods: {
      A: {
        countable: 2, status: { seen: 2, notSeen: 0, unknown: 0, invalid: 0 },
        eligibleRecordNumbers: [2, 6], primaryExclusions: {}, waitMinutes: [0, 20], medianMinutes: 10,
        seenPopulated: 2, seenParseValid: 2, seenMissing: 0,
        timingEligibility: { numerator: 2, denominator: 2, displayedPercent: '100.0' },
        seenCompleteness: { numerator: 2, denominator: 2, displayedPercent: '100.0' },
        seenParseValidity: { numerator: 2, denominator: 2, displayedPercent: '100.0' },
      },
      B: {
        countable: 1, status: { seen: 1, notSeen: 0, unknown: 0, invalid: 0 },
        eligibleRecordNumbers: [3], primaryExclusions: {}, waitMinutes: [10], medianMinutes: 10,
        seenPopulated: 1, seenParseValid: 1, seenMissing: 0,
        timingEligibility: { numerator: 1, denominator: 1, displayedPercent: '100.0' },
        seenCompleteness: { numerator: 1, denominator: 1, displayedPercent: '100.0' },
        seenParseValidity: { numerator: 1, denominator: 1, displayedPercent: '100.0' },
      },
    }, coverageKind: 'unverified', independentlyVerifiedHospitalCoverage: false, blocking: 'none',
  },
  'partial-coverage': { ...valid, coverageKind: 'declared' },
  'unverified-coverage': valid,
  'unselected-periods': {
    parsedRecords: 3, quarantined: [], invalidIdentity: [], unusableArrival: [], outsidePeriods: [],
    periodRecords: null, periods: null, coverageKind: 'unverified',
    independentlyVerifiedHospitalCoverage: false, blocking: 'configuration',
  },
} as const satisfies Readonly<Record<string, CaseExpectation>>;

export const manualComparisons = {
  primary: {
    medianDifferenceMinutes: -10, medianRelativePercent: -40,
    eligibilityDifferencePercentagePoints: { numerator: -100, denominator: 3, displayed: '-33.3' },
    seenCompletenessDifferencePercentagePoints: -25,
    interpretation: 'descriptive_decrease_with_lower_timing_coverage',
  },
  duplicate: { medianDifferenceMinutes: -15, medianRelativePercent: -50 },
  partialCoverage: { unionHoursA: 72, periodHours: 168, displayedPercentA: '42.9', independentlyVerifiedHospitalCoverage: false },
} as const;
