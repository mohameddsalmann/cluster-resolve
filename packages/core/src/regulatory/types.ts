export type NoticeType =
  | 'RECALL'
  | 'ALERT'
  | 'COMMERCIAL_FRAUD'
  | 'AWARENESS'
  | 'OTHER';

export type RecallClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III';

export type RegulatoryMatchStatus = 'EXACT' | 'POSSIBLE' | 'UNMATCHED';

export interface RegulatoryNoticeSource {
  noticeNumber: string;
  title: string;
  year: number;
  noticeType: NoticeType;
  recallClass: RecallClass | null;
  productName: string;
  manufacturer: string | null;
  batchNumbers: string[];
  registrationNumber: string | null;
  reason: string | null;
  sourceUrl: string;
  sourceAuthority: string;
  sourceDocCode: string | null;
  sourceVersion: string | null;
  sourceChecksum?: string;
  retrievedAt?: string;
}

export interface RegulatoryMatchedOrderEvidence {
  orderId: string;
  externalOrderId: string;
  pharmacyId: string;
  supplierId: string;
  requestedQty: number;
  filledQty: number;
  orderValueMinor: bigint;
  placedAt: string;
}

export interface RegulatoryEvaluationExposure {
  noticeId: string;
  noticeNumber: string;
  year: number;
  productName: string;
  noticeType: NoticeType;
  recallClass: RecallClass | null;
  sourceUrl: string;
  matchStatus: RegulatoryMatchStatus;
  matchReason: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  affectedOrdersCount: number;
  affectedPharmaciesCount: number;
  affectedSuppliersCount: number;
  requestedUnits: number;
  filledUnits: number;
  historicalValueMinor: bigint;
  evidence: {
    matchedProductId: string | null;
    matchedProductName: string | null;
    matchReason: string;
    affectedOrderIds: string[];
    affectedPharmacyIds: string[];
    affectedSupplierIds: string[];
    sampleOrders?: RegulatoryMatchedOrderEvidence[];
  };
}

export interface RegulatoryDatasetEvaluationSummary {
  datasetId: string;
  evaluatedAt: string;
  totalNoticesEvaluated: number;
  exactMatchesCount: number;
  possibleMatchesCount: number;
  unmatchedCount: number;
  totalExposedValueMinor: bigint;
  totalAffectedOrders: number;
  exposures: RegulatoryEvaluationExposure[];
}

export interface ProcurementProductRecord {
  id: string;
  name: string;
  nameNormalized: string;
  externalProductId?: string | null;
  gtin?: string | null;
}

export interface ProcurementOrderRecord {
  id: string;
  externalOrderId: string;
  pharmacyId: string;
  placedAt: string;
  items: Array<{
    productId: string;
    requestedQty: number;
  }>;
  offers: Array<{
    supplierId: string;
    productId: string;
    unitPriceMinor: bigint;
  }>;
  outcomes: Array<{
    supplierId: string;
    productId: string;
    filledQty: number;
    cancelled: boolean;
  }>;
}
