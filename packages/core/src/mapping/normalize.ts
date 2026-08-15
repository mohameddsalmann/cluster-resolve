/**
 * Normalizes a column header string for robust deterministic comparison:
 * - Trims whitespace
 * - Splits camelCase and PascalCase (e.g., "orderTimestamp" -> "order timestamp")
 * - Converts hyphens, underscores, dots, and slashes to spaces
 * - Strips non-alphanumeric characters (punctuation)
 * - Collapses consecutive spaces
 * - Converts to lowercase
 */
export function normalizeHeader(raw: string): string {
  if (!raw) return '';

  return raw
    .trim()
    // Split camelCase / PascalCase: e.g. "orderPlacedAt" -> "order Placed At"
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Split numbers followed by letters: e.g. "sku2Name" -> "sku 2 Name"
    .replace(/([A-Za-z])([0-9]+)/g, '$1 $2')
    // Replace separators with spaces
    .replace(/[-_./\\:]+/g, ' ')
    // Remove unwanted punctuation characters (keep alphanumeric and spaces)
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes a header into a canonical snake_case token for direct alias lookup.
 */
export function headerToSnakeCase(raw: string): string {
  return normalizeHeader(raw).replace(/\s+/g, '_');
}
