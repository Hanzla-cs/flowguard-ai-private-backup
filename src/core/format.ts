/**
 * Decimal display rounding of the finite number's canonical decimal form.
 * Ties round away from zero. No epsilon adjustment, locale or negative zero.
 * Calculations must use raw values rather than this string.
 */
export function formatNumber(value: number, places: 0 | 1 = 1): string {
  if (!Number.isFinite(value)) throw new RangeError('Cannot format a nonfinite analytical value.');
  const [mantissa = '0', exponentText = '0'] = Math.abs(value).toString().split('e');
  const [whole = '0', fractional = ''] = mantissa.split('.');
  const digits = BigInt(whole + fractional);
  const shift = Number(exponentText) - fractional.length + places;
  let rounded: bigint;
  if (shift >= 0) rounded = digits * 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    rounded = digits / divisor + (2n * (digits % divisor) >= divisor ? 1n : 0n);
  }
  const sign = value < 0 && rounded !== 0n ? '-' : '';
  const text = rounded.toString().padStart(places + 1, '0');
  return places === 0 ? sign + text : sign + text.slice(0, -places) + '.' + text.slice(-places);
}
