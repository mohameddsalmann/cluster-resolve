/**
 * Money representation & exact parsing utilities.
 * 
 * Rules:
 * - All persisted and internal domain monetary values are integer piastres (BIGINT / bigint).
 * - Parsing MUST be strictly string-based. Never pass floating point numbers or use parseFloat.
 * - EGP 1.00 = 100 piastres.
 * - Max supported precision is 2 decimal places (piastres).
 */

/**
 * Convert a decimal string representation of EGP (e.g. "125.50", "8220.00", "0.01", "100")
 * to integer piastres (bigint).
 *
 * Throws an Error if the input is malformed, has more than 2 decimal places,
 * or contains non-numeric characters.
 */
export function toPiastres(input: string): bigint {
  if (typeof input !== 'string') {
    throw new TypeError('toPiastres requires a string input to preserve exact monetary value');
  }

  const trimmed = input.trim();
  if (trimmed === '') {
    throw new Error('Cannot parse empty string to piastres');
  }

  // Strictly match optional leading minus sign, digits, and optional decimal with max 2 digits
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid monetary string format: "${input}". Expected format like "125.50" or "100"`);
  }

  const isNegative = match[1] === '-';
  const integerPart = match[2];
  const decimalPart = (match[3] || '').padEnd(2, '0');

  const piastreStr = `${integerPart}${decimalPart}`;
  // Remove leading zeros while keeping at least one zero if 0
  const cleanPiastreStr = piastreStr.replace(/^0+(?=\d)/, '');

  const result = BigInt(cleanPiastreStr);
  return isNegative ? -result : result;
}

/**
 * Format integer piastres (bigint) as a decimal EGP string with 2 decimal places (e.g. "125.50").
 */
export function toEgp(minor: bigint): string {
  const isNegative = minor < 0n;
  const absVal = isNegative ? -minor : minor;

  const str = absVal.toString().padStart(3, '0');
  const integerPart = str.slice(0, -2);
  const decimalPart = str.slice(-2);

  const formatted = `${integerPart}.${decimalPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Convert integer piastres (bigint) to a string minor unit for JSON serialization.
 */
export function moneyToString(minor: bigint): string {
  return minor.toString();
}

/**
 * Parse string or bigint into BigInt piastres.
 */
export function piastresToBigint(input: string | bigint): bigint {
  if (typeof input === 'bigint') {
    return input;
  }
  if (typeof input === 'string') {
    return BigInt(input);
  }
  throw new TypeError('Expected string or bigint');
}
