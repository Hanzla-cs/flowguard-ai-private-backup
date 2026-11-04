import { describe, expect, it } from 'vitest';
import { formatNumber } from '../src/core/format';

describe('display rounding only', () => {
  it.each([
    [1.25, '1.3'], [-1.25, '-1.3'], [1.15, '1.2'], [-1.15, '-1.2'],
    [-0.04, '0.0'], [-0, '0.0'], [0.05, '0.1'], [-0.05, '-0.1'],
    [1e-7, '0.0'], [1e21, '1000000000000000000000.0'], [33.333333333333336, '33.3'],
  ])('formats %s as %s', (input, expected) => expect(formatNumber(input)).toBe(expected));
  it('formats count displays without a decimal place', () => {
    expect(formatNumber(0, 0)).toBe('0');
    expect(formatNumber(10000, 0)).toBe('10000');
    expect(formatNumber(-2.5, 0)).toBe('-3');
  });
  it.each([NaN, Infinity, -Infinity])('refuses nonfinite input %s', value => {
    expect(() => formatNumber(value)).toThrow(RangeError);
  });
});
