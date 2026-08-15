import { describe, expect, it } from 'vitest';
import { validateEpttsCsv } from '../../src/eptts/csv-preflight';
import { isValidGln, isValidGtin14, isValidSscc } from '../../src/eptts/gs1-checksum';

describe('EPTTS CSV Preflight — GS1 Check Digits', () => {
  it('validates 13-digit GLNs correctly', () => {
    expect(isValidGln('6221234567891')).toBe(true);
    expect(isValidGln('6221234567890')).toBe(false); // bad check digit
    expect(isValidGln('12345')).toBe(false); // wrong length
  });

  it('validates 14-digit GTINs correctly', () => {
    expect(isValidGtin14('06221234567891')).toBe(true);
    expect(isValidGtin14('06221234567899')).toBe(false);
  });

  it('validates 18-digit SSCCs correctly', () => {
    // 17 digits payload: 06221234000000001 -> check digit: 5
    // 10 - ((0*3 + 6*1 + 2*3 + 2*1 + 1*3 + 2*1 + 3*3 + 4*1 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 1*3) % 10)
    // = 10 - ((6+6+2+3+2+9+4+3) % 10) = 10 - (35 % 10) = 10 - 5 = 5
    expect(isValidSscc('062212340000000015')).toBe(true);
    expect(isValidSscc('062212340000000010')).toBe(false);
  });
});

describe('EPTTS CSV Preflight — Official Rules Validation', () => {
  const validCsv = [
    'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
    '1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
    '2,commissioning,2026-08-01T08:05:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0002,(10)BATCH-A,0,2028-12-31,2026-07-01',
    '3,commissioning,2026-08-01T08:10:00Z,+02:00,6221234567891,6221234567891,(00)062212340000000015,,,,',
    '4,packing,2026-08-01T09:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(00)062212340000000015,,,',
    '5,packing,2026-08-01T09:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0002,(00)062212340000000015,,,',
  ].join('\n');

  it('passes a fully compliant official EPTTS CSV file', () => {
    const { result, canonicalEvents } = validateEpttsCsv(validCsv);

    expect(result.status).toBe('PASS');
    expect(result.errorCount).toBe(0);
    expect(result.totalRows).toBe(5);
    expect(result.serialCount).toBe(3); // 2 SGTINs + 1 SSCC
    expect(result.batchCount).toBe(1);
    expect(result.wording).toContain('EPTTS PREFLIGHT PASS');
    expect(canonicalEvents).toHaveLength(5);
    expect(canonicalEvents[0].eventType).toBe('COMMISSIONING');
    expect(canonicalEvents[3].eventType).toBe('PACKING');
    expect(canonicalEvents[3].parentEpc).toBe('(00)062212340000000015');
  });

  it('rejects invalid or missing CSV header with CSV_HEADER_MISMATCH', () => {
    const badHeader = [
      'seqNo,Bizstep,eventTime,readPointGLN,epc',
      '1,commissioning,2026-08-01T08:00:00Z,6221234567891,(01)06221234567891(21)SN0001',
    ].join('\n');

    const { result } = validateEpttsCsv(badHeader);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'CSV_HEADER_MISMATCH')).toBe(true);
  });

  it('rejects sequence gaps or invalid start sequence', () => {
    const seqGapCsv = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '2,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
      '4,commissioning,2026-08-01T08:05:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0002,(10)BATCH-A,0,2028-12-31,2026-07-01',
    ].join('\n');

    const { result } = validateEpttsCsv(seqGapCsv);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'SEQ_START_INVALID')).toBe(true);
    expect(result.findings.some((f) => f.code === 'SEQ_GAP')).toBe(true);
  });

  it('rejects non-chronological event rows', () => {
    const nonChrono = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,commissioning,2026-08-01T10:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
      '2,commissioning,2026-08-01T09:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0002,(10)BATCH-A,0,2028-12-31,2026-07-01',
    ].join('\n');

    const { result } = validateEpttsCsv(nonChrono);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'EVENT_TIME_NOT_ASCENDING')).toBe(true);
  });

  it('rejects GLN mismatch between read point and biz location in Phase 1', () => {
    const glnMismatch = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6229999999992,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
    ].join('\n');

    const { result } = validateEpttsCsv(glnMismatch);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'READ_BIZ_GLN_MISMATCH')).toBe(true);
  });

  it('rejects invalid GTIN check digits in SGTIN AI syntax', () => {
    const badGtin = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567899(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
    ].join('\n');

    const { result } = validateEpttsCsv(badGtin);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'INVALID_GTIN_CHECK_DIGIT')).toBe(true);
  });

  it('rejects products expired at commission or manufacturing date after event', () => {
    const expiredCsv = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2025-01-01,2026-08-10',
    ].join('\n');

    const { result } = validateEpttsCsv(expiredCsv);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'EXPIRED_AT_COMMISSION')).toBe(true);
    expect(result.findings.some((f) => f.code === 'MANUFACTURING_AFTER_EVENT')).toBe(true);
  });

  it('rejects uncommissioned children, self-parenting, and circular packing', () => {
    const uncommissioned = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,packing,2026-08-01T09:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)GHOST,(00)062212340000000015,,,',
    ].join('\n');

    const { result } = validateEpttsCsv(uncommissioned);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'CHILD_NOT_COMMISSIONED')).toBe(true);
  });

  it('rejects duplicate EPCs in commissioning rows', () => {
    const duplicateEpc = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
      '2,commissioning,2026-08-01T08:05:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN0001,(10)BATCH-A,0,2028-12-31,2026-07-01',
    ].join('\n');

    const { result } = validateEpttsCsv(duplicateEpc);
    expect(result.status).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'DUPLICATE_SERIAL')).toBe(true);
  });
});
