import type { EvaluationDiagnostic, OperationalEvaluationInput } from '../exceptions/types';

export type SupplierStatus = 'HEALTHY' | 'WATCH' | 'HIGH' | 'INSUFFICIENT_DATA';
export type DeteriorationTriggerCode =
  | 'FILL_RATE_DROP'
  | 'OTIF_DROP'
  | 'CANCELLATION_INCREASE'
  | 'PARTIAL_FILL_INCREASE'
  | 'LEAD_TIME_P95_DETERIORATION';

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

export type SupplierObservationInput = OperationalEvaluationInput;
