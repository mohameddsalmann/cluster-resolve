import type { Database } from './generated-types';

type PublicTables = Database['public']['Tables'];

export type DatasetMode = 'LIVE' | 'IMPORTED_REAL' | 'SAMPLE';
export type DatasetRow = Omit<PublicTables['datasets']['Row'], 'mode'> & {
  mode: DatasetMode;
};
export type DataSourceRow = PublicTables['data_sources']['Row'];
export type IngestionJobRow = PublicTables['ingestion_jobs']['Row'];
export type ProductRow = PublicTables['products']['Row'];
export type PharmacyRow = PublicTables['pharmacies']['Row'];
export type SupplierRow = PublicTables['suppliers']['Row'];
export type OrderRow = PublicTables['orders']['Row'];
export type OrderItemRow = PublicTables['order_items']['Row'];
export type OrderOutcomeRow = PublicTables['order_outcomes']['Row'];
export type AiDecisionRow = PublicTables['ai_decisions']['Row'];
export type AiDecisionCandidateRow = PublicTables['ai_decision_candidates']['Row'];
export type OrderExceptionRow = PublicTables['order_exceptions']['Row'];
export type SupplierReliabilitySnapshotRow = PublicTables['supplier_reliability_snapshots']['Row'];

// Generated PostgREST types represent int8 as number. The offer repository selects the
// column as text and validates it before converting to native JavaScript bigint.
export type SupplierOfferRow = Omit<
  PublicTables['supplier_offers']['Row'],
  'unit_price_minor'
> & {
  unit_price_minor: bigint;
};

export interface IngestionErrorRow {
  id: string;
  job_id: string;
  row_number: number;
  field: string | null;
  code: string;
  message: string;
  raw_value: string | null;
  created_at: string;
}

export interface RegulatoryNoticeRow {
  id: string;
  notice_number: string;
  title: string;
  year: number;
  notice_type: 'RECALL' | 'ALERT' | 'COMMERCIAL_FRAUD' | 'AWARENESS' | 'OTHER';
  recall_class: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | null;
  product_name: string;
  product_name_normalized: string;
  manufacturer: string | null;
  manufacturer_normalized: string | null;
  batch_numbers: string[];
  registration_number: string | null;
  reason: string | null;
  source_url: string;
  source_authority: string;
  source_doc_code: string | null;
  source_version: string | null;
  source_checksum: string | null;
  retrieved_at: string;
  created_at: string;
}

export interface RegulatoryExposureRow {
  id: string;
  dataset_id: string;
  notice_id: string;
  match_status: 'EXACT' | 'POSSIBLE' | 'UNMATCHED';
  match_reason: string;
  matched_product_id: string | null;
  affected_orders_count: number;
  affected_pharmacies_count: number;
  affected_suppliers_count: number;
  requested_units: number;
  filled_units: number;
  historical_value_minor: bigint;
  evidence_json: Record<string, unknown>;
  evaluated_at: string;
  created_at: string;
}

export interface TraceabilityImportRow {
  id: string;
  dataset_id: string;
  filename: string;
  format: 'CSV' | 'XML_BARE' | 'XML_SOAP';
  storage_path: string;
  file_sha256: string;
  file_size_bytes: number;
  preflight_status: 'PASS' | 'FAIL';
  total_rows: number;
  event_count: number;
  serial_count: number;
  batch_count: number;
  finding_count: number;
  rules_version: string;
  instance_identifier: string | null;
  sender_gln: string | null;
  receiver_gln: string | null;
  created_at: string;
}

export interface TraceabilityFindingRow {
  id: string;
  dataset_id: string;
  import_id: string;
  code: string;
  severity: 'ERROR' | 'WARNING';
  row_or_event_index: number | null;
  field: string | null;
  message: string;
  evidence: string | null;
  official_rule_reference: string;
  created_at: string;
}

export interface TraceabilityEventRow {
  id: string;
  dataset_id: string;
  import_id: string;
  event_type: 'COMMISSIONING' | 'PACKING' | 'SHIPPING';
  event_time: string;
  timezone_offset: string | null;
  epc: string;
  gtin: string | null;
  serial: string | null;
  sscc: string | null;
  batch: string | null;
  expiry_date: string | null;
  manufacturing_date: string | null;
  parent_epc: string | null;
  read_point_gln: string;
  biz_location_gln: string;
  source_gln: string | null;
  destination_gln: string | null;
  biz_transaction_ref: string | null;
  source_format: 'CSV' | 'XML_BARE' | 'XML_SOAP';
  source_index: number;
  created_at: string;
}

export interface TraceabilityProductLinkRow {
  id: string;
  dataset_id: string;
  product_id: string;
  gtin: string;
  status: 'CONFIRMED' | 'SUGGESTED';
  confidence_reason: string;
  created_at: string;
}

export interface TraceabilityReconciliationRow {
  id: string;
  dataset_id: string;
  order_id: string;
  product_id: string;
  reconciliation_status: 'MATCH' | 'MISMATCH' | 'INSUFFICIENT_LINKAGE' | 'INSUFFICIENT_TRACEABILITY_DATA';
  operational_qty: number;
  traceability_qty: number;
  difference_qty: number;
  business_ref: string | null;
  linked_import_id: string | null;
  evidence_json: Record<string, unknown>;
  reconciled_at: string;
  created_at: string;
}

