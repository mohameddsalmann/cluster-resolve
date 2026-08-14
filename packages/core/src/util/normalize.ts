/**
 * Name normalization utilities for Arabic and English product / supplier / entity names.
 */

/**
 * Normalize an Arabic/English string for deterministic fuzzy/exact matching.
 * - Strips Arabic diacritics (tashkeel).
 * - Normalizes Alef variations (أ, إ, آ -> ا).
 * - Normalizes Alef Maksura (ى -> ي).
 * - Normalizes Teh Marbuta (ة -> ه).
 * - Collapses consecutive whitespace and trims.
 * - Lowercases Latin characters.
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  let text = input.trim();

  // 1. Lowercase Latin characters
  text = text.toLowerCase();

  // 2. Remove Arabic Tashkeel (diacritics: Fatha, Damma, Kasra, Sukun, Shadda, etc.)
  // Range: U+064B to U+0652, plus U+0670
  text = text.replace(/[\u064B-\u0652\u0670]/g, '');

  // 3. Normalize Alef variants -> ا
  text = text.replace(/[أإآ]/g, 'ا');

  // 4. Normalize Alef Maksura -> ي
  text = text.replace(/ى/g, 'ي');

  // 5. Normalize Teh Marbuta -> ه
  text = text.replace(/ة/g, 'ه');

  // 6. Collapse whitespace (spaces, tabs, newlines)
  text = text.replace(/\s+/g, ' ');

  return text;
}
