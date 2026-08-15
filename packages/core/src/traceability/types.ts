export type ExpiryBucket =
  | 'EXPIRED'
  | 'EXPIRING_90'
  | 'EXPIRING_180'
  | 'LATER'
  | 'UNKNOWN';

export interface ExpiryIntelligenceItem {
  epc: string;
  gtin: string | null;
  serial: string | null;
  batch: string | null;
  expiryDate: string | null;
  bucket: ExpiryBucket;
  daysToExpiry: number | null;
  readPointGln?: string | null;
  lastEventTime?: string;
  productName?: string | null;
}

export interface ExpirySummary {
  asOfDate?: string;
  totalSerializedUnits: number;
  expiredCount: number;
  expiring90DaysCount: number;
  expiring180DaysCount: number;
  laterCount: number;
  unknownExpiryCount: number;
}

export type ProductLinkStatus = 'CONFIRMED' | 'SUGGESTED';

export interface TraceabilityProductLink {
  id?: string;
  datasetId: string;
  productId: string;
  gtin: string;
  status: ProductLinkStatus;
  confidenceReason: string;
  createdAt?: string;
}

export type ReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'INSUFFICIENT_LINKAGE'
  | 'INSUFFICIENT_TRACEABILITY_DATA';

export interface OrderReconciliationRecord {
  id?: string;
  datasetId: string;
  orderId: string;
  externalOrderId: string;
  productId: string;
  productName: string;
  gtin: string | null;
  reconciliationStatus: ReconciliationStatus;
  operationalQty: number;
  traceabilityQty: number;
  differenceQty: number;
  businessRef: string | null;
  linkedImportId?: string | null;
  evidenceJson: Record<string, unknown>;
  reconciledAt: string;
}

export interface TraceabilityOrderInput {
  id: string;
  externalOrderId: string;
  pharmacyId: string;
  placedAt: string;
  items: Array<{
    productId: string;
    productName: string;
    requestedQty: number;
  }>;
  outcomes: Array<{
    productId: string;
    filledQty: number;
    cancelled: boolean;
  }>;
}

export interface TraceabilityProductCatalogItem {
  id: string;
  name: string;
  nameNormalized: string;
  externalProductId?: string | null;
  gtin?: string | null;
}
