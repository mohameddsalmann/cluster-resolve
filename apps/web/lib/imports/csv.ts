import { parse } from 'csv-parse/sync';
import { importHeaders, type ImportKind } from '@cluster/schemas/imports';
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
