import type { CanonicalTraceabilityEventRecord } from '../eptts/types';
import type {
  OrderReconciliationRecord,
  ReconciliationStatus,
  TraceabilityOrderInput,
  TraceabilityProductLink,
} from './types';

export function reconcileOrdersWithTraceability(
  datasetId: string,
  orders: TraceabilityOrderInput[],
  events: CanonicalTraceabilityEventRecord[],
  productLinks: TraceabilityProductLink[],
  asOfDate: string = new Date().toISOString()
): OrderReconciliationRecord[] {
  const records: OrderReconciliationRecord[] = [];

  // Group confirmed product GTINs
  const confirmedProdToGtin = new Map<string, string>();
  const gtinToProd = new Map<string, string>();

  for (const link of productLinks) {
    if (link.status === 'CONFIRMED') {
      confirmedProdToGtin.set(link.productId, link.gtin);
      gtinToProd.set(link.gtin, link.productId);
    }
  }

  // Index shipping events by bizTransactionRef (order ID or invoice) and by GTIN
  const shippingEventsByRef = new Map<string, CanonicalTraceabilityEventRecord[]>();
  const shippingEventsByGtin = new Map<string, CanonicalTraceabilityEventRecord[]>();

  for (const ev of events) {
    if (ev.eventType === 'SHIPPING') {
      if (ev.bizTransactionRef) {
        const refKey = ev.bizTransactionRef.trim().toUpperCase();
        let refList = shippingEventsByRef.get(refKey);
        if (!refList) {
          refList = [];
          shippingEventsByRef.set(refKey, refList);
        }
        refList.push(ev);
      }

      if (ev.gtin) {
        let gtinList = shippingEventsByGtin.get(ev.gtin);
        if (!gtinList) {
          gtinList = [];
          shippingEventsByGtin.set(ev.gtin, gtinList);
        }
        gtinList.push(ev);
      }
    }
  }

  for (const order of orders) {
    const orderKey = order.externalOrderId.trim().toUpperCase();
    const matchingRefEvents = shippingEventsByRef.get(orderKey) || [];

    for (const item of order.items) {
      const outcome = order.outcomes.find((out) => out.productId === item.productId);
      const operationalQty = outcome ? outcome.filledQty : 0;
      const gtin = confirmedProdToGtin.get(item.productId) || null;

      let status: ReconciliationStatus = 'INSUFFICIENT_TRACEABILITY_DATA';
      let traceabilityQty = 0;
      let differenceQty = 0;
      let evidenceJson: Record<string, unknown> = {};

      if (!gtin) {
        // No confirmed GTIN crosswalk link
        status = 'INSUFFICIENT_TRACEABILITY_DATA';
        evidenceJson = {
          reason: 'Product does not have a CONFIRMED GTIN crosswalk linkage.',
          operationalFilledQty: operationalQty,
        };
      } else {
        // We have a confirmed GTIN
        // Look for shipping events matching this order reference and GTIN
        const orderProductEvents = matchingRefEvents.filter((ev) => ev.gtin === gtin);

        if (orderProductEvents.length > 0) {
          traceabilityQty = orderProductEvents.length;
          differenceQty = traceabilityQty - operationalQty;

          if (differenceQty === 0) {
            status = 'MATCH';
            evidenceJson = {
              matchType: 'EXACT_QUANTITY_MATCH',
              orderReference: order.externalOrderId,
              gtin,
              serializedCount: traceabilityQty,
              operationalFilledQty: operationalQty,
              matchedSerials: orderProductEvents.slice(0, 10).map((e) => e.serial),
            };
          } else {
            status = 'MISMATCH';
            evidenceJson = {
              matchType: 'QUANTITY_DISCREPANCY',
              orderReference: order.externalOrderId,
              gtin,
              traceabilityQty,
              operationalFilledQty: operationalQty,
              differenceQty,
              matchedSerials: orderProductEvents.slice(0, 10).map((e) => e.serial),
            };
          }
        } else {
          // Check if there are shipping events for this GTIN generally, but not with this order reference
          const generalGtinShipments = shippingEventsByGtin.get(gtin) || [];
          if (generalGtinShipments.length > 0) {
            status = 'INSUFFICIENT_LINKAGE';
            evidenceJson = {
              reason: `Found ${generalGtinShipments.length} shipping events for GTIN ${gtin}, but none cite order reference '${order.externalOrderId}'.`,
              operationalFilledQty: operationalQty,
            };
          } else {
            status = 'INSUFFICIENT_TRACEABILITY_DATA';
            evidenceJson = {
              reason: `Zero shipping events recorded for GTIN ${gtin}.`,
              operationalFilledQty: operationalQty,
            };
          }
        }
      }

      records.push({
        datasetId,
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        productId: item.productId,
        productName: item.productName,
        gtin,
        reconciliationStatus: status,
        operationalQty,
        traceabilityQty,
        differenceQty,
        businessRef: order.externalOrderId,
        linkedImportId: null,
        evidenceJson,
        reconciledAt: asOfDate,
      });
    }
  }

  return records;
}
