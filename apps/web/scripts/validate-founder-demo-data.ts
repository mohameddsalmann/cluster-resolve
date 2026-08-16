import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import {
  evaluateDecisionReplay,
  evaluateOrderExceptions,
  evaluatePharmacyServiceRisk,
} from '@cluster/core';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
const DATA_DIR = resolve(ROOT_DIR, 'data/founder-demo');

export interface ValidationReport {
  passed: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    ordersRows: number;
    distinctOrders: number;
    offersRows: number;
    decisionsRows: number;
    outcomesRows: number;
    distinctPharmacies: number;
    distinctProducts: number;
    distinctSuppliers: number;
    multiItemOrders: number;
    futureOffers: number;
  };
  pharmacyRiskDistribution: {
    STABLE: number;
    AT_RISK: number;
    HIGH_RISK: number;
    INSUFFICIENT_DATA: number;
  };
  decisionReplayDistribution: {
    DOMINATED: number;
    NON_DOMINATED: number;
    SELECTED_NOT_FEASIBLE: number;
    INSUFFICIENT_DATA: number;
  };
  scenariosValidated: {
    stableStrongSuppliers: boolean;
    deterioratingSuppliers: boolean;
    productSpecificWeakness: boolean;
    overpromisingSuppliers: boolean;
    insufficientDataSuppliers: boolean;
    pharmacyServiceRiskHigh: boolean;
    pharmacyServiceRiskAtRisk: boolean;
    dominatedDecisions: boolean;
    nonDominatedDecisions: boolean;
    selectedNotFeasible: boolean;
    insufficientDataDecisions: boolean;
    cancellations: boolean;
    partialFills: boolean;
    lateDeliveries: boolean;
    futureOfferExclusions: boolean;
  };
}

