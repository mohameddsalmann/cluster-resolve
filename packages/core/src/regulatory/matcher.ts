import type {
  ProcurementOrderRecord,
  ProcurementProductRecord,
  RegulatoryDatasetEvaluationSummary,
  RegulatoryEvaluationExposure,
  RegulatoryMatchStatus,
  RegulatoryMatchedOrderEvidence,
  RegulatoryNoticeSource,
} from './types';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractCoreTokens(normalizedName: string): string[] {
  return normalizedName
    .split(' ')
    .filter((token) => token.length > 2 && !['and', 'for', 'the', 'with', 'tablets', 'capsules', 'suspension'].includes(token));
}

export function determineNoticeMatch(
  notice: RegulatoryNoticeSource,
  products: ProcurementProductRecord[]
): {
  matchStatus: RegulatoryMatchStatus;
  matchReason: string;
  matchedProduct: ProcurementProductRecord | null;
} {
  const normNoticeName = normalizeText(notice.productName);
  const noticeTokens = extractCoreTokens(normNoticeName);

  for (const product of products) {
    const normProdName = normalizeText(product.nameNormalized || product.name);

    // 1. Exact GTIN or Product ID Match
    if (product.gtin && notice.registrationNumber && product.gtin === notice.registrationNumber) {
      return {
        matchStatus: 'EXACT',
        matchReason: `Exact identifier match against GTIN/registration ${product.gtin}`,
        matchedProduct: product,
      };
    }

    // 2. Exact normalized name match
    if (normProdName === normNoticeName) {
      if (notice.batchNumbers.length > 0) {
        return {
          matchStatus: 'POSSIBLE',
          matchReason: `Product name matches '${product.name}', but batch numbers [${notice.batchNumbers.join(', ')}] require physical inventory verification (batch not tracked in procurement line items).`,
          matchedProduct: product,
        };
      }
      return {
        matchStatus: 'POSSIBLE',
        matchReason: `Exact product name match with '${product.name}'.`,
        matchedProduct: product,
      };
    }

    // 3. Significant Substring / Token Overlap Match
    const prodTokens = extractCoreTokens(normProdName);
    if (noticeTokens.length > 0 && prodTokens.length > 0) {
      const firstNoticeToken = noticeTokens[0];
      const firstProdToken = prodTokens[0];

      // If active substance / primary brand token matches
      if (firstNoticeToken === firstProdToken && firstNoticeToken.length >= 4) {
        const commonTokens = noticeTokens.filter((t) => prodTokens.includes(t));
        if (commonTokens.length >= 2 || (commonTokens.length === 1 && (normNoticeName.includes(normProdName) || normProdName.includes(normNoticeName)))) {
          return {
            matchStatus: 'POSSIBLE',
            matchReason: `Matched active product line '${product.name}' based on pharmaceutical brand/ingredient '${firstNoticeToken}' (${commonTokens.join(', ')}). Batch verification needed.`,
            matchedProduct: product,
          };
        }
      }
    }
  }

  return {
    matchStatus: 'UNMATCHED',
    matchReason: 'No matching product or active ingredient found in dataset catalog.',
    matchedProduct: null,
  };
}

