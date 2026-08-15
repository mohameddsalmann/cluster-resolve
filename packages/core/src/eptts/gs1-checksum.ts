/**
 * Validates a GS1 numeric string (GTIN-8, GTIN-12, GTIN-13, GTIN-14, SSCC-18)
 * using the standard GS1 Modulo 10 algorithm.
 */
export function calculateGs1CheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  let multiplier = 3;

  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    const digit = parseInt(digitsWithoutCheck[i], 10);
    if (Number.isNaN(digit)) return -1;
    sum += digit * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }

  const remainder = sum % 10;
  return (10 - remainder) % 10;
}

export function isValidGs1String(fullNumericString: string, expectedLength?: number): boolean {
  if (expectedLength !== undefined && fullNumericString.length !== expectedLength) {
    return false;
  }
  if (!/^\d+$/.test(fullNumericString)) {
    return false;
  }
  if (fullNumericString.length < 2) return false;

  const payload = fullNumericString.slice(0, -1);
  const actualCheckDigit = parseInt(fullNumericString.slice(-1), 10);
  const expectedCheckDigit = calculateGs1CheckDigit(payload);

  return actualCheckDigit === expectedCheckDigit;
}

export function isValidGln(gln: string): boolean {
  return isValidGs1String(gln, 13);
}

export function isValidGtin14(gtin: string): boolean {
  return isValidGs1String(gtin, 14);
}

export function isValidSscc(sscc: string): boolean {
  return isValidGs1String(sscc, 18);
}
