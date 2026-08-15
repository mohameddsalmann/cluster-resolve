import type { TraceabilityProductCatalogItem, TraceabilityProductLink } from './types';

export function matchProductWithGtin(
  gtin: string,
  gtinDescription: string | null,
  catalogProducts: TraceabilityProductCatalogItem[]
): {
  productId: string | null;
  status: 'CONFIRMED' | 'SUGGESTED' | 'UNMATCHED';
  reason: string;
} {
  const cleanGtin = gtin.trim();

  // 1. Exact catalog GTIN match
  const exactMatch = catalogProducts.find(
    (p) => p.gtin && p.gtin.trim() === cleanGtin
  );
  if (exactMatch) {
    return {
      productId: exactMatch.id,
      status: 'CONFIRMED',
      reason: `Direct catalog GTIN match (${cleanGtin}) with product '${exactMatch.name}'`,
    };
  }

  // 2. Exact external ID match
  const externalMatch = catalogProducts.find(
    (p) => p.externalProductId && p.externalProductId.trim() === cleanGtin
  );
  if (externalMatch) {
    return {
      productId: externalMatch.id,
      status: 'CONFIRMED',
      reason: `Direct external ID match with product '${externalMatch.name}'`,
    };
  }

  // 3. Name token correlation if GTIN description is provided
  if (gtinDescription) {
    const normDesc = gtinDescription.toLowerCase().replace(/[^\w\s]/g, ' ');
    const descTokens = normDesc.split(/\s+/).filter((t) => t.length > 2);

    let bestProd: TraceabilityProductCatalogItem | null = null;
    let bestScore = 0;
    let bestMatchedTokens: string[] = [];

    for (const prod of catalogProducts) {
      const normProd = prod.nameNormalized.toLowerCase().replace(/[^\w\s]/g, ' ');
      const prodTokens = normProd.split(/\s+/).filter((t) => t.length > 2);

      const matchedTokens = descTokens.filter((t) => prodTokens.includes(t));
      let score = matchedTokens.length;
      if (descTokens[0] && prodTokens[0] && descTokens[0] === prodTokens[0]) {
        score += 3;
      }

      if (score > bestScore && (matchedTokens.length >= 2 || (matchedTokens.length === 1 && descTokens[0] === prodTokens[0]))) {
        bestScore = score;
        bestProd = prod;
        bestMatchedTokens = matchedTokens;
      }
    }

    if (bestProd) {
      return {
        productId: bestProd.id,
        status: 'SUGGESTED',
        reason: `Suggested linkage to '${bestProd.name}' based on pharmaceutical description token overlap: [${bestMatchedTokens.join(', ')}]. Verification required.`,
      };
    }
  }

  return {
    productId: null,
    status: 'UNMATCHED',
    reason: `No catalog product matches GTIN ${cleanGtin}`,
  };
}

export function buildProductLinks(
  datasetId: string,
  gtins: Array<{ gtin: string; description?: string | null }>,
  catalogProducts: TraceabilityProductCatalogItem[],
  existingConfirmedLinks: Map<string, string> = new Map()
): TraceabilityProductLink[] {
  const links: TraceabilityProductLink[] = [];

  for (const item of gtins) {
    // If already confirmed in repository
    if (existingConfirmedLinks.has(item.gtin)) {
      const prodId = existingConfirmedLinks.get(item.gtin)!;
      links.push({
        datasetId,
        productId: prodId,
        gtin: item.gtin,
        status: 'CONFIRMED',
        confidenceReason: 'Explicitly confirmed in crosswalk repository.',
      });
      continue;
    }

    const { productId, status, reason } = matchProductWithGtin(
      item.gtin,
      item.description || null,
      catalogProducts
    );

    if (productId && (status === 'CONFIRMED' || status === 'SUGGESTED')) {
      links.push({
        datasetId,
        productId,
        gtin: item.gtin,
        status,
        confidenceReason: reason,
      });
    }
  }

  return links;
}
