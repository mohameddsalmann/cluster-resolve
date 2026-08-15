import type {
  CanonicalTraceabilityEventRecord,
} from '../eptts/types';
import type {
  ExpiryBucket,
  ExpiryIntelligenceItem,
  ExpirySummary,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function determineExpiryBucket(
  expiryDateStr: string | null | undefined,
  asOfDateMs: number
): { bucket: ExpiryBucket; daysToExpiry: number | null } {
  if (!expiryDateStr) {
    return { bucket: 'UNKNOWN', daysToExpiry: null };
  }

  const expiryMs = Date.parse(expiryDateStr);
  if (Number.isNaN(expiryMs)) {
    return { bucket: 'UNKNOWN', daysToExpiry: null };
  }

  const diffMs = expiryMs - asOfDateMs;
  const daysToExpiry = Math.ceil(diffMs / MS_PER_DAY);

  if (daysToExpiry < 0) {
    return { bucket: 'EXPIRED', daysToExpiry };
  }
  if (daysToExpiry <= 90) {
    return { bucket: 'EXPIRING_90', daysToExpiry };
  }
  if (daysToExpiry <= 180) {
    return { bucket: 'EXPIRING_180', daysToExpiry };
  }
  return { bucket: 'LATER', daysToExpiry };
}

export function evaluateExpiryIntelligence(
  events: CanonicalTraceabilityEventRecord[],
  asOfDate: string = new Date().toISOString(),
  productNameMap: Map<string, string> = new Map()
): {
  summary: ExpirySummary;
  items: ExpiryIntelligenceItem[];
} {
  const asOfMs = Date.parse(asOfDate);
  const serialMap = new Map<string, CanonicalTraceabilityEventRecord>();

  // Deduplicate to latest event per serial
  for (const ev of events) {
    if (ev.serial && ev.gtin) {
      const key = `${ev.gtin}:${ev.serial}`;
      const existing = serialMap.get(key);
      if (!existing || Date.parse(ev.eventTime) > Date.parse(existing.eventTime)) {
        serialMap.set(key, ev);
      }
    }
  }

  let expired = 0;
  let expiring90 = 0;
  let expiring180 = 0;
  let later = 0;
  let unknown = 0;

  const items: ExpiryIntelligenceItem[] = [];

  for (const ev of serialMap.values()) {
    const { bucket, daysToExpiry } = determineExpiryBucket(ev.expiryDate, asOfMs);

    switch (bucket) {
      case 'EXPIRED':
        expired++;
        break;
      case 'EXPIRING_90':
        expiring90++;
        break;
      case 'EXPIRING_180':
        expiring180++;
        break;
      case 'LATER':
        later++;
        break;
      case 'UNKNOWN':
        unknown++;
        break;
    }

    const gtin = ev.gtin!;
    items.push({
      epc: ev.epc,
      gtin,
      productName: productNameMap.get(gtin) || null,
      serial: ev.serial!,
      batch: ev.batch || null,
      expiryDate: ev.expiryDate || null,
      daysToExpiry,
      bucket,
      readPointGln: ev.readPointGln,
      lastEventTime: ev.eventTime,
    });
  }

  // Sort by days to expiry ascending (most urgent first)
  items.sort((a, b) => {
    if (a.daysToExpiry === null) return 1;
    if (b.daysToExpiry === null) return -1;
    return a.daysToExpiry - b.daysToExpiry;
  });

  return {
    summary: {
      asOfDate,
      totalSerializedUnits: items.length,
      expiredCount: expired,
      expiring90DaysCount: expiring90,
      expiring180DaysCount: expiring180,
      laterCount: later,
      unknownExpiryCount: unknown,
    },
    items,
  };
}
