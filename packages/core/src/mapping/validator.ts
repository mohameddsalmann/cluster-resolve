import {
  CANONICAL_FIELD_METADATA,
  type ImportKind,
  type MappingValidationResult,
} from './types';

/**
 * Validates a user or engine mapping against the canonical schema for an ImportKind.
 */
export function validateColumnMapping(
  mapping: Record<string, string | null>,
  kind: ImportKind
): MappingValidationResult {
  const kindMetadata = CANONICAL_FIELD_METADATA[kind];
  if (!kindMetadata) {
    throw new Error(`Unsupported import kind: ${kind}`);
  }

  const allCanonicalFields = Object.keys(kindMetadata);
  const requiredCanonicalFields = allCanonicalFields.filter(
    (field) => kindMetadata[field].required
  );

  const targetFieldCounts = new Map<string, number>();
  let mappedFieldsCount = 0;
  let ignoredFieldsCount = 0;
  let unmappedFieldsCount = 0;

  for (const [, targetField] of Object.entries(mapping)) {
    if (targetField === null) {
      ignoredFieldsCount++;
    } else if (targetField === undefined || targetField === '') {
      unmappedFieldsCount++;
    } else {
      mappedFieldsCount++;
      targetFieldCounts.set(targetField, (targetFieldCounts.get(targetField) ?? 0) + 1);
    }
  }

  // Find duplicate targets (where 2 or more source columns map to the same target field)
  const duplicateTargetFields: string[] = [];
  for (const [targetField, count] of targetFieldCounts.entries()) {
    if (count > 1) {
      duplicateTargetFields.push(targetField);
    }
  }

  // Find missing required fields
  const missingRequiredFields: string[] = [];
  let requiredMapped = 0;
  for (const requiredField of requiredCanonicalFields) {
    if ((targetFieldCounts.get(requiredField) ?? 0) >= 1) {
      requiredMapped++;
    } else {
      missingRequiredFields.push(requiredField);
    }
  }

  const isValid = missingRequiredFields.length === 0 && duplicateTargetFields.length === 0;

  return {
    isValid,
    importKind: kind,
    requiredMapped,
    requiredTotal: requiredCanonicalFields.length,
    missingRequiredFields,
    duplicateTargetFields,
    mappedFieldsCount,
    ignoredFieldsCount,
    unmappedFieldsCount,
  };
}
