import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
const REFERENCE_FILE = resolve(ROOT_DIR, 'data/reference/egyptian-drugs-200.json');
const OUTPUT_DIR = resolve(ROOT_DIR, 'data/founder-demo');

export const GENERATOR_VERSION = '1.1.0';
export const GENERATOR_SEED = 'CLUSTER_FOUNDER_DEMO_2026';
export const FIXED_DATE_START = '2025-10-01T00:00:00.000Z';
export const FIXED_DATE_END = '2026-08-14T00:00:00.000Z';
export const AS_OF_DATE = '2026-08-14T00:00:00.000Z';
export const RECENT_WINDOW_DAYS = 14;

// Seeded PRNG: Mulberry32
function createPrng(seedStr: string) {
  let h = 1779033703 ^ seedStr.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface GeneratorOutput {
  ordersCsv: string;
  offersCsv: string;
  decisionsCsv: string;
  outcomesCsv: string;
  manifest: Record<string, unknown>;
}

export function generateFounderDemoData(): GeneratorOutput {
  console.log(`[generator] Starting deterministic Founder Demo generation (seed: ${GENERATOR_SEED})...`);

  const rand = createPrng(GENERATOR_SEED);
  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const randChoice = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const randFloat = (min: number, max: number) => min + rand() * (max - min);
  const serviceRand = createPrng(`${GENERATOR_SEED}_SERVICE_CALIBRATION_V1`);
  const serviceRandInt = (min: number, max: number) =>
    Math.floor(serviceRand() * (max - min + 1)) + min;
  const serviceRandChoice = <T>(arr: readonly T[]): T =>
    arr[Math.floor(serviceRand() * arr.length)];
  const serviceRandFloat = (min: number, max: number) =>
    min + serviceRand() * (max - min);

  // 1. Load Public Reference Products
  if (!existsSync(REFERENCE_FILE)) {
    throw new Error(`Product reference file missing at ${REFERENCE_FILE}. Run download-public-reference first.`);
  }
  const products: Array<{
    resolveProductId: string;
    commercialNameEn: string;
    commercialNameAr: string;
    scientificName: string;
    manufacturer: string;
    drugClass: string;
    route: string;
    referencePublicPriceEgp: number;
    referencePublicPriceMinor: string;
    estimatedWholesalePriceMinor: string;
  }> = JSON.parse(readFileSync(REFERENCE_FILE, 'utf-8'));

  console.log(`[generator] Loaded ${products.length} reference products.`);

  // 2. Define 50 Pharmacies
  const egyptianCities = [
    { city: 'Cairo', gov: 'Cairo' },
    { city: 'Giza', gov: 'Giza' },
    { city: 'Alexandria', gov: 'Alexandria' },
    { city: 'Mansoura', gov: 'Dakahlia' },
    { city: 'Tanta', gov: 'Gharbia' },
    { city: 'Luxor', gov: 'Luxor' },
    { city: 'Aswan', gov: 'Aswan' },
    { city: 'Ismailia', gov: 'Ismailia' },
    { city: 'Port Said', gov: 'Port Said' },
    { city: 'Suez', gov: 'Suez' },
    { city: 'Asyut', gov: 'Asyut' },
    { city: 'Zagazig', gov: 'Sharqia' },
    { city: 'Damanhur', gov: 'Beheira' },
    { city: 'Beni Suef', gov: 'Beni Suef' },
    { city: 'Minya', gov: 'Minya' },
  ];

  const pharmacyNames = [
    'Nile Care Pharmacy', 'El-Ezaby Branch', 'Seif Care Center', 'Misr Modern Dispensary',
    'Al-Ahram Health Pharmacy', 'Pyramids Medical', 'Delta Cure Pharmacy', 'Alexandria Central',
    'Pharos Health', 'Zamalek Wellness', 'Maadi Prescription Hub', 'Heliopolis Community Pharmacy',
    'Nasr City Cure', 'Dokki Health Store', 'Mohandessin Pharmacy', 'Giza Oasis Care',
    'Mansoura City Pharmacy', 'Tanta Hope Pharmacy', 'Luxor Temple Dispensary', 'Aswan River Care',
    'Ismailia Canal Pharmacy', 'Port Said Gate Pharmacy', 'Suez Crescent Care', 'Asyut University Dispensary',
    'Zagazig Central Pharmacy', 'Qena Family Care', 'Sohag Sun Pharmacy', 'Fayoum Green Health',
    'Damietta Coast Pharmacy', 'Kafr El-Sheikh Hub', 'Shibin El-Kom Med', 'Banha Nile Dispensary',
    'Arish Palm Pharmacy', 'Hurghada Red Sea Care', 'Sharm El-Sheikh Clinic Pharmacy', 'Marsa Matruh Health',
    '6th of October Wellness', 'Sheikh Zayed Care', 'New Cairo Premier', 'Obour City Pharmacy',
    'Badr City Health', 'Shorouk Central Pharmacy', 'Madinaty Community Care', 'Rehab City Medical',
    'Katameya Health Gate', 'Helwan Oasis Pharmacy', 'Shubra Al-Kheima Care', 'Imbaba Community Dispensary',
    'Ain Shams Health Hub', 'Mataria Central Pharmacy'
  ];

  const pharmacies = Array.from({ length: 50 }, (_, i) => {
    const id = `PHARM-${String(i + 1).padStart(3, '0')}`;
    const name = pharmacyNames[i]
      ? `Founder Demo Pharmacy ${String(i + 1).padStart(3, '0')}`
      : `Founder Demo Pharmacy ${i + 1}`;
    const loc = egyptianCities[i % egyptianCities.length];
    return { id, name: `${name} · ${loc.city}`, city: loc.city, gov: loc.gov };
  });

  // These cohorts only modify deterministic fulfillment evidence. The
  // production service-risk policy derives every displayed status after import.
  const highServiceRiskPharmacyIds = new Set([
    'PHARM-005', 'PHARM-022', 'PHARM-041', 'PHARM-047',
  ]);
  const watchServiceRiskPharmacyIds = new Set([
    'PHARM-003', 'PHARM-009', 'PHARM-012', 'PHARM-018', 'PHARM-025',
    'PHARM-028', 'PHARM-033', 'PHARM-036', 'PHARM-043', 'PHARM-049',
  ]);

  // 3. Define 30 Suppliers with purposeful behavioral profiles
  const supplierNames = [
    'Nile Delta Pharma Distribution', 'Horus Medical Supply Co.', 'Alexandria MedLog Wholesalers',
    'Cairo Valley Drug Distribution', 'Pyramids Health Logistics', 'Sinai Medical Trading',
    'Upper Egypt Pharma Direct', 'Middle East Pharmaceutical Hub', 'Al-Amal Medical Distribution',
    'Delta Prime Wholesale', 'Apex National Pharma Logistic', 'Sovereign Medical Distro',
    'Karnak Pharma Services', 'Sphinx Healthcare Wholesale', 'Lotus Drug Distribution',
    'Amon Medical Supplies', 'Cleopatra Pharma Hub', 'Ramses Healthcare Distro',
    'Pharaonic Medical Logistics', 'Nefertiti Drug Wholesale', 'Red Sea Pharma Supply',
    'Mediterranean Med Logistics', 'Oasis Pharma Distribution', 'Canal Cities Drug Supply',
    'Al-Salam Medical Trading', 'Al-Safwa Pharma Distro', 'United Egyptian Wholesalers',
    'Al-Rowad Healthcare Distribution', 'Upper Nile Rare Drugs', 'Sinai Fast Logistics'
  ];

  type SupplierRole =
    | 'STABLE_STRONG'
    | 'DETERIORATING'
    | 'CHEAP_SLOW'
    | 'PRODUCT_WEAK'
    | 'OVERPROMISING'
    | 'LOW_SAMPLE'
    | 'STANDARD';

  interface SupplierProfile {
    id: string;
    name: string;
    role: SupplierRole;
    baseFillBps: number;
    recentFillBps: number;
    baseCancelBps: number;
    recentCancelBps: number;
    baseLeadHours: number;
    recentLeadHours: number;
    promisedHoursOffset: number; // if overpromising, promised hours vs actual
    weakProductIds?: Set<string>;
    priceMultiplier: number; // 0.85 to 1.05
  }

  const suppliers: SupplierProfile[] = supplierNames.map((name, i) => {
    const id = `SUP-${String(i + 1).padStart(3, '0')}`;
    let role: SupplierRole = 'STANDARD';
    let baseFillBps = 9800;
    let recentFillBps = 9800;
    let baseCancelBps = 0;
    let recentCancelBps = 0;
    let baseLeadHours = 18;
    let recentLeadHours = 18;
    let promisedHoursOffset = 0;
    let priceMultiplier = 0.98;
    let weakProductIds: Set<string> | undefined;

    if (i < 8) {
      // SUP-001..SUP-008: Stable Strong
      role = 'STABLE_STRONG';
      baseFillBps = 9850;
      recentFillBps = 9800;
      baseCancelBps = 0;
      recentCancelBps = 0;
      baseLeadHours = 14;
      recentLeadHours = 14;
      priceMultiplier = 1.0;
    } else if (i === 10 || i === 11) {
      // SUP-011, SUP-012: Deteriorating
      role = 'DETERIORATING';
      baseFillBps = 9700;
      recentFillBps = 6200; // Drops 35 pts
      baseCancelBps = 0;
      recentCancelBps = 1800; // Jumps 17 pts
      baseLeadHours = 16;
      recentLeadHours = 48; // Lead time triples
      priceMultiplier = 0.95;
    } else if (i === 12 || i === 13) {
      // SUP-013, SUP-014: Cheap But Slow
      role = 'CHEAP_SLOW';
      baseFillBps = 9700;
      recentFillBps = 9700;
      baseCancelBps = 0;
      recentCancelBps = 0;
      baseLeadHours = 48;
      recentLeadHours = 48;
      priceMultiplier = 0.88; // 12% cheaper
    } else if (i === 14) {
      // SUP-015: Product-Specific Weakness (fails on products PROD-0010..PROD-0025)
      role = 'PRODUCT_WEAK';
      baseFillBps = 9800;
      recentFillBps = 9800;
      baseCancelBps = 0;
      recentCancelBps = 0;
      baseLeadHours = 16;
      recentLeadHours = 16;
      weakProductIds = new Set(products.slice(10, 25).map((p) => p.resolveProductId));
      priceMultiplier = 0.96;
    } else if (i === 15) {
      // SUP-016: Overpromising (promises 4h delivery, actual lead time is 26h)
      role = 'OVERPROMISING';
      baseFillBps = 9700;
      recentFillBps = 9700;
      baseCancelBps = 0;
      recentCancelBps = 0;
      baseLeadHours = 26;
      recentLeadHours = 28;
      promisedHoursOffset = -22; // promises 4h, takes 26h
      priceMultiplier = 0.93;
    } else if (i >= 28) {
      // SUP-029, SUP-030: Low sample (only 1-3 orders)
      role = 'LOW_SAMPLE';
      baseFillBps = 8000;
      recentFillBps = 8000;
      baseCancelBps = 0;
      recentCancelBps = 0;
      baseLeadHours = 20;
      recentLeadHours = 20;
    }

    return {
      id,
      name,
      role,
      baseFillBps,
      recentFillBps,
      baseCancelBps,
      recentCancelBps,
      baseLeadHours,
      recentLeadHours,
      promisedHoursOffset,
      weakProductIds,
      priceMultiplier,
    };
  });

  // 4. Generate ~10,000 distinct orders spanning Oct 2025 to Aug 14, 2026
  const startTimeMs = Date.parse(FIXED_DATE_START);
  const endTimeMs = Date.parse(FIXED_DATE_END);
  const recentCutoffMs = endTimeMs - RECENT_WINDOW_DAYS * 86_400_000; // Aug 1, 2026

  const TOTAL_ORDERS = 10_000;
  console.log(`[generator] Generating ${TOTAL_ORDERS} orders across timeline...`);

  interface OrderRecord {
    orderId: string;
    pharmacyId: string;
    pharmacyName: string;
    placedAt: string;
    items: Array<{
      productId: string;
      productName: string;
      manufacturer: string;
      requestedQty: number;
      unit: string;
    }>;
  }

  interface OfferRecord {
    offerId: string;
    orderId: string;
    supplierId: string;
    supplierName: string;
    productId: string;
    availableQty: number;
    unitPriceEgp: string;
    discountPercent: string;
    promisedDeliveryAt: string;
    offeredAt: string;
    isFutureOffer?: boolean;
  }

  interface DecisionRecord {
    decisionId: string;
    orderId: string;
    selectedSupplierId: string;
    decidedAt: string;
    agentName: string;
    agentVersion: string;
    confidence: number;
    selectionReason: string;
  }

  interface OutcomeRecord {
    orderId: string;
    supplierId: string;
    productId: string;
    filledQty: number;
    deliveredAt: string | null;
    cancelled: boolean;
    cancellationReason: string | null;
    outcomeFinal: boolean;
  }

  const orders: OrderRecord[] = [];
  const offers: OfferRecord[] = [];
  const decisions: DecisionRecord[] = [];
  const outcomes: OutcomeRecord[] = [];

  let offerCounter = 0;
  let decisionCounter = 0;

  // Track purposeful scenarios counts
  let dominatedDecisionCount = 0;
  let nonDominatedDecisionCount = 0;
  let selectedNotFeasibleCount = 0;
  let insufficientDataDecisionCount = 0;
  let futureOfferCount = 0;

  for (let oIdx = 0; oIdx < TOTAL_ORDERS; oIdx++) {
    const orderNum = oIdx + 1;
    const orderId = `ORD-${String(orderNum).padStart(6, '0')}`;

    // Timestamp distribution: 80% baseline window, 20% recent window
    const isRecent = rand() < 0.22;
    const placedTimeMs = isRecent
      ? Math.floor(randFloat(recentCutoffMs, endTimeMs))
      : Math.floor(randFloat(startTimeMs, recentCutoffMs));
    const placedAt = new Date(placedTimeMs).toISOString();

    // Assign pharmacy (certain pharmacies have higher volume or targeted exception cohort)
    // PHARM-005 and PHARM-022 are HIGH_RISK cohorts
    // PHARM-012, PHARM-018, PHARM-025, PHARM-033 are AT_RISK cohorts
    const pharmacy = randChoice(pharmacies);

    // Multi-item orders: ~25% have 2-4 items, 75% single item
    const itemCount = rand() < 0.25 ? randInt(2, 4) : 1;
    const orderProducts = sampleUnique(products, itemCount, rand);

    const orderItems = orderProducts.map((p) => {
      const requestedQty = randChoice([10, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200]);
      return {
        productId: p.resolveProductId,
        productName: p.commercialNameEn,
        manufacturer: p.manufacturer,
        requestedQty,
        unit: 'pack',
      };
    });

    orders.push({
      orderId,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      placedAt,
      items: orderItems,
    });

    // Generate competing offers for each item in the order
    // Pick 2 to 4 candidate suppliers per order
    // Exclude LOW_SAMPLE suppliers except for 2 specific orders
    const candidateSuppliers = pickCandidateSuppliers(suppliers, orderNum, isRecent, pharmacy.id, rand);

    const orderOffers: OfferRecord[] = [];
    const itemOffersMap = new Map<string, OfferRecord[]>();

    for (const item of orderItems) {
      const prodRef = products.find((p) => p.resolveProductId === item.productId)!;
      const baseWholesaleMinor = parseInt(prodRef.estimatedWholesalePriceMinor, 10);
      const listForThisItem: OfferRecord[] = [];

      for (const supp of candidateSuppliers) {
        offerCounter++;
        const offerId = `OFFER-${String(offerCounter).padStart(7, '0')}`;

        // Quoted unit price in EGP (with decimals)
        const priceMinor = Math.round(baseWholesaleMinor * supp.priceMultiplier * randFloat(0.95, 1.05));
        const unitPriceEgp = (priceMinor / 100).toFixed(2);
        const discountPct = (randFloat(0, 10)).toFixed(1);

        // Offer timestamp (usually 15m to 2h after placedAt)
        const offerDelayMinutes = randInt(15, 120);
        const offeredAtMs = placedTimeMs + offerDelayMinutes * 60_000;
        const offeredAt = new Date(offeredAtMs).toISOString();

        // Promised delivery: supplier promised hours
        const promisedLeadHours = Math.max(4, supp.baseLeadHours + supp.promisedHoursOffset + randInt(-2, 4));
        const promisedDeliveryAt = new Date(offeredAtMs + promisedLeadHours * 3_600_000).toISOString();

        // Available quantity: mostly >= requested, occasionally partial stock
        let availableQty = item.requestedQty;
        if (rand() < 0.08) {
          availableQty = Math.floor(item.requestedQty * randFloat(0.3, 0.8));
        }

        const offer: OfferRecord = {
          offerId,
          orderId,
          supplierId: supp.id,
          supplierName: supp.name,
          productId: item.productId,
          availableQty,
          unitPriceEgp,
          discountPercent: discountPct,
          promisedDeliveryAt,
          offeredAt,
        };

        orderOffers.push(offer);
        listForThisItem.push(offer);
      }
      itemOffersMap.set(item.productId, listForThisItem);
    }

    // Future offer injection (~0.8% of orders get an intentional late offer for temporal exclusion proof)
    if (rand() < 0.008 && futureOfferCount < 80) {
      const lateSupp = randChoice(suppliers.filter((s) => s.role === 'STANDARD'));
      const firstItem = orderItems[0];
      offerCounter++;
      futureOfferCount++;
      const lateOfferMs = placedTimeMs + 4 * 3_600_000; // 4 hours after order (after decision!)
      orderOffers.push({
        offerId: `OFFER-FUT-${String(futureOfferCount).padStart(4, '0')}`,
        orderId,
        supplierId: lateSupp.id,
        supplierName: lateSupp.name,
        productId: firstItem.productId,
        availableQty: firstItem.requestedQty,
        unitPriceEgp: '10.00',
        discountPercent: '5.0',
        promisedDeliveryAt: new Date(lateOfferMs + 24 * 3_600_000).toISOString(),
        offeredAt: new Date(lateOfferMs).toISOString(),
        isFutureOffer: true,
      });
    }

    offers.push(...orderOffers);

    // AI Decision: Decided 2 hours after order placed
    const decidedAtMs = placedTimeMs + 2 * 3_600_000;
    const decidedAt = new Date(decidedAtMs).toISOString();
    decisionCounter++;
    const decisionId = `DEC-${String(decisionCounter).padStart(6, '0')}`;

    // Select winning supplier among valid offers
    // Purposefully engineer decision types:
    // 88% NON_DOMINATED, 8% DOMINATED (override), 3% SELECTED_NOT_FEASIBLE, 1% INSUFFICIENT_DATA
    const decisionRoll = rand();
    let selectedSupp = candidateSuppliers[0];
    let selectionReason = `Selected ${selectedSupp.name} based on optimal unit cost and historical fill rate reliability.`;
    let confidence = 0.88;

    if (decisionRoll < 0.01) {
      // No offer existed at decision time. The offers are retained with later
      // timestamps so the production replay engine, rather than the generator,
      // derives INSUFFICIENT_DATA and proves temporal exclusion.
      // Keep the same selected supplier that this roll used in the previous
      // deterministic sequence so downstream sample structure remains stable.
      selectedSupp = candidateSuppliers[1] ?? candidateSuppliers[0];
      for (let offerIndex = 0; offerIndex < orderOffers.length; offerIndex++) {
        orderOffers[offerIndex].offeredAt = new Date(
          decidedAtMs + (30 + offerIndex) * 60_000
        ).toISOString();
      }
      selectionReason = `Selected ${selectedSupp.name} without a recorded decision-time offer; evidence arrived after allocation.`;
      confidence = 0.5;
      insufficientDataDecisionCount++;
    } else if (decisionRoll < 0.08 && candidateSuppliers.length > 1) {
      // DOMINATED scenario: chosen supplier had higher price than a feasible competitor
      selectedSupp = candidateSuppliers[1];
      selectionReason = `Procurement override: selected ${selectedSupp.name} due to strategic volume contract despite higher per-unit quote.`;
      confidence = 0.65;
      dominatedDecisionCount++;
    } else if (decisionRoll < 0.11) {
      // SELECTED_NOT_FEASIBLE: supplier selected but had partial available qty
      selectedSupp = candidateSuppliers[0];
      selectionReason = `Selected ${selectedSupp.name} under emergency stock allocation.`;
      confidence = 0.72;
      selectedNotFeasibleCount++;
    } else {
      nonDominatedDecisionCount++;
      confidence = randFloat(0.82, 0.96);
    }

    decisions.push({
      decisionId,
      orderId,
      selectedSupplierId: selectedSupp.id,
      decidedAt,
      agentName: 'cluster-resolve-v1',
      agentVersion: '1.0.0',
      confidence: parseFloat(confidence.toFixed(2)),
      selectionReason,
    });

    // Outcomes: Generate execution outcomes for the selected supplier
    for (const item of orderItems) {
      const fillRateBps = isRecent ? selectedSupp.recentFillBps : selectedSupp.baseFillBps;
      const cancelRateBps = isRecent ? selectedSupp.recentCancelBps : selectedSupp.baseCancelBps;

      // Special case: Product-Specific Weakness for SUP-015 on weakProductIds
      let effectiveFillBps = fillRateBps;
      let effectiveCancelBps = cancelRateBps;
      if (selectedSupp.weakProductIds && selectedSupp.weakProductIds.has(item.productId)) {
        if (isRecent) {
          effectiveFillBps = 4500; // crashes to 45% in recent window
          effectiveCancelBps = 2500;
        }
      }

      // Pharmacy cohorts change the service outcomes, never the derived label.
      if (highServiceRiskPharmacyIds.has(pharmacy.id)) {
        effectiveFillBps = Math.min(effectiveFillBps, 6500);
        effectiveCancelBps = Math.max(effectiveCancelBps, 500);
      } else if (watchServiceRiskPharmacyIds.has(pharmacy.id)) {
        effectiveFillBps = Math.min(effectiveFillBps, 9700);
        effectiveCancelBps = 0;
      } else {
        effectiveCancelBps = 0;
      }

      // Preserve the generator's original structural PRNG sequence so order,
      // row, offer, and decision counts remain stable across this calibration.
      let legacyFillBps = selectedSupp.role === 'STABLE_STRONG'
        ? (isRecent ? 9800 : 9850)
        : selectedSupp.role === 'DETERIORATING'
          ? (isRecent ? 6200 : 9700)
          : selectedSupp.role === 'CHEAP_SLOW'
            ? 9200
            : selectedSupp.role === 'PRODUCT_WEAK'
              ? 9500
              : selectedSupp.role === 'OVERPROMISING'
                ? (isRecent ? 9000 : 9100)
                : selectedSupp.role === 'LOW_SAMPLE'
                  ? 8000
                  : 9600;
      let legacyCancelBps = selectedSupp.role === 'STABLE_STRONG'
        ? (isRecent ? 80 : 50)
        : selectedSupp.role === 'DETERIORATING'
          ? (isRecent ? 1800 : 100)
          : selectedSupp.role === 'CHEAP_SLOW'
            ? 300
            : selectedSupp.role === 'PRODUCT_WEAK'
              ? 100
              : selectedSupp.role === 'OVERPROMISING'
                ? (isRecent ? 500 : 400)
                : selectedSupp.role === 'LOW_SAMPLE'
                  ? 0
                  : 150;
      if (selectedSupp.weakProductIds?.has(item.productId) && isRecent) {
        legacyFillBps = 4500;
        legacyCancelBps = 2500;
      }
      if ((pharmacy.id === 'PHARM-005' || pharmacy.id === 'PHARM-022') && isRecent) {
        legacyFillBps = Math.min(legacyFillBps, 4000);
        legacyCancelBps = Math.max(legacyCancelBps, 3000);
      }
      const legacyRoll = rand() * 10000;
      if (legacyRoll < legacyCancelBps) {
        randChoice(['cancel-a', 'cancel-b', 'cancel-c', 'cancel-d']);
      } else if (legacyRoll < 10000 - legacyFillBps + legacyCancelBps) {
        randFloat(0.3, 0.75);
        randInt(-2, 8);
      } else {
        randInt(-4, 6);
      }

      const outcomeRoll = serviceRand() * 10000;
      let cancelled = false;
      let cancellationReason: string | null = null;
      let filledQty = item.requestedQty;
      let deliveredAt: string | null = null;

      if (outcomeRoll < effectiveCancelBps) {
        // Cancelled
        cancelled = true;
        cancellationReason = serviceRandChoice([
          'Stock exhausted at regional depot.',
          'Logistics delay resulted in cancellation by pharmacy.',
          'Supplier cancelled due to regulatory recall hold.',
          'Unfulfilled stock quota.',
        ]);
        filledQty = 0;
        deliveredAt = null;
      } else if (outcomeRoll < 10000 - effectiveFillBps + effectiveCancelBps) {
        // Partial fill
        cancelled = false;
        filledQty = Math.max(1, Math.floor(item.requestedQty * serviceRandFloat(0.3, 0.75)));
      } else {
        // Fully fulfilled
        cancelled = false;
        filledQty = item.requestedQty;
      }

      if (!cancelled) {
        const selectedOffer = itemOffersMap
          .get(item.productId)
          ?.find((offer) => offer.supplierId === selectedSupp.id);
        if (!selectedOffer) {
          throw new Error(`Selected supplier ${selectedSupp.id} has no offer for ${orderId}/${item.productId}.`);
        }

        let lateProbability = 0.02;
        if (selectedSupp.role === 'DETERIORATING') lateProbability = isRecent ? 0.55 : 0.04;
        if (selectedSupp.role === 'CHEAP_SLOW') lateProbability = 0.05;
        if (selectedSupp.role === 'OVERPROMISING') lateProbability = 0.65;
        if (selectedSupp.role === 'PRODUCT_WEAK') lateProbability = isRecent ? 0.08 : 0.02;
        if (highServiceRiskPharmacyIds.has(pharmacy.id)) lateProbability = Math.max(lateProbability, 0.45);
        if (watchServiceRiskPharmacyIds.has(pharmacy.id)) lateProbability = Math.max(lateProbability, 0.08);

        const promisedMs = Date.parse(selectedOffer.promisedDeliveryAt);
        const deliveryDeltaHours = serviceRand() < lateProbability
          ? serviceRandInt(2, 20)
          : -serviceRandInt(1, 6);
        const deliveredMs = Math.max(
          promisedMs + deliveryDeltaHours * 3_600_000,
          decidedAtMs + 3_600_000
        );
        deliveredAt = new Date(deliveredMs).toISOString();
      }

      outcomes.push({
        orderId,
        supplierId: selectedSupp.id,
        productId: item.productId,
        filledQty,
        deliveredAt,
        cancelled,
        cancellationReason,
        outcomeFinal: true,
      });
    }
  }

  console.log(`[generator] Formatted ${orders.length} orders, ${offers.length} offers, ${decisions.length} decisions, ${outcomes.length} outcomes.`);
  console.log(`[generator] Scenarios summary: Dominated decisions=${dominatedDecisionCount}, Future offers=${futureOfferCount}, Not-feasible decisions=${selectedNotFeasibleCount}, Insufficient-data decisions=${insufficientDataDecisionCount}`);

  // 5. Build CSV strings matching canonical import schema
  // orders.csv
  const ordersCsvRows = [
    'order_id,pharmacy_id,pharmacy_name,placed_at,product_id,product_name,manufacturer,requested_qty,unit',
  ];
  for (const o of orders) {
    for (const item of o.items) {
      ordersCsvRows.push(
        [
          escapeCsv(o.orderId),
          escapeCsv(o.pharmacyId),
          escapeCsv(o.pharmacyName),
          escapeCsv(o.placedAt),
          escapeCsv(item.productId),
          escapeCsv(item.productName),
          escapeCsv(item.manufacturer),
          String(item.requestedQty),
          escapeCsv(item.unit),
        ].join(',')
      );
    }
  }
  const ordersCsv = ordersCsvRows.join('\n');

  // offers.csv
  const offersCsvRows = [
    'offer_id,order_id,supplier_id,supplier_name,product_id,available_qty,unit_price_egp,discount_percent,promised_delivery_at,offered_at',
  ];
  for (const off of offers) {
    offersCsvRows.push(
      [
        escapeCsv(off.offerId),
        escapeCsv(off.orderId),
        escapeCsv(off.supplierId),
        escapeCsv(off.supplierName),
        escapeCsv(off.productId),
        String(off.availableQty),
        off.unitPriceEgp,
        off.discountPercent,
        escapeCsv(off.promisedDeliveryAt),
        escapeCsv(off.offeredAt),
      ].join(',')
    );
  }
  const offersCsv = offersCsvRows.join('\n');

  // decisions.csv
  const decisionsCsvRows = [
    'decision_id,order_id,selected_supplier_id,decided_at,agent_name,agent_version,confidence,selection_reason',
  ];
  for (const d of decisions) {
    decisionsCsvRows.push(
      [
        escapeCsv(d.decisionId),
        escapeCsv(d.orderId),
        escapeCsv(d.selectedSupplierId),
        escapeCsv(d.decidedAt),
        escapeCsv(d.agentName),
        escapeCsv(d.agentVersion),
        String(d.confidence),
        escapeCsv(d.selectionReason),
      ].join(',')
    );
  }
  const decisionsCsv = decisionsCsvRows.join('\n');

  // outcomes.csv
  const outcomesCsvRows = [
    'order_id,supplier_id,product_id,filled_qty,delivered_at,cancelled,cancellation_reason,outcome_final',
  ];
  for (const out of outcomes) {
    outcomesCsvRows.push(
      [
        escapeCsv(out.orderId),
        escapeCsv(out.supplierId),
        escapeCsv(out.productId),
        String(out.filledQty),
        out.deliveredAt ? escapeCsv(out.deliveredAt) : '',
        out.cancelled ? 'true' : 'false',
        out.cancellationReason ? escapeCsv(out.cancellationReason) : '',
        out.outcomeFinal ? 'true' : 'false',
      ].join(',')
    );
  }
  const outcomesCsv = outcomesCsvRows.join('\n');

  // 6. Generate Manifest
  const ordersSha256 = sha256(ordersCsv);
  const offersSha256 = sha256(offersCsv);
  const decisionsSha256 = sha256(decisionsCsv);
  const outcomesSha256 = sha256(outcomesCsv);

  const manifest = {
    datasetName: 'Cluster Resolve · Founder Demo',
    datasetMode: 'SAMPLE',
    generatorVersion: GENERATOR_VERSION,
    seed: GENERATOR_SEED,
    generationVersion: '2026-08-16',
    fixedDateRange: {
      start: FIXED_DATE_START,
      end: FIXED_DATE_END,
      asOf: AS_OF_DATE,
      recentWindowDays: RECENT_WINDOW_DAYS,
    },
    counts: {
      distinctOrders: orders.length,
      ordersCsvRows: ordersCsvRows.length - 1,
      offersCsvRows: offers.length,
      decisionsCsvRows: decisions.length,
      outcomesCsvRows: outcomes.length,
      supplierCount: suppliers.length,
      pharmacyCount: pharmacies.length,
      productCount: products.length,
    },
    publicProductSource: {
      repository: 'https://github.com/karem505/egyptian-drug-database',
      sourceFile: 'data/egyptian-drugs.csv',
      license: 'CC0-1.0 (Public Domain)',
      sourceRevision: '82809ebb972adf976d5301689cdab68b00346f71',
      retrievalDate: '2026-08-15',
      upstreamRecordCount: 25070,
      productsUsed: products.length,
      selectedSnapshotSha256: sha256(readFileSync(REFERENCE_FILE, 'utf-8')),
      sourceFieldsUsed: [
        'commercial_name_en',
        'commercial_name_ar',
        'scientific_name',
        'manufacturer',
        'drug_class',
        'route',
        'price_egp',
      ],
    },
    procurementDataNature:
      'deterministic synthetic procurement history using licensed public product references',
    purposefulScenarios: {
      stableStrongSuppliers: ['SUP-001', 'SUP-002', 'SUP-003', 'SUP-004', 'SUP-005', 'SUP-006', 'SUP-007', 'SUP-008'],
      deterioratingSuppliers: ['SUP-011', 'SUP-012'],
      cheapButSlowSuppliers: ['SUP-013', 'SUP-014'],
      productSpecificWeakSuppliers: ['SUP-015'],
      overpromisingSuppliers: ['SUP-016'],
      lowSampleSuppliers: ['SUP-029', 'SUP-030'],
      pharmacyServiceRiskHigh: [...highServiceRiskPharmacyIds],
      pharmacyServiceRiskAtRisk: [...watchServiceRiskPharmacyIds],
      decisionScenarios: {
        dominatedCount: dominatedDecisionCount,
        nonDominatedCount: nonDominatedDecisionCount,
        selectedNotFeasibleCount: selectedNotFeasibleCount,
        insufficientDataCount: insufficientDataDecisionCount,
      },
      futureOffersExcludedCount: futureOfferCount,
    },
    checksums: {
      'orders.csv': ordersSha256,
      'offers.csv': offersSha256,
      'decisions.csv': decisionsSha256,
      'outcomes.csv': outcomesSha256,
    },
  };

  // 7. Write to OUTPUT_DIR
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  writeFileSync(resolve(OUTPUT_DIR, 'orders.csv'), ordersCsv, 'utf-8');
  writeFileSync(resolve(OUTPUT_DIR, 'offers.csv'), offersCsv, 'utf-8');
  writeFileSync(resolve(OUTPUT_DIR, 'decisions.csv'), decisionsCsv, 'utf-8');
  writeFileSync(resolve(OUTPUT_DIR, 'outcomes.csv'), outcomesCsv, 'utf-8');
  writeFileSync(resolve(OUTPUT_DIR, 'founder-demo-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`[generator] Successfully written all 4 CSVs and manifest to ${OUTPUT_DIR}`);
  return {
    ordersCsv,
    offersCsv,
    decisionsCsv,
    outcomesCsv,
    manifest,
  };
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function sampleUnique<T>(arr: readonly T[], count: number, rand: () => number): T[] {
  const result: T[] = [];
  const chosenIndices = new Set<number>();
  const target = Math.min(count, arr.length);
  while (chosenIndices.size < target) {
    const idx = Math.floor(rand() * arr.length);
    if (!chosenIndices.has(idx)) {
      chosenIndices.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}

function pickCandidateSuppliers<T extends { id: string; name: string; role: string }>(
  suppliers: T[],
  orderNum: number,
  isRecent: boolean,
  pharmacyId: string,
  rand: () => number
): T[] {
  // Candidate pool excludes LOW_SAMPLE suppliers except for order 1 and 2
  if (orderNum === 1) {
    const lowSupp = suppliers.find((s) => s.id === 'SUP-029')!;
    const otherSupps = sampleUnique(suppliers.filter((s) => s.role === 'STANDARD'), 2, rand);
    return [lowSupp, ...otherSupps];
  }
  if (orderNum === 2) {
    const lowSupp = suppliers.find((s) => s.id === 'SUP-030')!;
    const otherSupps = sampleUnique(suppliers.filter((s) => s.role === 'STANDARD'), 2, rand);
    return [lowSupp, ...otherSupps];
  }

  const pool = suppliers.filter((s) => s.role !== 'LOW_SAMPLE');

  // Purposefully include deteriorating suppliers in recent orders for PHARM-005 & PHARM-022
  if ((pharmacyId === 'PHARM-005' || pharmacyId === 'PHARM-022') && isRecent) {
    const detSupp = suppliers.find((s) => s.role === 'DETERIORATING')!;
    const otherSupps = sampleUnique(pool.filter((s) => s.id !== detSupp.id), 2, rand);
    return [detSupp, ...otherSupps];
  }

  // Include product weak supplier for order % 7 === 0
  if (orderNum % 7 === 0) {
    const weakSupp = suppliers.find((s) => s.role === 'PRODUCT_WEAK')!;
    const otherSupps = sampleUnique(pool.filter((s) => s.id !== weakSupp.id), 2, rand);
    return [weakSupp, ...otherSupps];
  }

  // Include overpromising supplier for order % 9 === 0
  if (orderNum % 9 === 0) {
    const overSupp = suppliers.find((s) => s.role === 'OVERPROMISING')!;
    const otherSupps = sampleUnique(pool.filter((s) => s.id !== overSupp.id), 2, rand);
    return [overSupp, ...otherSupps];
  }

  // General candidate picking: 2 to 3 suppliers
  const count = rand() < 0.6 ? 3 : 2;
  return sampleUnique(pool, count, rand);
}

if (process.argv[1]?.includes('generate-founder-demo-data')) {
  try {
    generateFounderDemoData();
    process.exit(0);
  } catch (err) {
    console.error('[generator] FAILED:', err);
    process.exit(1);
  }
}
