export type TraceabilityFormat = 'CSV' | 'XML_BARE' | 'XML_SOAP';

export type FindingSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface PreflightFinding {
  code: string;
  severity: FindingSeverity;
  rowOrEventIndex: number | null;
  field: string | null;
  message: string;
  evidence: string | null;
  officialRuleReference: string;
}

export interface PreflightResult {
  status: 'PASS' | 'FAIL';
  format: TraceabilityFormat;
  rulesVersion: string;
  totalRows: number;
  eventCount: number;
  serialCount: number;
  batchCount: number;
  findings: PreflightFinding[];
  errorCount: number;
  warningCount: number;
  wording: string;
  senderGln?: string | null;
  receiverGln?: string | null;
  instanceIdentifier?: string | null;
}

export interface RawParsedCsvRow {
  seqNo: string;
  Bizstep: string;
  eventTime: string;
  timeOffset: string;
  readPointGLN: string;
  bizLocationGLN: string;
  epc: string;
  Parent: string;
  import: string;
  expiryDate: string;
  manufDate: string;
}

export interface CanonicalTraceabilityEventRecord {
  eventType: 'COMMISSIONING' | 'PACKING' | 'SHIPPING';
  eventTime: string;
  timezoneOffset?: string | null;
  epc: string;
  gtin?: string | null;
  serial?: string | null;
  sscc?: string | null;
  batch?: string | null;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  parentEpc?: string | null;
  readPointGln: string;
  bizLocationGln: string;
  sourceGln?: string | null;
  destinationGln?: string | null;
  bizTransactionRef?: string | null;
  sourceFormat: TraceabilityFormat;
  sourceIndex: number;
}
