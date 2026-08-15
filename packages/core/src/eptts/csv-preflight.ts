import { isValidGln, isValidGtin14, isValidSscc } from './gs1-checksum';
import type {
  CanonicalTraceabilityEventRecord,
  PreflightFinding,
  PreflightResult,
  RawParsedCsvRow,
} from './types';

export const CSV_EXPECTED_HEADER =
  'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate';

export const RULES_VERSION_CSV = 'EDREX:NP.CIP.004/2026 v2.0 (July 2026)';

export function parseCsvRows(csvContent: string): {
  headerLine: string;
  rawRows: RawParsedCsvRow[];
  syntaxErrors: PreflightFinding[];
} {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      headerLine: '',
      rawRows: [],
      syntaxErrors: [
        {
          code: 'CSV_HEADER_MISMATCH',
          severity: 'ERROR',
          rowOrEventIndex: 0,
          field: 'header',
          message: 'File is empty. Expected official EPTTS CSV header.',
          evidence: '',
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.1 Table 1',
        },
      ],
    };
  }

  const headerLine = lines[0];
  const syntaxErrors: PreflightFinding[] = [];

  if (headerLine !== CSV_EXPECTED_HEADER) {
    syntaxErrors.push({
      code: 'CSV_HEADER_MISMATCH',
      severity: 'ERROR',
      rowOrEventIndex: 0,
      field: 'header',
      message: `CSV header does not match mandatory EPTTS specification. Expected: '${CSV_EXPECTED_HEADER}', Received: '${headerLine}'`,
      evidence: headerLine,
      officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.1 Table 1',
    });
  }

  const rawRows: RawParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i; // 1-indexed for data rows
    const cols = lines[i].split(',').map((c) => c.trim());

    if (cols.length !== 11) {
      syntaxErrors.push({
        code: 'CSV_ROW_MALFORMED',
        severity: 'ERROR',
        rowOrEventIndex: rowNumber,
        field: null,
        message: `Row ${rowNumber} has ${cols.length} columns, expected 11.`,
        evidence: lines[i],
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.1',
      });
      continue;
    }

    rawRows.push({
      seqNo: cols[0],
      Bizstep: cols[1],
      eventTime: cols[2],
      timeOffset: cols[3],
      readPointGLN: cols[4],
      bizLocationGLN: cols[5],
      epc: cols[6],
      Parent: cols[7],
      import: cols[8],
      expiryDate: cols[9],
      manufDate: cols[10],
    });
  }

  return { headerLine, rawRows, syntaxErrors };
}

