export type OrderExceptionType = 'CANCELLED' | 'PARTIAL_FILL' | 'UNFULFILLED' | 'LATE_DELIVERY';
export type OrderExceptionSeverity = 'MEDIUM' | 'HIGH';

export interface OperationalOrder {
  id: string;
  datasetId: string;
  placedAt: string;
}

export interface OperationalOrderItem {
  id: string;
  orderId: string;
  productId: string;
  requestedQty: number;
}

export interface OperationalOutcome {
  id: string;
  orderId: string;
  supplierId: string;
  productId: string;
  filledQty: number;
  deliveredAt: string | null;
  cancelled: boolean;
  outcomeFinal: boolean;
}

export interface OperationalOffer {
  id: string;
  orderId: string;
  supplierId: string;
  productId: string;
  promisedDeliveryAt: string | null;
  offeredAt: string;
}

export interface OperationalDecision {
  id: string;
  orderId: string;
  selectedSupplierId: string;
  decidedAt: string;
}

export interface OperationalEvaluationInput {
  orders: OperationalOrder[];
  items: OperationalOrderItem[];
  outcomes: OperationalOutcome[];
  offers: OperationalOffer[];
  decisions: OperationalDecision[];
}

export interface OrderException {
  datasetId: string;
  orderId: string;
  supplierId: string;
  productId: string;
  type: OrderExceptionType;
  severity: OrderExceptionSeverity;
  evidence: Record<string, string | number | boolean | null>;
}

export type EvaluationDiagnosticCode =
  | 'AMBIGUOUS_SUPPLIER_ALLOCATION'
  | 'MISSING_ORDER'
  | 'MISSING_ORDER_ITEM'
  | 'NON_FINAL_OUTCOME'
  | 'FILLED_EXCEEDS_REQUESTED'
  | 'AMBIGUOUS_PROMISE'
  | 'INVALID_LEAD_TIME';

export interface EvaluationDiagnostic {
  code: EvaluationDiagnosticCode;
  orderId: string;
  supplierId: string | null;
  productId: string | null;
  outcomeId: string | null;
}

export interface ApplicablePromise {
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'AMBIGUOUS';
  offerId: string | null;
  promisedDeliveryAt: string | null;
  decisionId: string | null;
}