export function evaluateRegulatoryExposures(
  datasetId: string,
  notices: RegulatoryNoticeSource[],
  products: ProcurementProductRecord[],
  orders: ProcurementOrderRecord[],
  asOfDate: string = new Date().toISOString()
): RegulatoryDatasetEvaluationSummary {
  const exposures: RegulatoryEvaluationExposure[] = [];
  let exactCount = 0;
  let possibleCount = 0;
  let unmatchedCount = 0;
  let totalExposedValue = 0n;
  const globalAffectedOrderIds = new Set<string>();

  for (const notice of notices) {
    const { matchStatus, matchReason, matchedProduct } = determineNoticeMatch(notice, products);

    if (matchStatus === 'UNMATCHED' || !matchedProduct) {
      unmatchedCount++;
      exposures.push({
        noticeId: notice.noticeNumber,
        noticeNumber: notice.noticeNumber,
        year: notice.year,
        productName: notice.productName,
        noticeType: notice.noticeType,
        recallClass: notice.recallClass,
        sourceUrl: notice.sourceUrl,
        matchStatus: 'UNMATCHED',
        matchReason,
        matchedProductId: null,
        matchedProductName: null,
        affectedOrdersCount: 0,
        affectedPharmaciesCount: 0,
        affectedSuppliersCount: 0,
        requestedUnits: 0,
        filledUnits: 0,
        historicalValueMinor: 0n,
        evidence: {
          matchedProductId: null,
          matchedProductName: null,
          matchReason,
          affectedOrderIds: [],
          affectedPharmacyIds: [],
          affectedSupplierIds: [],
        },
      });
      continue;
    }

    if (matchStatus === 'EXACT') exactCount++;
    if (matchStatus === 'POSSIBLE') possibleCount++;

    // Calculate operational exposure across orders for matched product
    const matchingOrders = orders.filter((o) =>
      o.items.some((item) => item.productId === matchedProduct.id)
    );

    const affectedPharmacies = new Set<string>();
    const affectedSuppliers = new Set<string>();
    let totalRequested = 0;
    let totalFilled = 0;
    let exposureValueMinor = 0n;
    const sampleOrders: RegulatoryMatchedOrderEvidence[] = [];

    for (const order of matchingOrders) {
      globalAffectedOrderIds.add(order.id);
      affectedPharmacies.add(order.pharmacyId);

      for (const item of order.items) {
        if (item.productId === matchedProduct.id) {
          totalRequested += item.requestedQty;

          // Check outcome & offer price
          const outcome = order.outcomes.find((out) => out.productId === matchedProduct.id);
          const offer = order.offers.find((off) => off.productId === matchedProduct.id);
          const supplierId = outcome?.supplierId || offer?.supplierId || 'UNKNOWN_SUPPLIER';

          if (supplierId !== 'UNKNOWN_SUPPLIER') {
            affectedSuppliers.add(supplierId);
          }

          const filled = outcome ? outcome.filledQty : 0;
          totalFilled += filled;

          const unitPrice = offer ? offer.unitPriceMinor : 0n;
          const orderVal = unitPrice * BigInt(filled > 0 ? filled : item.requestedQty);
          exposureValueMinor += orderVal;

          if (sampleOrders.length < 10) {
            sampleOrders.push({
              orderId: order.id,
              externalOrderId: order.externalOrderId,
              pharmacyId: order.pharmacyId,
              supplierId,
              requestedQty: item.requestedQty,
              filledQty: filled,
              orderValueMinor: orderVal,
              placedAt: order.placedAt,
            });
          }
        }
      }
    }

    totalExposedValue += exposureValueMinor;

    exposures.push({
      noticeId: notice.noticeNumber,
      noticeNumber: notice.noticeNumber,
      year: notice.year,
      productName: notice.productName,
      noticeType: notice.noticeType,
      recallClass: notice.recallClass,
      sourceUrl: notice.sourceUrl,
      matchStatus,
      matchReason,
      matchedProductId: matchedProduct.id,
      matchedProductName: matchedProduct.name,
      affectedOrdersCount: matchingOrders.length,
      affectedPharmaciesCount: affectedPharmacies.size,
      affectedSuppliersCount: affectedSuppliers.size,
      requestedUnits: totalRequested,
      filledUnits: totalFilled,
      historicalValueMinor: exposureValueMinor,
      evidence: {
        matchedProductId: matchedProduct.id,
        matchedProductName: matchedProduct.name,
        matchReason,
        affectedOrderIds: matchingOrders.map((o) => o.id),
        affectedPharmacyIds: Array.from(affectedPharmacies),
        affectedSupplierIds: Array.from(affectedSuppliers),
        sampleOrders,
      },
    });
  }

  return {
    datasetId,
    evaluatedAt: asOfDate,
    totalNoticesEvaluated: notices.length,
    exactMatchesCount: exactCount,
    possibleMatchesCount: possibleCount,
    unmatchedCount,
    totalExposedValueMinor: totalExposedValue,
    totalAffectedOrders: globalAffectedOrderIds.size,
    exposures,
  };
}
