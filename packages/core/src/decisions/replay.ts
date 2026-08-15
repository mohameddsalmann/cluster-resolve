import type {
  DecisionReplayEvaluationInput,
  DecisionReplayResult,
  ReplaySupplierCandidate,
} from './types';

/**
 * Calculates net price per unit after discount in minor units.
 */
function calculateEffectiveUnitPriceMinor(unitPriceMinor: bigint, discountBps: number): bigint {
  if (discountBps <= 0) return unitPriceMinor;
  const factor = 10_000n - BigInt(Math.min(10_000, Math.max(0, discountBps)));
  return (unitPriceMinor * factor) / 10_000n;
}

/**
 * Evaluates forensic decision replay and deterministic decision quality.
 */
export function evaluateDecisionReplay(
  input: DecisionReplayEvaluationInput
): DecisionReplayResult {
  const decidedAtMs = new Date(input.decidedAt).getTime();
  const totalRequestedUnits = input.orderItems.reduce((sum, item) => sum + item.requestedQty, 0);

  // 1. Strict temporal filtering (offered_at <= decided_at)
  let futureOffersExcludedCount = 0;
  const validDecisionTimeOffers: typeof input.rawOffers = [];

  for (const offer of input.rawOffers) {
    const offeredAtMs = new Date(offer.offeredAt).getTime();
    if (offeredAtMs <= decidedAtMs) {
      validDecisionTimeOffers.push(offer);
    } else {
      futureOffersExcludedCount++;
    }
  }

  // 2. Group decision-time offers by supplier
  const offersBySupplierId = new Map<string, typeof input.rawOffers>();
  const supplierMetadata = new Map<string, { id: string; name: string; externalSupplierId: string }>();

  for (const offer of validDecisionTimeOffers) {
    if (!offersBySupplierId.has(offer.supplierId)) {
      offersBySupplierId.set(offer.supplierId, []);
      supplierMetadata.set(offer.supplierId, {
        id: offer.supplierId,
        name: offer.supplierName,
        externalSupplierId: offer.externalSupplierId,
      });
    }
    offersBySupplierId.get(offer.supplierId)!.push(offer);
  }

  // Ensure selected supplier metadata exists even if it had no valid offers
  if (!supplierMetadata.has(input.selectedSupplierId)) {
    supplierMetadata.set(input.selectedSupplierId, {
      id: input.selectedSupplierId,
      name: 'Selected Supplier',
      externalSupplierId: input.selectedSupplierId,
    });
  }

  // 3. Multi-item feasibility evaluation per supplier
  const candidates: ReplaySupplierCandidate[] = [];

  for (const [supplierId, meta] of supplierMetadata.entries()) {
    const supplierOffers = offersBySupplierId.get(supplierId) ?? [];
    const isSelected = supplierId === input.selectedSupplierId;

    const matchedOffers: ReplaySupplierCandidate['offers'] = [];
    const infeasibleReasons: string[] = [];
    let totalQuotedPriceMinor: bigint | null = 0n;
    let latestPromisedDeliveryMs: number | null = null;
    let latestPromisedDeliveryIso: string | null = null;

    if (input.orderItems.length === 0) {
      infeasibleReasons.push('Order contains no requested items');
      totalQuotedPriceMinor = null;
    } else {
      for (const item of input.orderItems) {
        // Find best/latest valid offer for this product from this supplier
        const productOffers = supplierOffers.filter((o) => o.productId === item.productId);
        if (productOffers.length === 0) {
          infeasibleReasons.push(`No offer recorded for product "${item.productName || item.productId}"`);
          totalQuotedPriceMinor = null;
          continue;
        }

        // Sort by availableQty desc, then offeredAt desc
        productOffers.sort((a, b) => {
          if (b.availableQty !== a.availableQty) return b.availableQty - a.availableQty;
          return new Date(b.offeredAt).getTime() - new Date(a.offeredAt).getTime();
        });

        const chosenOffer = productOffers[0];
        const effectiveUnit = calculateEffectiveUnitPriceMinor(
          chosenOffer.unitPriceMinor,
          chosenOffer.discountBps
        );
        const itemTotal = effectiveUnit * BigInt(item.requestedQty);

        if (chosenOffer.availableQty < item.requestedQty) {
          infeasibleReasons.push(
            `Insufficient quantity for "${item.productName || item.productId}": available ${chosenOffer.availableQty} < requested ${item.requestedQty}`
          );
          totalQuotedPriceMinor = null;
        } else if (totalQuotedPriceMinor !== null) {
          totalQuotedPriceMinor += itemTotal;
        }

        if (chosenOffer.promisedDeliveryAt) {
          const promMs = new Date(chosenOffer.promisedDeliveryAt).getTime();
          if (latestPromisedDeliveryMs === null || promMs > latestPromisedDeliveryMs) {
            latestPromisedDeliveryMs = promMs;
            latestPromisedDeliveryIso = chosenOffer.promisedDeliveryAt;
          }
        }

        matchedOffers.push({
          offerId: chosenOffer.id,
          externalOfferId: chosenOffer.externalOfferId,
          productId: item.productId,
          availableQty: chosenOffer.availableQty,
          requestedQty: item.requestedQty,
          unitPriceMinor: chosenOffer.unitPriceMinor,
          discountBps: chosenOffer.discountBps,
          effectiveItemPriceMinor: itemTotal,
          promisedDeliveryAt: chosenOffer.promisedDeliveryAt,
          offeredAt: chosenOffer.offeredAt,
        });
      }
    }

    const isFeasible = infeasibleReasons.length === 0 && totalQuotedPriceMinor !== null;

    candidates.push({
      supplierId,
      externalSupplierId: meta.externalSupplierId,
      supplierName: meta.name,
      isSelected,
      isFeasible,
      infeasibleReasons,
      totalQuotedPriceMinor: isFeasible ? totalQuotedPriceMinor : null,
      maxPromisedDeliveryAt: latestPromisedDeliveryIso,
      offers: matchedOffers,
      dominatesSelected: false,
      dominationReasons: [],
    });
  }

  const selectedCandidate = candidates.find((c) => c.isSelected) ?? null;
  const selectedMeta = supplierMetadata.get(input.selectedSupplierId) ?? null;

  // 4. Determine Decision Quality Classification
  if (validDecisionTimeOffers.length === 0) {
    return createResult({
      input,
      totalRequestedUnits,
      selectedSupplier: selectedMeta,
      selectedCandidate,
      classification: 'INSUFFICIENT_DATA',
      classificationReason: 'No supplier offers were recorded at or before the decision timestamp.',
      consideredOffersCount: 0,
      futureOffersExcludedCount,
      dominatingSupplier: null,
      quotedPriceGapMinor: null,
      promisedDeliveryGapMinutes: null,
      actualSelectedShortfallUnits: null,
      actualSelectedLatenessMinutes: null,
      candidates,
    });
  }

  if (!selectedCandidate || !selectedCandidate.isFeasible) {
    const reasons = selectedCandidate?.infeasibleReasons.join('; ') || 'Selected supplier had no qualifying offers at decision time.';
    return createResult({
      input,
      totalRequestedUnits,
      selectedSupplier: selectedMeta,
      selectedCandidate,
      classification: 'SELECTED_NOT_FEASIBLE',
      classificationReason: `The selected supplier could not cover the order requirements: ${reasons}`,
      consideredOffersCount: validDecisionTimeOffers.length,
      futureOffersExcludedCount,
      dominatingSupplier: null,
      quotedPriceGapMinor: null,
      promisedDeliveryGapMinutes: null,
      actualSelectedShortfallUnits: null,
      actualSelectedLatenessMinutes: null,
      candidates,
    });
  }

  // 5. Compare selected feasible choice against alternative feasible candidates
  const dominatingCandidates: ReplaySupplierCandidate[] = [];
  const selectedPrice = selectedCandidate.totalQuotedPriceMinor!;
  const selectedDeliveryMs = selectedCandidate.maxPromisedDeliveryAt
    ? new Date(selectedCandidate.maxPromisedDeliveryAt).getTime()
    : null;

  for (const candidate of candidates) {
    if (candidate.isSelected || !candidate.isFeasible) continue;

    const candPrice = candidate.totalQuotedPriceMinor!;
    const candDeliveryMs = candidate.maxPromisedDeliveryAt
      ? new Date(candidate.maxPromisedDeliveryAt).getTime()
      : null;

    // Price comparison: candidate must be <= selected price
    const noMoreExpensive = candPrice <= selectedPrice;
    const strictlyCheaper = candPrice < selectedPrice;

    // Delivery comparison:
    // If selected stated a delivery time:
    //   - candidate must have stated delivery time <= selected delivery time
    // If selected did NOT state a delivery time:
    //   - candidate stating any delivery time is considered faster/better
    //   - candidate not stating delivery time is considered equal
    let promisedNoLater = false;
    let strictlyFaster = false;

    if (selectedDeliveryMs !== null && candDeliveryMs !== null) {
      promisedNoLater = candDeliveryMs <= selectedDeliveryMs;
      strictlyFaster = candDeliveryMs < selectedDeliveryMs;
    } else if (selectedDeliveryMs === null && candDeliveryMs !== null) {
      promisedNoLater = true;
      strictlyFaster = true; // Stating a promised date is strictly better than unstated
    } else if (selectedDeliveryMs === null && candDeliveryMs === null) {
      promisedNoLater = true;
      strictlyFaster = false;
    } else {
      // Selected stated delivery, candidate did not
      promisedNoLater = false;
      strictlyFaster = false;
    }

    if (noMoreExpensive && promisedNoLater && (strictlyCheaper || strictlyFaster)) {
      candidate.dominatesSelected = true;
      if (strictlyCheaper) {
        candidate.dominationReasons.push(
          `Cheaper total quoted price (${formatEgp(candPrice)} vs ${formatEgp(selectedPrice)})`
        );
      }
      if (strictlyFaster) {
        candidate.dominationReasons.push(
          `Faster promised delivery (${candidate.maxPromisedDeliveryAt} vs ${selectedCandidate.maxPromisedDeliveryAt ?? 'unstated'})`
        );
      }
      dominatingCandidates.push(candidate);
    }
  }

  // 6. Final classification & regret metrics
  let dominatingSupplier: ReplaySupplierCandidate | null = null;
  let quotedPriceGapMinor: bigint | null = null;
  let promisedDeliveryGapMinutes: number | null = null;

  if (dominatingCandidates.length > 0) {
    // Sort dominating candidates by largest price gap, then fastest delivery
    dominatingCandidates.sort((a, b) => {
      const aGap = selectedPrice - a.totalQuotedPriceMinor!;
      const bGap = selectedPrice - b.totalQuotedPriceMinor!;
      if (bGap !== aGap) return Number(bGap - aGap);
      const aTime = a.maxPromisedDeliveryAt ? new Date(a.maxPromisedDeliveryAt).getTime() : 0;
      const bTime = b.maxPromisedDeliveryAt ? new Date(b.maxPromisedDeliveryAt).getTime() : 0;
      return aTime - bTime;
    });

    dominatingSupplier = dominatingCandidates[0];
    quotedPriceGapMinor = selectedPrice - dominatingSupplier.totalQuotedPriceMinor!;

    if (selectedDeliveryMs && dominatingSupplier.maxPromisedDeliveryAt) {
      const domTime = new Date(dominatingSupplier.maxPromisedDeliveryAt).getTime();
      promisedDeliveryGapMinutes = Math.max(0, Math.round((selectedDeliveryMs - domTime) / 60_000));
    }
  }

  // Actual outcome analysis for realized execution
  let actualSelectedShortfallUnits: number | null = null;
  let actualSelectedLatenessMinutes: number | null = null;

  if (input.selectedOutcome) {
    actualSelectedShortfallUnits = Math.max(
      0,
      totalRequestedUnits - input.selectedOutcome.filledQty
    );

    if (input.selectedOutcome.deliveredAt && selectedCandidate.maxPromisedDeliveryAt) {
      const actualDeliveredMs = new Date(input.selectedOutcome.deliveredAt).getTime();
      const promisedMs = new Date(selectedCandidate.maxPromisedDeliveryAt).getTime();
      if (actualDeliveredMs > promisedMs) {
        actualSelectedLatenessMinutes = Math.round((actualDeliveredMs - promisedMs) / 60_000);
      }
    }
  }

  const classification = dominatingCandidates.length > 0 ? 'DOMINATED' : 'NON_DOMINATED';
  const classificationReason =
    classification === 'DOMINATED'
      ? `Selected supplier was clearly dominated by ${dominatingCandidates.length} alternative supplier(s) available at decision time.`
      : 'No clearly dominating alternative was found among recorded decision-time offers.';

  return createResult({
    input,
    totalRequestedUnits,
    selectedSupplier: selectedMeta,
    selectedCandidate,
    classification,
    classificationReason,
    consideredOffersCount: validDecisionTimeOffers.length,
    futureOffersExcludedCount,
    dominatingSupplier,
    quotedPriceGapMinor,
    promisedDeliveryGapMinutes,
    actualSelectedShortfallUnits,
    actualSelectedLatenessMinutes,
    candidates,
  });
}

