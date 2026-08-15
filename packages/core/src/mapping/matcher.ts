import {
  CANONICAL_FIELD_METADATA,
  type ColumnMappingCandidate,
  type ImportKind,
} from './types';
import { CANONICAL_FIELD_ALIASES } from './aliases';
import { headerToSnakeCase, normalizeHeader } from './normalize';

/**
 * Calculates Levenshtein distance between two normalized strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Calculates normalized string similarity score (0.0 to 1.0).
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

/**
 * Token overlap / Dice coefficient for multi-word headers.
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  return (2.0 * intersection) / (tokensA.size + tokensB.size);
}

/**
 * Ambiguous terms that must require user review if matched vaguely.
 */
const GENERIC_AMBIGUOUS_TERMS = new Set([
  'quantity',
  'qty',
  'count',
  'amount',
  'id',
  'code',
  'number',
  'no',
  'num',
  'date',
  'time',
  'timestamp',
  'datetime',
  'val',
  'value',
  'name',
  'type',
  'status',
]);

/**
 * Matches a single source column header to canonical fields of an import kind.
 */
export function matchHeaderToCanonical(
  rawHeader: string,
  kind: ImportKind
): ColumnMappingCandidate {
  const normalizedWords = normalizeHeader(rawHeader);
  const normalizedSnake = headerToSnakeCase(rawHeader);

  if (!normalizedWords) {
    return {
      targetField: null,
      confidence: 'UNMAPPED',
      matchType: 'UNMAPPED',
      reason: 'Empty header name',
    };
  }

  const kindMetadata = CANONICAL_FIELD_METADATA[kind];
  const canonicalFields = Object.keys(kindMetadata);
  const aliasesForKind = CANONICAL_FIELD_ALIASES[kind] ?? {};

  // 1. Exact match with canonical field name
  for (const canonicalField of canonicalFields) {
    if (normalizedSnake === canonicalField || normalizedWords === canonicalField.replace(/_/g, ' ')) {
      return {
        targetField: canonicalField,
        confidence: 'HIGH',
        matchType: 'EXACT_CANONICAL',
        reason: `Exact match for canonical field "${canonicalField}"`,
      };
    }
  }

  // 2. Exact match with a known deterministic alias
  const aliasMatches: string[] = [];
  for (const canonicalField of canonicalFields) {
    const aliases = aliasesForKind[canonicalField] ?? [];
    for (const alias of aliases) {
      const aliasSnake = headerToSnakeCase(alias);
      const aliasWords = normalizeHeader(alias);
      if (normalizedSnake === aliasSnake || normalizedWords === aliasWords) {
        aliasMatches.push(canonicalField);
        break;
      }
    }
  }

  if (aliasMatches.length === 1) {
    return {
      targetField: aliasMatches[0],
      confidence: 'HIGH',
      matchType: 'KNOWN_ALIAS',
      reason: `Matched known alias for "${aliasMatches[0]}"`,
    };
  }
  if (aliasMatches.length > 1) {
    return {
      targetField: aliasMatches[0],
      confidence: 'NEEDS_REVIEW',
      matchType: 'AMBIGUOUS',
      reason: `Header matched multiple candidate aliases: ${aliasMatches.join(', ')}`,
      alternateCandidates: aliasMatches,
    };
  }

  // 3. Ambiguous generic term check
  if (GENERIC_AMBIGUOUS_TERMS.has(normalizedWords) || GENERIC_AMBIGUOUS_TERMS.has(normalizedSnake)) {
    // Collect potential fields in this schema that have this generic concept
    const plausible: string[] = [];
    if (normalizedWords.includes('qty') || normalizedWords.includes('quantity')) {
      if (kind === 'ORDERS') plausible.push('requested_qty');
      if (kind === 'OFFERS') plausible.push('available_qty');
      if (kind === 'OUTCOMES') plausible.push('filled_qty');
    } else if (normalizedWords.includes('date') || normalizedWords.includes('time')) {
      if (kind === 'ORDERS') plausible.push('placed_at');
      if (kind === 'OFFERS') plausible.push('offered_at', 'promised_delivery_at');
      if (kind === 'OUTCOMES') plausible.push('delivered_at');
      if (kind === 'DECISIONS') plausible.push('decided_at');
    } else if (normalizedWords === 'id' || normalizedWords === 'code' || normalizedWords === 'number') {
      if (kind === 'ORDERS') plausible.push('order_id', 'product_id', 'pharmacy_id');
      if (kind === 'OFFERS') plausible.push('offer_id', 'order_id', 'supplier_id', 'product_id');
      if (kind === 'OUTCOMES') plausible.push('order_id', 'supplier_id', 'product_id');
      if (kind === 'DECISIONS') plausible.push('decision_id', 'order_id', 'selected_supplier_id');
    }

    if (plausible.length === 1) {
      return {
        targetField: plausible[0],
        confidence: 'NEEDS_REVIEW',
        matchType: 'AMBIGUOUS',
        reason: `Generic field "${rawHeader}" likely refers to "${plausible[0]}", review required`,
        alternateCandidates: plausible,
      };
    }
    if (plausible.length > 1) {
      return {
        targetField: plausible[0],
        confidence: 'NEEDS_REVIEW',
        matchType: 'AMBIGUOUS',
        reason: `Generic field "${rawHeader}" is ambiguous across ${plausible.join(', ')}`,
        alternateCandidates: plausible,
      };
    }
  }

  // 4. Deterministic Fuzzy matching across canonical fields & aliases
  interface ScoredCandidate {
    canonicalField: string;
    score: number;
    matchedOn: string;
  }
  const scored: ScoredCandidate[] = [];

  for (const canonicalField of canonicalFields) {
    const canonicalWords = canonicalField.replace(/_/g, ' ');
    const simCanonical = Math.max(
      stringSimilarity(normalizedWords, canonicalWords),
      tokenSimilarity(normalizedWords, canonicalWords)
    );
    if (simCanonical >= 0.75) {
      scored.push({ canonicalField, score: simCanonical, matchedOn: canonicalField });
    }

    const aliases = aliasesForKind[canonicalField] ?? [];
    for (const alias of aliases) {
      const aliasWords = normalizeHeader(alias);
      const sim = Math.max(
        stringSimilarity(normalizedWords, aliasWords),
        tokenSimilarity(normalizedWords, aliasWords)
      );
      if (sim >= 0.75) {
        scored.push({ canonicalField, score: sim, matchedOn: alias });
      }
    }
  }

  // Deduplicate scored candidates by canonicalField taking max score
  const candidateScores = new Map<string, ScoredCandidate>();
  for (const item of scored) {
    const existing = candidateScores.get(item.canonicalField);
    if (!existing || item.score > existing.score) {
      candidateScores.set(item.canonicalField, item);
    }
  }

  const sortedCandidates = Array.from(candidateScores.values()).sort((a, b) => b.score - a.score);

  if (sortedCandidates.length === 1 && sortedCandidates[0].score >= 0.82) {
    return {
      targetField: sortedCandidates[0].canonicalField,
      confidence: 'MEDIUM',
      matchType: 'FUZZY_MATCH',
      reason: `Fuzzy match with "${sortedCandidates[0].matchedOn}" (${Math.round(sortedCandidates[0].score * 100)}% similarity)`,
    };
  }

  if (sortedCandidates.length > 1) {
    const top = sortedCandidates[0];
    const runnerUp = sortedCandidates[1];
    // If top candidate is clearly superior by >= 0.15 and >= 0.85 score
    if (top.score >= 0.85 && top.score - runnerUp.score >= 0.15) {
      return {
        targetField: top.canonicalField,
        confidence: 'MEDIUM',
        matchType: 'FUZZY_MATCH',
        reason: `Fuzzy match with "${top.matchedOn}" (${Math.round(top.score * 100)}% similarity)`,
        alternateCandidates: sortedCandidates.slice(1, 4).map((c) => c.canonicalField),
      };
    }

    return {
      targetField: top.canonicalField,
      confidence: 'NEEDS_REVIEW',
      matchType: 'AMBIGUOUS',
      reason: `Multiple possible matches: ${sortedCandidates.slice(0, 3).map((c) => c.canonicalField).join(', ')}`,
      alternateCandidates: sortedCandidates.slice(0, 4).map((c) => c.canonicalField),
    };
  }

  return {
    targetField: null,
    confidence: 'UNMAPPED',
    matchType: 'UNMAPPED',
    reason: 'No confident canonical match found',
  };
}
