import type { EvaluationDiagnostic, OperationalEvaluationInput } from '../exceptions/types';

export type SupplierStatus = 'HEALTHY' | 'WATCH' | 'HIGH' | 'INSUFFICIENT_DATA';
export type DeteriorationTriggerCode =
  | 'FILL_RATE_DROP'
  | 'OTIF_DROP'
  | 'CANCELLATION_INCREASE'
  | 'PARTIAL_FILL_INCREASE'
  | 'LEAD_TIME_P95_DETERIORATION';

export type PromiseRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
export type CoachingInsightSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type PharmacyServiceRiskLevel = 'STABLE' | 'AT_RISK' | 'HIGH_RISK';

export interface SupplierOrderObservation {
  datasetId: string;
  supplierId: string;
  orderId: string;
  placedAt: string;
  requestedUnits: number;
  filledUnits: number;
  cancellationAffected: boolean;
  fullyFilled: boolean;
  partialFill: boolean;
  otifEligible: boolean;
  otif: boolean | null;
  deliveryCompletionAt: string | null;
  leadTimeMinutes: number | null;
  outcomeIds: string[];
  productIds: string[];
  /** Promised delivery timestamp from the supplier offer, if any. */
  promisedDeliveryAt: string | null;
}

export interface ObservationBuildResult {
  observations: SupplierOrderObservation[];
  diagnostics: EvaluationDiagnostic[];
}

export interface ReliabilityMetrics {
  evaluatedOrders: number;
  fillRateBps: number | null;
  otifRateBps: number | null;
  cancellationRateBps: number | null;
  partialFillRateBps: number | null;
  leadTimeP50Minutes: number | null;
  leadTimeP95Minutes: number | null;
}

export interface DeteriorationTrigger {
  code: DeteriorationTriggerCode;
  recent: number;
  baseline: number;
  delta: number;
  threshold: number;
  severe: boolean;
  evaluatedOrderCount: number;
}

export interface SupplierReliabilityEvaluation {
  datasetId: string;
  supplierId: string;
  asOf: string;
  recentWindowDays: number;
  baselineWindowDays: number;
  recent: ReliabilityMetrics;
  baseline: ReliabilityMetrics;
  status: SupplierStatus;
  triggers: DeteriorationTrigger[];
  recentOrderIds: string[];
  baselineOrderIds: string[];
}

/** Per-supplier-per-product reliability evaluation (same shape, product-scoped). */
export interface SupplierProductReliabilityEvaluation {
  datasetId: string;
  supplierId: string;
  productId: string;
  asOf: string;
  recentWindowDays: number;
  baselineWindowDays: number;
  recent: ReliabilityMetrics;
  baseline: ReliabilityMetrics;
  status: SupplierStatus;
  triggers: DeteriorationTrigger[];
}

/** Measures how reliably a supplier honours its promised delivery dates. */
export interface PromiseRiskMetrics {
  promiseGivenCount: number;
  promiseHonouredCount: number;
  promiseHonouredBps: number | null;
  promiseRiskLevel: PromiseRiskLevel;
}

/** A single structured coaching insight derived deterministically from evaluation data. */
export interface CoachingInsight {
  code: string;
  severity: CoachingInsightSeverity;
  message: string;
  evidenceKeys: string[];
}

/** Per-pharmacy operational service risk derived from exception history. */
export interface PharmacyServiceRisk {
  pharmacyId: string;
  totalOrders: number;
  ordersWithExceptions: number;
  exceptionRateBps: number | null;
  cancellationAffected: number;
  partialFillAffected: number;
  highSeverityExceptions: number;
  serviceRiskLevel: PharmacyServiceRiskLevel;
}

/** Current Offer Promise Risk states — deterministic assessment of recorded offer vs fulfillment history. */
export type CurrentOfferPromiseRiskState = 'LOW' | 'WATCH' | 'HIGH' | 'INSUFFICIENT_DATA';

export interface CurrentOfferPromiseRiskTrigger {
  code:
    | 'LEAD_TIME_BELOW_P95'
    | 'LEAD_TIME_BELOW_P50'
    | 'POOR_FILL_RATE_HISTORY'
    | 'ELEVATED_CANCELLATIONS'
    | 'FREQUENT_PARTIAL_FILLS';
  severity: 'WARN' | 'CRITICAL';
  message: string;
  evidenceKey: string;
}

export interface CurrentOfferPromiseRiskEvidence {
  level: CurrentOfferPromiseRiskState;
  evidenceSource: 'PRODUCT' | 'SUPPLIER' | 'NONE';
  currentOffer: {
    requestedQty: number;
    availableQty: number;
    promisedDeliveryAt: string | null;
    orderPlacedAt: string;
    promisedLeadTimeMinutes: number | null;
  };
  historicalEvidence: {
    evaluatedOrders: number;
    fillRateBps: number | null;
    otifRateBps: number | null;
    cancellationRateBps: number | null;
    partialFillRateBps: number | null;
    leadTimeP50Minutes: number | null;
    leadTimeP95Minutes: number | null;
  };
  triggers: CurrentOfferPromiseRiskTrigger[];
  summary: string;
}

export interface CurrentOfferPromiseRiskInput {
  requestedQty: number;
  availableQty: number;
  promisedDeliveryAt: string | null;
  orderPlacedAt: string;
  productMetrics?: ReliabilityMetrics | null;
  supplierMetrics: ReliabilityMetrics;
}

export type SupplierObservationInput = OperationalEvaluationInput;
