interface ValidationError {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}

export type RowErrorCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_QUANTITY'
  | 'INVALID_MONEY'
  | 'INVALID_DISCOUNT'
  | 'INVALID_CONFIDENCE'
  | 'INVALID_BOOLEAN'
  | 'UNKNOWN_ORDER'
  | 'UNKNOWN_PRODUCT'
  | 'UNKNOWN_SUPPLIER'
  | 'DUPLICATE_EXTERNAL_ID'
  | 'CONFLICTING_RECORD'
  | 'FINAL_OUTCOME_CONFLICT'
  | 'CROSS_DATASET_REFERENCE';

export type JobErrorCode =
  | 'UNSUPPORTED_IMPORT_TYPE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_ENCODING'
  | 'INVALID_CSV'
  | 'INVALID_HEADER'
  | 'INVALID_MAPPING'
  | 'STORAGE_FAILED'
  | 'NO_VALID_ROWS'
  | 'IMPORT_FAILED';

export interface IngestionRowError {
  rowNumber: number;
  field: string | null;
  code: RowErrorCode;
  message: string;
  rawValue: string | null;
}

export class ImportJobError extends Error {
  constructor(
    public readonly code: JobErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ImportJobError';
  }
}

const FIELD_CODES: Record<string, RowErrorCode> = {
  placed_at: 'INVALID_TIMESTAMP',
  promised_delivery_at: 'INVALID_TIMESTAMP',
  offered_at: 'INVALID_TIMESTAMP',
  delivered_at: 'INVALID_TIMESTAMP',
  decided_at: 'INVALID_TIMESTAMP',
  requested_qty: 'INVALID_QUANTITY',
  available_qty: 'INVALID_QUANTITY',
  filled_qty: 'INVALID_QUANTITY',
  unit_price_egp: 'INVALID_MONEY',
  discount_percent: 'INVALID_DISCOUNT',
  confidence: 'INVALID_CONFIDENCE',
  cancelled: 'INVALID_BOOLEAN',
  outcome_final: 'INVALID_BOOLEAN',
};

export function zodErrorsToRows(
  error: ValidationError,
  rowNumber: number,
  raw: Record<string, string>
): IngestionRowError[] {
  return error.issues.map((issue) => {
    const field = typeof issue.path[0] === 'string' ? issue.path[0] : null;
    const missing = field !== null && (raw[field] ?? '').trim() === '';
    return {
      rowNumber,
      field,
      code: missing ? 'MISSING_REQUIRED_FIELD' : (FIELD_CODES[field ?? ''] ?? 'CONFLICTING_RECORD'),
      message: issue.message,
      rawValue: field === null ? null : (raw[field] ?? null),
    };
  });
}

export function safeDatabaseError(error: unknown): { code: RowErrorCode; message: string } {
  const databaseCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  if (databaseCode === '23503') {
    return {
      code: 'CROSS_DATASET_REFERENCE',
      message: 'A referenced record does not exist in this dataset.',
    };
  }
  if (databaseCode === '23505') {
    return {
      code: 'DUPLICATE_EXTERNAL_ID',
      message: 'This external identifier is already used by a different record.',
    };
  }
  if (databaseCode === '23502' || databaseCode === '23514') {
    return {
      code: 'CONFLICTING_RECORD',
      message: 'The row violates a required canonical data constraint.',
    };
  }
  return {
    code: 'CONFLICTING_RECORD',
    message: 'The row could not be persisted safely.',
  };
}

export function jobErrorResponse(error: unknown): { code: JobErrorCode; message: string } {
  if (error instanceof ImportJobError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'IMPORT_FAILED', message: 'The import could not be completed.' };
}