function createResult(params: {
  input: DecisionReplayEvaluationInput;
  totalRequestedUnits: number;
  selectedSupplier: { id: string; externalSupplierId: string; name: string } | null;
  selectedCandidate: ReplaySupplierCandidate | null;
  classification: DecisionReplayResult['classification'];
  classificationReason: string;
  consideredOffersCount: number;
  futureOffersExcludedCount: number;
  dominatingSupplier: ReplaySupplierCandidate | null;
  quotedPriceGapMinor: bigint | null;
  promisedDeliveryGapMinutes: number | null;
  actualSelectedShortfallUnits: number | null;
  actualSelectedLatenessMinutes: number | null;
  candidates: ReplaySupplierCandidate[];
}): DecisionReplayResult {
  const { input } = params;

  let selectedActualOutcome: DecisionReplayResult['selectedActualOutcome'] = null;
  if (input.selectedOutcome) {
    const fillRateBps =
      params.totalRequestedUnits > 0
        ? Math.min(10_000, Math.round((input.selectedOutcome.filledQty * 10_000) / params.totalRequestedUnits))
        : 10_000;

    selectedActualOutcome = {
      filledQty: input.selectedOutcome.filledQty,
      fillRateBps,
      deliveredAt: input.selectedOutcome.deliveredAt,
      cancelled: input.selectedOutcome.cancelled,
      cancellationReason: input.selectedOutcome.cancellationReason,
      isFinal: input.selectedOutcome.outcomeFinal,
    };
  }

  return {
    decisionId: input.decisionId,
    externalDecisionId: input.externalDecisionId,
    datasetId: input.datasetId,
    orderId: input.orderId,
    externalOrderId: input.externalOrderId,
    orderPlacedAt: input.orderPlacedAt,
    pharmacyName: input.pharmacyName ?? null,
    decidedAt: input.decidedAt,
    agentName: input.agentName ?? null,
    agentVersion: input.agentVersion ?? null,
    confidence: input.confidence ? String(input.confidence) : null,
    selectionReason: input.selectionReason ?? null,

    orderItems: input.orderItems,
    totalRequestedUnits: params.totalRequestedUnits,

    selectedSupplier: params.selectedSupplier,
    selectedCandidate: params.selectedCandidate,
    selectedActualOutcome,

    classification: params.classification,
    classificationReason: params.classificationReason,

    temporalRule: 'offered_at <= decided_at',
    consideredOffersCount: params.consideredOffersCount,
    futureOffersExcludedCount: params.futureOffersExcludedCount,

    dominatingSupplier: params.dominatingSupplier,
    quotedPriceGapMinor: params.quotedPriceGapMinor,
    promisedDeliveryGapMinutes: params.promisedDeliveryGapMinutes,
    actualSelectedShortfallUnits: params.actualSelectedShortfallUnits,
    actualSelectedLatenessMinutes: params.actualSelectedLatenessMinutes,

    candidates: params.candidates,
  };
}

function formatEgp(minor: bigint): string {
  const whole = minor / 100n;
  const frac = minor % 100n;
  return `EGP ${whole}.${frac.toString().padStart(2, '0')}`;
}
