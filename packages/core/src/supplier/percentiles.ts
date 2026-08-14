export function nearestRankPercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  if (!Number.isInteger(percentile) || percentile < 1 || percentile > 100) {
    throw new Error('Percentile must be an integer from 1 through 100.');
  }
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Percentile observations must be nonnegative integers.');
  }
  const sorted = [...values].sort((left, right) => left - right);
  // Nearest rank: rank = ceil(P / 100 * N), expressed with integer arithmetic.
  const rank = Math.floor((percentile * sorted.length + 99) / 100);
  return sorted[rank - 1];
}