export function validateEpttsCsv(csvContent: string): {
  result: PreflightResult;
  canonicalEvents: CanonicalTraceabilityEventRecord[];
} {
  const { rawRows, syntaxErrors } = parseCsvRows(csvContent);
  const findings: PreflightFinding[] = [...syntaxErrors];

  const commissionedSerials = new Set<string>();
  const commissionedBatches = new Set<string>();
  const commissionedEpcMap = new Map<string, { eventTime: number; gln: string; row: number }>();
  const parentChildMap = new Map<string, Set<string>>();

  let previousSeqNo: number | null = null;
  let previousEventTimeMs: number | null = null;

  const canonicalEvents: CanonicalTraceabilityEventRecord[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowIndex = i + 1; // row 1 in data

    // 1. SeqNo Validation
    const seqNum = parseInt(row.seqNo, 10);
    if (Number.isNaN(seqNum) || seqNum <= 0) {
      findings.push({
        code: 'SEQ_START_INVALID',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'seqNo',
        message: `Sequence number '${row.seqNo}' is invalid. Must be positive integer.`,
        evidence: row.seqNo,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 1',
      });
    } else if (i === 0 && seqNum !== 1) {
      findings.push({
        code: 'SEQ_START_INVALID',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'seqNo',
        message: `File sequence number must start at 1 on the first data row, found: ${seqNum}`,
        evidence: row.seqNo,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 1',
      });
    } else if (previousSeqNo !== null && seqNum !== previousSeqNo + 1) {
      findings.push({
        code: 'SEQ_GAP',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'seqNo',
        message: `Sequence gap detected at row ${rowIndex}: expected ${previousSeqNo + 1}, found ${seqNum}`,
        evidence: `prev: ${previousSeqNo}, curr: ${seqNum}`,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 1',
      });
    }
    previousSeqNo = Number.isNaN(seqNum) ? previousSeqNo : seqNum;

    // 2. Event Time & Chronological Order
    const eventTimeMs = Date.parse(row.eventTime);
    if (Number.isNaN(eventTimeMs)) {
      findings.push({
        code: 'INVALID_EVENT_TIME',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'eventTime',
        message: `Invalid ISO-8601 eventTime '${row.eventTime}'`,
        evidence: row.eventTime,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 2',
      });
    } else {
      if (previousEventTimeMs !== null && eventTimeMs < previousEventTimeMs) {
        findings.push({
          code: 'EVENT_TIME_NOT_ASCENDING',
          severity: 'ERROR',
          rowOrEventIndex: rowIndex,
          field: 'eventTime',
          message: `Row ${rowIndex} eventTime (${row.eventTime}) is earlier than previous row. Events must be sorted in ascending chronological order.`,
          evidence: row.eventTime,
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 2',
        });
      }
      previousEventTimeMs = eventTimeMs;
    }

    // 3. Bizstep
    const bizstep = row.Bizstep.trim().toLowerCase();
    if (bizstep !== 'commissioning' && bizstep !== 'packing') {
      findings.push({
        code: 'UNSUPPORTED_BIZSTEP',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'Bizstep',
        message: `Unsupported Bizstep '${row.Bizstep}'. Phase 1 CSV guide only permits 'commissioning' and 'packing'.`,
        evidence: row.Bizstep,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 3',
      });
    }

    // 4. Location GLN Validation
    const readGln = row.readPointGLN.trim();
    const bizGln = row.bizLocationGLN.trim();

    if (!isValidGln(readGln)) {
      findings.push({
        code: 'INVALID_GLN',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'readPointGLN',
        message: `readPointGLN '${readGln}' is not a valid 13-digit GLN with valid GS1 check digit.`,
        evidence: readGln,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 4',
      });
    }
    if (!isValidGln(bizGln)) {
      findings.push({
        code: 'INVALID_GLN',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'bizLocationGLN',
        message: `bizLocationGLN '${bizGln}' is not a valid 13-digit GLN with valid GS1 check digit.`,
        evidence: bizGln,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 4',
      });
    }
    if (readGln && bizGln && readGln !== bizGln) {
      findings.push({
        code: 'READ_BIZ_GLN_MISMATCH',
        severity: 'ERROR',
        rowOrEventIndex: rowIndex,
        field: 'bizLocationGLN',
        message: `readPointGLN (${readGln}) does not match bizLocationGLN (${bizGln}). In Phase 1 commissioning/packing, read point and biz location must be identical.`,
        evidence: `readPointGLN: ${readGln}, bizLocationGLN: ${bizGln}`,
        officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.2 Rule 4',
      });
    }

    // 5. Commissioning Bizstep Details
    if (bizstep === 'commissioning') {
      const epc = row.epc.trim();

      // Check if SGTIN: (01)<gtin14>(21)<serial>
      if (epc.startsWith('(01)')) {
        const sgtinMatch = /^\(01\)(\d{14})\(21\)([\w\-\.\/]{1,20})$/.exec(epc);
        if (!sgtinMatch) {
          findings.push({
            code: 'INVALID_SGTIN_FORMAT',
            severity: 'ERROR',
            rowOrEventIndex: rowIndex,
            field: 'epc',
            message: `Invalid SGTIN AI syntax: '${epc}'. Expected format: (01)<14-digit GTIN>(21)<serial 1-20 chars>.`,
            evidence: epc,
            officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 1',
          });
        } else {
          const gtin14 = sgtinMatch[1];
          const serial = sgtinMatch[2];

          if (!isValidGtin14(gtin14)) {
            findings.push({
              code: 'INVALID_GTIN_CHECK_DIGIT',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'epc',
              message: `GTIN-14 '${gtin14}' in EPC '${epc}' fails GS1 Modulo 10 check digit verification.`,
              evidence: gtin14,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 1',
            });
          }

          if (commissionedSerials.has(epc)) {
            findings.push({
              code: 'DUPLICATE_SERIAL',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'epc',
              message: `Duplicate SGTIN commissioning detected in file: '${epc}'`,
              evidence: epc,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 2',
            });
          } else {
            commissionedSerials.add(epc);
            commissionedEpcMap.set(epc, {
              eventTime: Number.isNaN(eventTimeMs) ? 0 : eventTimeMs,
              gln: readGln,
              row: rowIndex,
            });
          }

          // Parent must contain batch (10)<batch>
          const parent = row.Parent.trim();
          const batchMatch = /^\(10\)([\w\-\.\/]{1,20})$/.exec(parent);
          if (!batchMatch) {
            findings.push({
              code: 'INVALID_BATCH_AI_FORMAT',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'Parent',
              message: `Invalid Parent batch AI syntax '${parent}'. Commissioning SGTIN must have Parent in format: (10)<batch 1-20 chars>.`,
              evidence: parent,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 3',
            });
          } else {
            commissionedBatches.add(batchMatch[1]);
          }

          // Expiry Date Validation
          const expiryStr = row.expiryDate.trim();
          const expiryMs = Date.parse(expiryStr);
          if (!expiryStr || Number.isNaN(expiryMs)) {
            findings.push({
              code: 'INVALID_EXPIRY_DATE',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'expiryDate',
              message: `Invalid or missing expiryDate '${expiryStr}'. Must be valid date (YYYY-MM-DD).`,
              evidence: expiryStr,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 4',
            });
          } else if (!Number.isNaN(eventTimeMs) && expiryMs <= eventTimeMs) {
            findings.push({
              code: 'EXPIRED_AT_COMMISSION',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'expiryDate',
              message: `Product is expired at commissioning time (expiryDate ${expiryStr} <= eventTime ${row.eventTime}).`,
              evidence: `expiry: ${expiryStr}, eventTime: ${row.eventTime}`,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 4',
            });
          }

          // Manufacturing Date (Optional)
          const manufStr = row.manufDate.trim();
          if (manufStr) {
            const manufMs = Date.parse(manufStr);
            if (Number.isNaN(manufMs)) {
              findings.push({
                code: 'INVALID_EXPIRY_DATE',
                severity: 'ERROR',
                rowOrEventIndex: rowIndex,
                field: 'manufDate',
                message: `Invalid manufDate '${manufStr}'`,
                evidence: manufStr,
                officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 5',
              });
            } else if (!Number.isNaN(eventTimeMs) && manufMs > eventTimeMs) {
              findings.push({
                code: 'MANUFACTURING_AFTER_EVENT',
                severity: 'ERROR',
                rowOrEventIndex: rowIndex,
                field: 'manufDate',
                message: `Manufacturing date (${manufStr}) cannot be in the future relative to eventTime (${row.eventTime}).`,
                evidence: `manufDate: ${manufStr}, eventTime: ${row.eventTime}`,
                officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 5',
              });
            }
          }

          // Import flag
          const importStr = row.import.trim().toUpperCase();
          if (importStr && !['0', '1', 'TRUE', 'FALSE', 'Y', 'N'].includes(importStr)) {
            findings.push({
              code: 'INVALID_IMPORT_FLAG',
              severity: 'WARNING',
              rowOrEventIndex: rowIndex,
              field: 'import',
              message: `Unrecognized import flag '${row.import}'. Expected 0/1 or Y/N.`,
              evidence: row.import,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 6',
            });
          }

          canonicalEvents.push({
            eventType: 'COMMISSIONING',
            eventTime: row.eventTime,
            timezoneOffset: row.timeOffset || null,
            epc,
            gtin: gtin14,
            serial,
            batch: batchMatch ? batchMatch[1] : null,
            expiryDate: !Number.isNaN(expiryMs) ? new Date(expiryMs).toISOString().slice(0, 10) : null,
            manufacturingDate: manufStr && !Number.isNaN(Date.parse(manufStr)) ? new Date(manufStr).toISOString().slice(0, 10) : null,
            readPointGln: readGln,
            bizLocationGln: bizGln,
            sourceFormat: 'CSV',
            sourceIndex: rowIndex,
          });
        }
      } else if (epc.startsWith('(00)')) {
        // Commissioning SSCC: (00)<18-digit SSCC>
        const ssccMatch = /^\(00\)(\d{18})$/.exec(epc);
        if (!ssccMatch) {
          findings.push({
            code: 'INVALID_SSCC_FORMAT',
            severity: 'ERROR',
            rowOrEventIndex: rowIndex,
            field: 'epc',
            message: `Invalid SSCC AI syntax: '${epc}'. Expected format: (00)<18-digit SSCC>.`,
            evidence: epc,
            officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.4 Rule 1',
          });
        } else {
          const sscc18 = ssccMatch[1];
          if (!isValidSscc(sscc18)) {
            findings.push({
              code: 'INVALID_SSCC_CHECK_DIGIT',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'epc',
              message: `SSCC-18 '${sscc18}' in EPC '${epc}' fails GS1 Modulo 10 check digit verification.`,
              evidence: sscc18,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.4 Rule 1',
            });
          }

          if (commissionedSerials.has(epc)) {
            findings.push({
              code: 'DUPLICATE_SERIAL',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'epc',
              message: `Duplicate SSCC commissioning detected in file: '${epc}'`,
              evidence: epc,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.4 Rule 2',
            });
          } else {
            commissionedSerials.add(epc);
            commissionedEpcMap.set(epc, {
              eventTime: Number.isNaN(eventTimeMs) ? 0 : eventTimeMs,
              gln: readGln,
              row: rowIndex,
            });
          }

          // Parent, import, expiryDate, manufDate must all be blank for SSCC commissioning
          if (row.Parent.trim() || row.import.trim() || row.expiryDate.trim() || row.manufDate.trim()) {
            findings.push({
              code: 'SSCC_FIELDS_MUST_BE_BLANK',
              severity: 'ERROR',
              rowOrEventIndex: rowIndex,
              field: 'Parent',
              message: `Commissioning SSCC must leave Parent, import, expiryDate, and manufDate blank. Found non-blank data.`,
              evidence: `Parent: '${row.Parent}', expiry: '${row.expiryDate}'`,
              officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.4 Rule 3',
            });
          }

          canonicalEvents.push({
            eventType: 'COMMISSIONING',
            eventTime: row.eventTime,
            timezoneOffset: row.timeOffset || null,
            epc,
            sscc: sscc18,
            readPointGln: readGln,
            bizLocationGln: bizGln,
            sourceFormat: 'CSV',
            sourceIndex: rowIndex,
          });
        }
      } else {
        findings.push({
          code: 'INVALID_EPC_FORMAT',
          severity: 'ERROR',
          rowOrEventIndex: rowIndex,
          field: 'epc',
          message: `Unrecognized EPC format '${epc}'. Must start with (01) for SGTIN or (00) for SSCC.`,
          evidence: epc,
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.3 Rule 1',
        });
      }
    } else if (bizstep === 'packing') {
      // 6. Packing (Aggregation)
      const childEpc = row.epc.trim();
      const parentEpc = row.Parent.trim();

      // Parent must be SSCC: (00)<18-digits>
      const parentSsccMatch = /^\(00\)(\d{18})$/.exec(parentEpc);
      if (!parentSsccMatch) {
        findings.push({
          code: 'INVALID_SSCC_FORMAT',
          severity: 'ERROR',
          rowOrEventIndex: rowIndex,
          field: 'Parent',
          message: `Packing row Parent must be SSCC format '(00)<18-digit SSCC>'. Found: '${parentEpc}'`,
          evidence: parentEpc,
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.5 Rule 1',
        });
      } else {
        const parentSscc = parentSsccMatch[1];
        if (!isValidSscc(parentSscc)) {
          findings.push({
            code: 'INVALID_SSCC_CHECK_DIGIT',
            severity: 'ERROR',
            rowOrEventIndex: rowIndex,
            field: 'Parent',
            message: `Parent SSCC '${parentSscc}' fails check digit validation.`,
            evidence: parentSscc,
            officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.5 Rule 1',
          });
        }
      }

      // Check child self-parenting
      if (childEpc === parentEpc) {
        findings.push({
          code: 'SELF_PARENTING',
          severity: 'ERROR',
          rowOrEventIndex: rowIndex,
          field: 'Parent',
          message: `Child EPC cannot be its own Parent: '${childEpc}'`,
          evidence: childEpc,
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.5 Rule 2',
        });
      }

      // Check if child was commissioned
      const commissionInfo = commissionedEpcMap.get(childEpc);
      if (!commissionInfo) {
        findings.push({
          code: 'CHILD_NOT_COMMISSIONED',
          severity: 'ERROR',
          rowOrEventIndex: rowIndex,
          field: 'epc',
          message: `Packed child EPC '${childEpc}' was not commissioned prior in this file.`,
          evidence: childEpc,
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.5 Rule 3',
        });
      } else {
        if (!Number.isNaN(eventTimeMs) && eventTimeMs < commissionInfo.eventTime) {
          findings.push({
            code: 'PACK_BEFORE_COMMISSION',
            severity: 'ERROR',
            rowOrEventIndex: rowIndex,
            field: 'eventTime',
            message: `Packing eventTime (${row.eventTime}) is earlier than child commissioning eventTime (row ${commissionInfo.row}).`,
            evidence: `pack: ${row.eventTime}, commission: ${commissionInfo.eventTime}`,
            officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.5 Rule 3',
          });
        }
      }

      // Check circular hierarchy
      let children = parentChildMap.get(parentEpc);
      if (!children) {
        children = new Set<string>();
        parentChildMap.set(parentEpc, children);
      }
      children.add(childEpc);

      const parentChildren = parentChildMap.get(childEpc);
      if (parentChildren && parentChildren.has(parentEpc)) {
        findings.push({
          code: 'CIRCULAR_HIERARCHY',
          severity: 'ERROR',
          rowOrEventIndex: rowIndex,
          field: 'Parent',
          message: `Circular parent-child packing hierarchy detected between '${parentEpc}' and '${childEpc}'.`,
          evidence: `${parentEpc} <-> ${childEpc}`,
          officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 2.5 Rule 4',
        });
      }

      canonicalEvents.push({
        eventType: 'PACKING',
        eventTime: row.eventTime,
        timezoneOffset: row.timeOffset || null,
        epc: childEpc,
        parentEpc,
        readPointGln: readGln,
        bizLocationGln: bizGln,
        sourceFormat: 'CSV',
        sourceIndex: rowIndex,
      });
    }
  }

  // 7. Global Batch and Serial Limits
  if (commissionedSerials.size > 50000) {
    findings.push({
      code: 'TOO_MANY_SERIALS',
      severity: 'ERROR',
      rowOrEventIndex: null,
      field: null,
      message: `File contains ${commissionedSerials.size} serial numbers, exceeding the maximum limit of 50,000 per file.`,
      evidence: `${commissionedSerials.size} serials`,
      officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 3.2',
    });
  }

  if (commissionedBatches.size > 5) {
    findings.push({
      code: 'TOO_MANY_BATCHES',
      severity: 'ERROR',
      rowOrEventIndex: null,
      field: null,
      message: `File contains ${commissionedBatches.size} distinct batches for commissioning SGTINs, exceeding the maximum limit of 5 batches per file.`,
      evidence: `Batches found: ${Array.from(commissionedBatches).join(', ')}`,
      officialRuleReference: 'EDREX:NP.CIP.004/2026 Section 3.2',
    });
  }

  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warnings = findings.filter((f) => f.severity === 'WARNING');
  const isPass = errors.length === 0;

  const wording = isPass
    ? `EPTTS PREFLIGHT PASS Validated against implemented official-source rules (${RULES_VERSION_CSV})`
    : `EPTTS PREFLIGHT FAIL Validated against implemented official-source rules (${RULES_VERSION_CSV})`;

  return {
    result: {
      status: isPass ? 'PASS' : 'FAIL',
      format: 'CSV',
      rulesVersion: RULES_VERSION_CSV,
      totalRows: rawRows.length,
      eventCount: canonicalEvents.length,
      serialCount: commissionedSerials.size,
      batchCount: commissionedBatches.size,
      findings,
      errorCount: errors.length,
      warningCount: warnings.length,
      wording,
    },
    canonicalEvents: isPass ? canonicalEvents : [],
  };
}
