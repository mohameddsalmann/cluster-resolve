import { parse } from 'csv-parse/sync';
import { importHeaders, type ImportKind } from '@cluster/schemas/imports';
import { validateColumnMapping } from '@cluster/core/mapping/validator';
import { ImportJobError } from './errors';

export interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ImportJobError('INVALID_ENCODING', 'The file must use valid UTF-8 encoding.');
  }
}

export interface CsvInspectionResult {
  headers: string[];
  sampleRows: Array<{ rowNumber: number; values: Record<string, string> }>;
  totalDetectedRows: number;
}

export function inspectCsvHeadersAndSample(text: string, maxSampleRows = 5): CsvInspectionResult {
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: false,
    }) as string[][];
  } catch {
    throw new ImportJobError('INVALID_CSV', 'The file is not structurally valid CSV.');
  }

  if (records.length === 0) {
    throw new ImportJobError('INVALID_HEADER', 'The CSV file is empty.');
  }

  const headers = records[0].map((h) => h.trim());
  const dataRecords = records.slice(1);

  const sampleRows = dataRecords.slice(0, maxSampleRows).map((record, index) => {
    const values: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      values[headers[c]] = (record[c] ?? '').trim();
    }
    return {
      rowNumber: index + 2,
      values,
    };
  });

  return {
    headers,
    sampleRows,
    totalDetectedRows: dataRecords.length,
  };
}

export function parseCanonicalCsv(text: string, kind: ImportKind): ParsedCsvRow[] {
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: false,
    }) as string[][];
  } catch {
    throw new ImportJobError('INVALID_CSV', 'The file is not structurally valid CSV.');
  }

  if (records.length === 0) {
    throw new ImportJobError('INVALID_HEADER', 'The file must contain a canonical header row.');
  }

  const expected = [...importHeaders[kind]];
  const actual = records[0].map((value) => value.trim());
  const exact =
    actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  if (!exact || new Set(actual).size !== actual.length) {
    throw new ImportJobError(
      'INVALID_HEADER',
      `Expected exactly: ${expected.join(',')}`
    );
  }

  return records.slice(1).map((record, index) => {
    if (record.length !== expected.length) {
      throw new ImportJobError(
        'INVALID_CSV',
        `Row ${index + 2} contains ${record.length} columns; expected ${expected.length}.`
      );
    }
    return {
      rowNumber: index + 2,
      values: Object.fromEntries(expected.map((header, column) => [header, record[column].trim()])),
    };
  });
}

export function parseMappedCsv(
  text: string,
  kind: ImportKind,
  mapping?: Record<string, string | null> | null
): ParsedCsvRow[] {
  if (!mapping || Object.keys(mapping).length === 0) {
    return parseCanonicalCsv(text, kind);
  }

  // Validate mapping
  const validation = validateColumnMapping(mapping, kind);
  if (!validation.isValid) {
    const reasons: string[] = [];
    if (validation.missingRequiredFields.length > 0) {
      reasons.push(`Missing required fields: ${validation.missingRequiredFields.join(', ')}`);
    }
    if (validation.duplicateTargetFields.length > 0) {
      reasons.push(`Duplicate mapped fields: ${validation.duplicateTargetFields.join(', ')}`);
    }
    throw new ImportJobError('INVALID_MAPPING', reasons.join('. '));
  }

  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: false,
    }) as string[][];
  } catch {
    throw new ImportJobError('INVALID_CSV', 'The file is not structurally valid CSV.');
  }

  if (records.length === 0) {
    throw new ImportJobError('INVALID_HEADER', 'The file is empty.');
  }

  const rawHeaders = records[0].map((value) => value.trim());
  const headerIndexMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => headerIndexMap.set(h, idx));

  // Verify all mapped source columns exist in CSV headers
  for (const sourceHeader of Object.keys(mapping)) {
    if (!headerIndexMap.has(sourceHeader)) {
      throw new ImportJobError(
        'INVALID_MAPPING',
        `Mapped column "${sourceHeader}" is not present in the CSV headers.`
      );
    }
  }

  // Map each row
  return records.slice(1).map((record, index) => {
    const canonicalValues: Record<string, string> = {};

    for (const [sourceHeader, targetField] of Object.entries(mapping)) {
      if (targetField && targetField !== '') {
        const colIdx = headerIndexMap.get(sourceHeader);
        const val = colIdx !== undefined && colIdx < record.length ? record[colIdx].trim() : '';
        canonicalValues[targetField] = val;
      }
    }

    return {
      rowNumber: index + 2,
      values: canonicalValues,
    };
  });
}
