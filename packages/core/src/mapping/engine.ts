import type { ImportKind, SourceColumnMapping } from './types';
import { matchHeaderToCanonical } from './matcher';

/**
 * Inactive or ignored column detection.
 */
const IGNORED_COLUMN_NAMES = new Set([
  'ignore',
  'unnamed',
  'notes',
  'comments',
  'internal_id',
  'temp',
  'dummy',
]);

/**
 * Automatically infers column mappings for all headers of a source CSV.
 */
export function inferColumnMappings(
  headers: string[],
  kind: ImportKind,
  sampleValuesByHeader: Record<string, string[]> = {}
): SourceColumnMapping[] {
  const result: SourceColumnMapping[] = [];
  const assignedTargets = new Set<string>();

  for (const header of headers) {
    const samples = sampleValuesByHeader[header] ?? [];
    const trimmed = header.trim();

    if (IGNORED_COLUMN_NAMES.has(trimmed.toLowerCase())) {
      result.push({
        sourceHeader: trimmed,
        targetField: null,
        confidence: 'NEEDS_REVIEW',
        matchType: 'IGNORED',
        reason: 'Header matches common ignore keywords',
        sampleValues: samples,
      });
      continue;
    }

    const candidate = matchHeaderToCanonical(trimmed, kind);

    // If target was already assigned to an earlier column with higher confidence, flag as ambiguous
    if (candidate.targetField && assignedTargets.has(candidate.targetField)) {
      result.push({
        sourceHeader: trimmed,
        targetField: null,
        confidence: 'NEEDS_REVIEW',
        matchType: 'AMBIGUOUS',
        reason: `Target "${candidate.targetField}" was already matched to a preceding column.`,
        alternateCandidates: candidate.alternateCandidates ?? [candidate.targetField],
        sampleValues: samples,
      });
      continue;
    }

    if (candidate.targetField && candidate.confidence === 'HIGH') {
      assignedTargets.add(candidate.targetField);
    }

    result.push({
      sourceHeader: trimmed,
      ...candidate,
      sampleValues: samples,
    });
  }

  return result;
}

/**
 * Converts SourceColumnMapping[] into a clean key-value MappingSpecification (sourceHeader -> targetField).
 */
export function createMappingSpecification(
  mappings: SourceColumnMapping[]
): Record<string, string | null> {
  const spec: Record<string, string | null> = {};
  for (const m of mappings) {
    spec[m.sourceHeader] = m.targetField;
  }
  return spec;
}
