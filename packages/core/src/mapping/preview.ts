import {
  CANONICAL_FIELD_METADATA,
  type ImportKind,
} from './types';
import {
  discountPercentToBps,
  normalizeConfidence,
  normalizeIsoTimestamp,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseStrictBoolean,
} from '../ingestion/values';

export interface MappedPreviewRow {
  rowNumber: number;
  originalValues: Record<string, string>;
  canonicalValues: Record<string, string>;
  isValid: boolean;
  errors?: Array<{ field: string; message: string }>;
}

export interface MappingPreviewResult {
  previewRows: MappedPreviewRow[];
  totalSampleRows: number;
  validSampleRows: number;
  invalidSampleRows: number;
}

/**
 * Validates a single mapped canonical row against field definitions.
 */
function validateRowValues(
  values: Record<string, string>,
  kind: ImportKind
): Array<{ field: string; message: string }> {
  const metadata = CANONICAL_FIELD_METADATA[kind];
  const errors: Array<{ field: string; message: string }> = [];

  for (const [field, def] of Object.entries(metadata)) {
    const raw = values[field]?.trim() ?? '';
    if (def.required && raw === '') {
      errors.push({ field, message: `Required field "${field}" is missing.` });
      continue;
    }
    if (raw === '') continue;

    try {
      if (def.type === 'integer') {
        if (field === 'requested_qty') {
          parsePositiveInteger(raw, field);
        } else {
          parseNonNegativeInteger(raw, field);
        }
      } else if (def.type === 'timestamp') {
        normalizeIsoTimestamp(raw);
      } else if (def.type === 'money') {
        if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
          throw new Error('Money must contain at most two decimal places.');
        }
      } else if (def.type === 'percentage') {
        if (field === 'confidence') {
          normalizeConfidence(raw);
        } else {
          discountPercentToBps(raw);
        }
      } else if (def.type === 'boolean') {
        parseStrictBoolean(raw);
      }
    } catch (err) {
      errors.push({
        field,
        message: err instanceof Error ? err.message : `Invalid value for "${field}"`,
      });
    }
  }

  return errors;
}

/**
 * Transforms raw source CSV sample rows into canonical preview rows using a mapping specification.
 */
export function generateMappedPreview(
  sampleRows: Array<{ rowNumber: number; values: Record<string, string> }>,
  mapping: Record<string, string | null>,
  kind: ImportKind
): MappingPreviewResult {
  let validCount = 0;
  let invalidCount = 0;

  const previewRows: MappedPreviewRow[] = sampleRows.map((sample) => {
    const canonicalValues: Record<string, string> = {};

    for (const [sourceHeader, rawVal] of Object.entries(sample.values)) {
      const targetField = mapping[sourceHeader];
      if (targetField && targetField !== '') {
        canonicalValues[targetField] = (rawVal ?? '').trim();
      }
    }

    const errors = validateRowValues(canonicalValues, kind);
    const isValid = errors.length === 0;

    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    return {
      rowNumber: sample.rowNumber,
      originalValues: sample.values,
      canonicalValues,
      isValid,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

  return {
    previewRows,
    totalSampleRows: sampleRows.length,
    validSampleRows: validCount,
    invalidSampleRows: invalidCount,
  };
}
