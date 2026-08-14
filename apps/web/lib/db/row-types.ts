import type { Database } from './generated-types';

type PublicTables = Database['public']['Tables'];

export type DatasetMode = 'LIVE' | 'IMPORTED_REAL' | 'SAMPLE';
export type DatasetRow = Omit<PublicTables['datasets']['Row'], 'mode'> & {
  mode: DatasetMode;
};
export type ProductRow = PublicTables['products']['Row'];
export type PharmacyRow = PublicTables['pharmacies']['Row'];
export type SupplierRow = PublicTables['suppliers']['Row'];
export type OrderRow = PublicTables['orders']['Row'];
export type OrderItemRow = PublicTables['order_items']['Row'];
export type OrderOutcomeRow = PublicTables['order_outcomes']['Row'];
export type AiDecisionRow = PublicTables['ai_decisions']['Row'];
export type AiDecisionCandidateRow = PublicTables['ai_decision_candidates']['Row'];

// Generated PostgREST types represent int8 as number. The offer repository selects the
// column as text and validates it before converting to native JavaScript bigint.
export type SupplierOfferRow = Omit<
  PublicTables['supplier_offers']['Row'],
  'unit_price_minor'
> & {
  unit_price_minor: bigint;
};
