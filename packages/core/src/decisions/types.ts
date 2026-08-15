export type DecisionQualityClassification =
  | 'DOMINATED'
  | 'NON_DOMINATED'
  | 'SELECTED_NOT_FEASIBLE'
  | 'INSUFFICIENT_DATA';

export interface DecisionReplayOrderItem {
  productId: string;
  externalProductId: string;
  productName: string;
  requestedQty: number;
  unit: string;
}

export interface DecisionReplayOfferInput {
  id: string;
  externalOfferId: string;
  orderId: string;
  supplierId: string;
  supplierName: string;
  externalSupplierId: string;
  productId: string;
  availableQty: number;
  unitPriceMinor: bigint;
  discountBps: number;
  promisedDeliveryAt: string | null;
  offeredAt: string;
}

export interface DecisionReplayOutcomeInput {
  id: string;
  orderId: string;
  supplierId: string;
  productId: string;
  filledQty: number;
  deliveredAt: string | null;
  cancelled: boolean;
  cancellationReason: string | null;
  outcomeFinal: boolean;
}

import type { CurrentOfferPromiseRiskEvidence } from '../supplier/types';

export interface ReplaySupplierCandidate {
  supplierId: string;
  externalSupplierId: string;
  supplierName: string;
  isSelected: boolean;
  isFeasible: boolean;
  infeasibleReasons: string[];
  totalQuotedPriceMinor: bigint | null;
  maxPromisedDeliveryAt: string | null;
  offers: Array<{
    offerId: string;
    externalOfferId: string;
    productId: string;
    availableQty: number;
    requestedQty: number;
    unitPriceMinor: bigint;
    discountBps: number;
    effectiveItemPriceMinor: bigint;
    promisedDeliveryAt: string | null;
    offeredAt: string;
    promiseRisk?: CurrentOfferPromiseRiskEvidence | null;
  }>;
  promiseRisk?: CurrentOfferPromiseRiskEvidence | null;
  dominatesSelected: boolean;
  dominationReasons: string[];
}

export interface DecisionReplayEvaluationInput {
  decisionId: string;
  externalDecisionId: string;
  datasetId: string;
  orderId: string;
  externalOrderId: string;
  orderPlacedAt: string;
  pharmacyName?: string | null;
  selectedSupplierId: string;
  decidedAt: string;
  agentName?: string | null;
  agentVersion?: string | null;
  confidence?: string | number | null;
  selectionReason?: string | null;
  orderItems: DecisionReplayOrderItem[];
  rawOffers: DecisionReplayOfferInput[];
  selectedOutcome?: DecisionReplayOutcomeInput | null;
}

export interface DecisionReplayResult {
  decisionId: string;
  externalDecisionId: string;
  datasetId: string;
  orderId: string;
  externalOrderId: string;
  orderPlacedAt: string;
  pharmacyName: string | null;
  decidedAt: string;
  agentName: string | null;
  agentVersion: string | null;
  confidence: string | null;
  selectionReason: string | null;

  orderItems: DecisionReplayOrderItem[];
  totalRequestedUnits: number;

  selectedSupplier: {
    id: string;
    externalSupplierId: string;
    name: string;
  } | null;

  selectedCandidate: ReplaySupplierCandidate | null;

  selectedActualOutcome: {
    filledQty: number;
    fillRateBps: number;
    deliveredAt: string | null;
    cancelled: boolean;
    cancellationReason: string | null;
    isFinal: boolean;
  } | null;

  classification: DecisionQualityClassification;
  classificationReason: string;

  // Temporal integrity
  temporalRule: 'offered_at <= decided_at';
  consideredOffersCount: number;
  futureOffersExcludedCount: number;

  // Alternatives & Regret
  dominatingSupplier: ReplaySupplierCandidate | null;
  quotedPriceGapMinor: bigint | null;
  promisedDeliveryGapMinutes: number | null;
  actualSelectedShortfallUnits: number | null;
  actualSelectedLatenessMinutes: number | null;

  candidates: ReplaySupplierCandidate[];
}