export function validateFounderDemoDataset(): ValidationReport {
  console.log(`[validator] Validating Founder Demo dataset in ${DATA_DIR}...`);

  const errors: string[] = [];
  const warnings: string[] = [];

  const ordersPath = resolve(DATA_DIR, 'orders.csv');
  const offersPath = resolve(DATA_DIR, 'offers.csv');
  const decisionsPath = resolve(DATA_DIR, 'decisions.csv');
  const outcomesPath = resolve(DATA_DIR, 'outcomes.csv');
  const manifestPath = resolve(DATA_DIR, 'founder-demo-manifest.json');

  for (const [name, p] of [
    ['orders.csv', ordersPath],
    ['offers.csv', offersPath],
    ['decisions.csv', decisionsPath],
    ['outcomes.csv', outcomesPath],
    ['founder-demo-manifest.json', manifestPath],
  ]) {
    if (!existsSync(p)) {
      errors.push(`Missing required file: ${name}`);
    }
  }

  if (errors.length > 0) {
    return failReport(errors, warnings);
  }

  // Parse Manifest
  JSON.parse(readFileSync(manifestPath, 'utf-8'));

  // Parse CSVs
  const ordersRows: Array<{
    order_id: string;
    pharmacy_id: string;
    pharmacy_name: string;
    placed_at: string;
    product_id: string;
    product_name: string;
    manufacturer: string;
    requested_qty: string;
    unit: string;
  }> = parse(readFileSync(ordersPath, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true });

  const offersRows: Array<{
    offer_id: string;
    order_id: string;
    supplier_id: string;
    supplier_name: string;
    product_id: string;
    available_qty: string;
    unit_price_egp: string;
    discount_percent: string;
    promised_delivery_at: string;
    offered_at: string;
  }> = parse(readFileSync(offersPath, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true });

  const decisionsRows: Array<{
    decision_id: string;
    order_id: string;
    selected_supplier_id: string;
    decided_at: string;
    agent_name: string;
    agent_version: string;
    confidence: string;
    selection_reason: string;
  }> = parse(readFileSync(decisionsPath, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true });

  const outcomesRows: Array<{
    order_id: string;
    supplier_id: string;
    product_id: string;
    filled_qty: string;
    delivered_at: string;
    cancelled: string;
    cancellation_reason: string;
    outcome_final: string;
  }> = parse(readFileSync(outcomesPath, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true });

  console.log(`[validator] Parsed row counts: orders=${ordersRows.length}, offers=${offersRows.length}, decisions=${decisionsRows.length}, outcomes=${outcomesRows.length}`);

  // 1. Structural and Value Validation
  const orderMap = new Map<string, { placedAt: number; pharmacyId: string; items: Map<string, number> }>();
  const productSet = new Set<string>();
  const pharmacySet = new Set<string>();
  const supplierSet = new Set<string>();
  const offerIds = new Set<string>();
  const decisionIds = new Set<string>();

  // Validate Orders
  for (let i = 0; i < ordersRows.length; i++) {
    const row = ordersRows[i];
    if (!row.order_id) errors.push(`orders.csv:${i + 2}: missing order_id`);
    if (!row.pharmacy_id) errors.push(`orders.csv:${i + 2}: missing pharmacy_id`);
    if (!row.product_id) errors.push(`orders.csv:${i + 2}: missing product_id`);
    const qty = parseInt(row.requested_qty, 10);
    if (isNaN(qty) || qty <= 0) errors.push(`orders.csv:${i + 2}: invalid requested_qty '${row.requested_qty}'`);

    const placedMs = Date.parse(row.placed_at);
    if (isNaN(placedMs)) errors.push(`orders.csv:${i + 2}: invalid placed_at timestamp '${row.placed_at}'`);

    pharmacySet.add(row.pharmacy_id);
    productSet.add(row.product_id);

    if (!orderMap.has(row.order_id)) {
      orderMap.set(row.order_id, {
        placedAt: placedMs,
        pharmacyId: row.pharmacy_id,
        items: new Map([[row.product_id, qty]]),
      });
    } else {
      const existing = orderMap.get(row.order_id)!;
      if (existing.placedAt !== placedMs) {
        errors.push(`orders.csv:${i + 2}: inconsistent placed_at for order ${row.order_id}`);
      }
      if (existing.pharmacyId !== row.pharmacy_id) {
        errors.push(`orders.csv:${i + 2}: inconsistent pharmacy_id for order ${row.order_id}`);
      }
      existing.items.set(row.product_id, qty);
    }
  }

  const multiItemOrders = Array.from(orderMap.values()).filter((o) => o.items.size > 1).length;

  // Validate Offers
  let futureOffers = 0;
  for (let i = 0; i < offersRows.length; i++) {
    const row = offersRows[i];
    if (offerIds.has(row.offer_id)) errors.push(`offers.csv:${i + 2}: duplicate offer_id '${row.offer_id}'`);
    offerIds.add(row.offer_id);

    if (!orderMap.has(row.order_id)) {
      errors.push(`offers.csv:${i + 2}: orphan offer references non-existent order '${row.order_id}'`);
    }
    if (!productSet.has(row.product_id)) {
      errors.push(`offers.csv:${i + 2}: references non-existent product '${row.product_id}'`);
    }

    supplierSet.add(row.supplier_id);
    const avail = parseInt(row.available_qty, 10);
    if (isNaN(avail) || avail < 0) errors.push(`offers.csv:${i + 2}: invalid available_qty '${row.available_qty}'`);

    const price = parseFloat(row.unit_price_egp);
    if (isNaN(price) || price <= 0) errors.push(`offers.csv:${i + 2}: invalid unit_price_egp '${row.unit_price_egp}'`);

    const discount = parseFloat(row.discount_percent);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      errors.push(`offers.csv:${i + 2}: invalid discount_percent '${row.discount_percent}'`);
    }

    const offeredMs = Date.parse(row.offered_at);
    if (isNaN(offeredMs)) errors.push(`offers.csv:${i + 2}: invalid offered_at '${row.offered_at}'`);

    const promisedMs = Date.parse(row.promised_delivery_at);
    if (isNaN(promisedMs)) errors.push(`offers.csv:${i + 2}: invalid promised_delivery_at '${row.promised_delivery_at}'`);

    // Temporal check against order placed_at
    const order = orderMap.get(row.order_id);
    if (order && offeredMs < order.placedAt) {
      errors.push(`offers.csv:${i + 2}: offered_at precedes order placed_at`);
    }

    if (row.offer_id.startsWith('OFFER-FUT-')) {
      futureOffers++;
    }
  }

  // Validate Decisions
  const decisionOrderMap = new Map<string, { decidedAt: number; selectedSupplierId: string }>();
  for (let i = 0; i < decisionsRows.length; i++) {
    const row = decisionsRows[i];
    if (decisionIds.has(row.decision_id)) errors.push(`decisions.csv:${i + 2}: duplicate decision_id '${row.decision_id}'`);
    decisionIds.add(row.decision_id);

    if (!orderMap.has(row.order_id)) {
      errors.push(`decisions.csv:${i + 2}: orphan decision references non-existent order '${row.order_id}'`);
    }
    if (!supplierSet.has(row.selected_supplier_id)) {
      errors.push(`decisions.csv:${i + 2}: decision references non-existent supplier '${row.selected_supplier_id}'`);
    }

    const conf = parseFloat(row.confidence);
    if (isNaN(conf) || conf < 0 || conf > 1) errors.push(`decisions.csv:${i + 2}: invalid confidence '${row.confidence}'`);

    const decidedMs = Date.parse(row.decided_at);
    if (isNaN(decidedMs)) errors.push(`decisions.csv:${i + 2}: invalid decided_at '${row.decided_at}'`);

    const order = orderMap.get(row.order_id);
    if (order && decidedMs < order.placedAt) {
      errors.push(`decisions.csv:${i + 2}: decided_at precedes order placed_at`);
    }

    decisionOrderMap.set(row.order_id, { decidedAt: decidedMs, selectedSupplierId: row.selected_supplier_id });
  }

  // Validate Outcomes
  let cancellationCount = 0;
  let partialFillCount = 0;
  let lateDeliveryCount = 0;

  for (let i = 0; i < outcomesRows.length; i++) {
    const row = outcomesRows[i];
    if (!orderMap.has(row.order_id)) {
      errors.push(`outcomes.csv:${i + 2}: orphan outcome references non-existent order '${row.order_id}'`);
    }
    if (!supplierSet.has(row.supplier_id)) {
      errors.push(`outcomes.csv:${i + 2}: outcome references non-existent supplier '${row.supplier_id}'`);
    }
    if (!productSet.has(row.product_id)) {
      errors.push(`outcomes.csv:${i + 2}: outcome references non-existent product '${row.product_id}'`);
    }

    const isCancelled = row.cancelled.toLowerCase() === 'true';
    const filled = parseInt(row.filled_qty, 10);
    if (isNaN(filled) || filled < 0) errors.push(`outcomes.csv:${i + 2}: invalid filled_qty '${row.filled_qty}'`);

    const order = orderMap.get(row.order_id);
    const requested = order?.items.get(row.product_id) ?? 0;

    if (isCancelled) {
      cancellationCount++;
      if (filled !== 0) errors.push(`outcomes.csv:${i + 2}: cancelled order outcome must have filled_qty = 0`);
      if (!row.cancellation_reason) warnings.push(`outcomes.csv:${i + 2}: cancelled outcome missing cancellation_reason`);
    } else {
      if (filled < requested) {
        partialFillCount++;
      }
      if (row.delivered_at) {
        const delMs = Date.parse(row.delivered_at);
        if (isNaN(delMs)) errors.push(`outcomes.csv:${i + 2}: invalid delivered_at '${row.delivered_at}'`);
        const decision = decisionOrderMap.get(row.order_id);
        if (decision && delMs < decision.decidedAt) {
          errors.push(`outcomes.csv:${i + 2}: delivered_at precedes decided_at`);
        }
        if (decision && delMs - decision.decidedAt > 36 * 3_600_000) {
          lateDeliveryCount++;
        }
      }
    }
  }

  // Run the same production exception and pharmacy-risk policies against the
  // generated source rows. This prevents a structurally valid sample from
  // silently collapsing into a single founder-facing risk status after import.
  const exceptionEvaluation = evaluateOrderExceptions({
    orders: Array.from(orderMap.entries()).map(([orderId, order]) => ({
      id: orderId,
      datasetId: 'founder-demo',
      placedAt: new Date(order.placedAt).toISOString(),
    })),
    items: ordersRows.map((row, index) => ({
      id: `item-${index + 1}`,
      orderId: row.order_id,
      productId: row.product_id,
      requestedQty: parseInt(row.requested_qty, 10),
    })),
    outcomes: outcomesRows.map((row, index) => ({
      id: `outcome-${index + 1}`,
      orderId: row.order_id,
      supplierId: row.supplier_id,
      productId: row.product_id,
      filledQty: parseInt(row.filled_qty, 10),
      deliveredAt: row.delivered_at || null,
      cancelled: row.cancelled.toLowerCase() === 'true',
      outcomeFinal: row.outcome_final.toLowerCase() === 'true',
    })),
    offers: offersRows.map((row) => ({
      id: row.offer_id,
      orderId: row.order_id,
      supplierId: row.supplier_id,
      productId: row.product_id,
      promisedDeliveryAt: row.promised_delivery_at || null,
      offeredAt: row.offered_at,
    })),
    decisions: decisionsRows.map((row) => ({
      id: row.decision_id,
      orderId: row.order_id,
      selectedSupplierId: row.selected_supplier_id,
      decidedAt: row.decided_at,
    })),
  });

  const pharmacyRiskDistribution = {
    STABLE: 0,
    AT_RISK: 0,
    HIGH_RISK: 0,
    INSUFFICIENT_DATA: 0,
  };
  for (const pharmacyId of pharmacySet) {
    const pharmacyOrders = Array.from(orderMap.entries())
      .filter(([, order]) => order.pharmacyId === pharmacyId)
      .map(([orderId]) => ({ orderId }));
    const orderIds = new Set(pharmacyOrders.map((order) => order.orderId));
    const pharmacyExceptions = exceptionEvaluation.exceptions
      .filter((exception) => orderIds.has(exception.orderId))
      .map((exception) => ({
        orderId: exception.orderId,
        type: exception.type,
        severity: exception.severity,
      }));
    const risk = evaluatePharmacyServiceRisk(pharmacyId, pharmacyOrders, pharmacyExceptions);
    pharmacyRiskDistribution[risk.serviceRiskLevel]++;
  }
  console.log('[validator] Pharmacy service-risk distribution:', pharmacyRiskDistribution);

  const orderRowsById = new Map<string, typeof ordersRows>();
  for (const row of ordersRows) {
    const list = orderRowsById.get(row.order_id) ?? [];
    list.push(row);
    orderRowsById.set(row.order_id, list);
  }
  const offerRowsByOrder = new Map<string, typeof offersRows>();
  for (const row of offersRows) {
    const list = offerRowsByOrder.get(row.order_id) ?? [];
    list.push(row);
    offerRowsByOrder.set(row.order_id, list);
  }
  const outcomeRowsByOrder = new Map<string, typeof outcomesRows>();
  for (const row of outcomesRows) {
    const list = outcomeRowsByOrder.get(row.order_id) ?? [];
    list.push(row);
    outcomeRowsByOrder.set(row.order_id, list);
  }

  const decisionReplayDistribution = {
    DOMINATED: 0,
    NON_DOMINATED: 0,
    SELECTED_NOT_FEASIBLE: 0,
    INSUFFICIENT_DATA: 0,
  };
  let totalFutureOffersExcluded = 0;
  for (const decision of decisionsRows) {
    const orderRows = orderRowsById.get(decision.order_id) ?? [];
    const rawOffers = offerRowsByOrder.get(decision.order_id) ?? [];
    const selectedOutcome = (outcomeRowsByOrder.get(decision.order_id) ?? [])
      .find((row) => row.supplier_id === decision.selected_supplier_id);
    const replay = evaluateDecisionReplay({
      decisionId: decision.decision_id,
      externalDecisionId: decision.decision_id,
      datasetId: 'founder-demo',
      orderId: decision.order_id,
      externalOrderId: decision.order_id,
      orderPlacedAt: orderRows[0]?.placed_at ?? decision.decided_at,
      pharmacyName: orderRows[0]?.pharmacy_name ?? null,
      selectedSupplierId: decision.selected_supplier_id,
      decidedAt: decision.decided_at,
      agentName: decision.agent_name,
      agentVersion: decision.agent_version,
      confidence: decision.confidence,
      selectionReason: decision.selection_reason,
      orderItems: orderRows.map((row) => ({
        productId: row.product_id,
        externalProductId: row.product_id,
        productName: row.product_name,
        requestedQty: Number.parseInt(row.requested_qty, 10),
        unit: row.unit,
      })),
      rawOffers: rawOffers.map((row) => ({
        id: row.offer_id,
        externalOfferId: row.offer_id,
        orderId: row.order_id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        externalSupplierId: row.supplier_id,
        productId: row.product_id,
        availableQty: Number.parseInt(row.available_qty, 10),
        unitPriceMinor: BigInt(Math.round(Number.parseFloat(row.unit_price_egp) * 100)),
        discountBps: Math.round(Number.parseFloat(row.discount_percent) * 100),
        promisedDeliveryAt: row.promised_delivery_at || null,
        offeredAt: row.offered_at,
      })),
      selectedOutcome: selectedOutcome ? {
        id: `outcome-${decision.order_id}`,
        orderId: selectedOutcome.order_id,
        supplierId: selectedOutcome.supplier_id,
        productId: selectedOutcome.product_id,
        filledQty: Number.parseInt(selectedOutcome.filled_qty, 10),
        deliveredAt: selectedOutcome.delivered_at || null,
        cancelled: selectedOutcome.cancelled.toLowerCase() === 'true',
        cancellationReason: selectedOutcome.cancellation_reason || null,
        outcomeFinal: selectedOutcome.outcome_final.toLowerCase() === 'true',
      } : null,
    });
    decisionReplayDistribution[replay.classification]++;
    totalFutureOffersExcluded += replay.futureOffersExcludedCount;
  }
  console.log('[validator] Production Decision Replay distribution:', decisionReplayDistribution);

  // 2. Purposeful Scenarios Verification
  const scenariosValidated = {
    stableStrongSuppliers: supplierSet.has('SUP-001') && supplierSet.has('SUP-005'),
    deterioratingSuppliers: supplierSet.has('SUP-011') && supplierSet.has('SUP-012'),
    productSpecificWeakness: supplierSet.has('SUP-015'),
    overpromisingSuppliers: supplierSet.has('SUP-016'),
    insufficientDataSuppliers: supplierSet.has('SUP-029') || supplierSet.has('SUP-030'),
    pharmacyServiceRiskHigh:
      pharmacyRiskDistribution.HIGH_RISK >= 3 && pharmacyRiskDistribution.HIGH_RISK <= 8,
    pharmacyServiceRiskAtRisk:
      pharmacyRiskDistribution.AT_RISK >= 8 && pharmacyRiskDistribution.STABLE >= 25,
    dominatedDecisions: decisionReplayDistribution.DOMINATED > 0,
    nonDominatedDecisions: decisionReplayDistribution.NON_DOMINATED > 0,
    selectedNotFeasible: decisionReplayDistribution.SELECTED_NOT_FEASIBLE > 0,
    insufficientDataDecisions: decisionReplayDistribution.INSUFFICIENT_DATA > 0,
    cancellations: cancellationCount > 50,
    partialFills: partialFillCount > 50,
    lateDeliveries: lateDeliveryCount > 50,
    futureOfferExclusions: totalFutureOffersExcluded > 0,
  };

  const allScenariosPassed = Object.values(scenariosValidated).every(Boolean);
  if (!allScenariosPassed) {
    errors.push(`Failed scenario checks: ${JSON.stringify(scenariosValidated)}`);
  }

  const passed = errors.length === 0;
  console.log(`[validator] Validation complete. Status: ${passed ? 'PASS' : 'FAIL'} (${errors.length} errors, ${warnings.length} warnings)`);

  return {
    passed,
    errors,
    warnings,
    counts: {
      ordersRows: ordersRows.length,
      distinctOrders: orderMap.size,
      offersRows: offersRows.length,
      decisionsRows: decisionsRows.length,
      outcomesRows: outcomesRows.length,
      distinctPharmacies: pharmacySet.size,
      distinctProducts: productSet.size,
      distinctSuppliers: supplierSet.size,
      multiItemOrders,
      futureOffers,
    },
    pharmacyRiskDistribution,
    decisionReplayDistribution,
    scenariosValidated,
  };
}

