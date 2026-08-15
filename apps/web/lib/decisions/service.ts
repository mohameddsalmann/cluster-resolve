import {
  evaluateDecisionReplay,
  type DecisionReplayEvaluationInput,
  type DecisionReplayOfferInput,
  type DecisionReplayOrderItem,
  type DecisionReplayOutcomeInput,
  type DecisionReplayResult,
} from '@cluster/core/decisions';
import { getAiDecisionById } from '../db/repositories/decisions';
import { getOrderById, listOrderItemsByOrder } from '../db/repositories/orders';
import { getPharmacyById } from '../db/repositories/pharmacies';
import { getProductById } from '../db/repositories/products';
import { getSupplierById } from '../db/repositories/suppliers';
import { listSupplierOffersByOrder } from '../db/repositories/offers';
import { listOrderOutcomesByOrder } from '../db/repositories/outcomes';

export async function getDecisionReplay(
  datasetId: string,
  decisionId: string
): Promise<DecisionReplayResult | null> {
  const decision = await getAiDecisionById(datasetId, decisionId);
  if (!decision) return null;

  const order = await getOrderById(datasetId, decision.order_id);
  if (!order) return null;

  const pharmacy = await getPharmacyById(datasetId, order.pharmacy_id);
  const rawItems = await listOrderItemsByOrder(datasetId, order.id);

  // Fetch product metadata for items
  const orderItems: DecisionReplayOrderItem[] = await Promise.all(
    rawItems.map(async (item) => {
      const product = await getProductById(datasetId, item.product_id);
      return {
        productId: item.product_id,
        externalProductId: product?.external_product_id ?? item.product_id,
        productName: product?.name ?? 'Unknown Product',
        requestedQty: item.requested_qty,
        unit: item.unit,
      };
    })
  );

  // Fetch all supplier offers for this order in this dataset
  const rawOffers = await listSupplierOffersByOrder(datasetId, order.id);

  // Fetch suppliers for all offers
  const supplierCache = new Map<string, { id: string; name: string; externalId: string }>();

  async function getSupplierMeta(supplierId: string) {
    if (!supplierCache.has(supplierId)) {
      const supp = await getSupplierById(datasetId, supplierId);
      supplierCache.set(supplierId, {
        id: supplierId,
        name: supp?.name ?? 'Unknown Supplier',
        externalId: supp?.external_supplier_id ?? supplierId,
      });
    }
    return supplierCache.get(supplierId)!;
  }

  const replayOffers: DecisionReplayOfferInput[] = await Promise.all(
    rawOffers.map(async (offer) => {
      const supp = await getSupplierMeta(offer.supplier_id);
      return {
        id: offer.id,
        externalOfferId: offer.external_offer_id,
        orderId: offer.order_id,
        supplierId: offer.supplier_id,
        supplierName: supp.name,
        externalSupplierId: supp.externalId,
        productId: offer.product_id,
        availableQty: offer.available_qty,
        unitPriceMinor: BigInt(offer.unit_price_minor),
        discountBps: offer.discount_bps,
        promisedDeliveryAt: offer.promised_delivery_at,
        offeredAt: offer.offered_at,
      };
    })
  );

  // Fetch outcomes
  const rawOutcomes = await listOrderOutcomesByOrder(datasetId, order.id);
  const selectedOutcomeRow = rawOutcomes.find(
    (o) => o.supplier_id === decision.selected_supplier_id
  );

  let selectedOutcome: DecisionReplayOutcomeInput | null = null;
  if (selectedOutcomeRow) {
    selectedOutcome = {
      id: selectedOutcomeRow.id,
      orderId: selectedOutcomeRow.order_id,
      supplierId: selectedOutcomeRow.supplier_id,
      productId: selectedOutcomeRow.product_id,
      filledQty: selectedOutcomeRow.filled_qty,
      deliveredAt: selectedOutcomeRow.delivered_at,
      cancelled: selectedOutcomeRow.cancelled,
      cancellationReason: selectedOutcomeRow.cancellation_reason,
      outcomeFinal: selectedOutcomeRow.outcome_final,
    };
  }

  const evaluationInput: DecisionReplayEvaluationInput = {
    decisionId: decision.id,
    externalDecisionId: decision.external_decision_id,
    datasetId,
    orderId: order.id,
    externalOrderId: order.external_order_id,
    orderPlacedAt: order.placed_at,
    pharmacyName: pharmacy?.name ?? null,
    selectedSupplierId: decision.selected_supplier_id,
    decidedAt: decision.decided_at,
    agentName: decision.agent_name,
    agentVersion: decision.agent_version,
    confidence: decision.confidence,
    selectionReason: decision.selection_reason,
    orderItems,
    rawOffers: replayOffers,
    selectedOutcome,
  };

  return evaluateDecisionReplay(evaluationInput);
}
