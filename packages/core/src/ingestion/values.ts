const EXPLICIT_ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export function parseNonNegativeInteger(input: string, field = 'quantity'): number {
  const value = input.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`${field} must be a nonnegative integer.`);
  }

  const parsed = BigInt(value);
  if (parsed > 2_147_483_647n) {
    throw new Error(`${field} exceeds the supported integer range.`);
  }
  return parseInt(value, 10);
}

export function parsePositiveInteger(input: string, field = 'quantity'): number {
  const value = parseNonNegativeInteger(input, field);
  if (value === 0) {
    throw new Error(`${field} must be greater than zero.`);
  }
  return value;
}

export function discountPercentToBps(input: string): number {
  const value = input.trim();
  if (value === '') return 0;

  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    throw new Error('Discount must be a decimal string with at most two decimal places.');
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  const bps = whole * 100n + fraction;
  if (bps > 10_000n) {
    throw new Error('Discount must be between 0 and 100 percent.');
  }
  return parseInt(bps.toString(), 10);
}

export function normalizeConfidence(input: string): string | null {
  const value = input.trim();
  if (value === '') return null;
  if (!/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/.test(value)) {
    throw new Error('Confidence must be between 0 and 1 with at most four decimal places.');
  }
  return value;
}

export function parseStrictBoolean(input: string): boolean {
  const value = input.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Boolean values must be true or false.');
}

export function normalizeIsoTimestamp(input: string): string {
  const value = input.trim();
  const match = EXPLICIT_ISO_TIMESTAMP.exec(value);
  if (!match) {
    throw new Error('Timestamp must be ISO 8601 and include Z or an explicit offset.');
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);
  if (
    month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59
  ) {
    throw new Error('Timestamp contains an impossible date, time, or offset.');
  }

  const offset = match[8];
  if (offset !== 'Z') {
    const offsetHours = parseInt(offset.slice(1, 3), 10);
    const offsetMinutes = parseInt(offset.slice(4, 6), 10);
    if (offsetHours > 23 || offsetMinutes > 59) {
      throw new Error('Timestamp contains an impossible date, time, or offset.');
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Timestamp contains an impossible date, time, or offset.');
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    throw new Error('Timestamp contains an impossible date, time, or offset.');
  }
  return date.toISOString();
}