function failReport(errors: string[], warnings: string[]): ValidationReport {
  return {
    passed: false,
    errors,
    warnings,
    counts: {
      ordersRows: 0,
      distinctOrders: 0,
      offersRows: 0,
      decisionsRows: 0,
      outcomesRows: 0,
      distinctPharmacies: 0,
      distinctProducts: 0,
      distinctSuppliers: 0,
      multiItemOrders: 0,
      futureOffers: 0,
    },
    pharmacyRiskDistribution: {
      STABLE: 0,
      AT_RISK: 0,
      HIGH_RISK: 0,
      INSUFFICIENT_DATA: 0,
    },
    decisionReplayDistribution: {
      DOMINATED: 0,
      NON_DOMINATED: 0,
      SELECTED_NOT_FEASIBLE: 0,
      INSUFFICIENT_DATA: 0,
    },
    scenariosValidated: {
      stableStrongSuppliers: false,
      deterioratingSuppliers: false,
      productSpecificWeakness: false,
      overpromisingSuppliers: false,
      insufficientDataSuppliers: false,
      pharmacyServiceRiskHigh: false,
      pharmacyServiceRiskAtRisk: false,
      dominatedDecisions: false,
      nonDominatedDecisions: false,
      selectedNotFeasible: false,
      insufficientDataDecisions: false,
      cancellations: false,
      partialFills: false,
      lateDeliveries: false,
      futureOfferExclusions: false,
    },
  };
}

if (process.argv[1]?.includes('validate-founder-demo-data')) {
  const report = validateFounderDemoDataset();
  if (!report.passed) {
    console.error('[validator] VALIDATION FAILED:', report.errors);
    process.exit(1);
  } else {
    console.log('[validator] DATASET VALIDATION PASSED!');
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }
}
