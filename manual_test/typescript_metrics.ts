// TypeScript fixture for CodeXR metrics
export type MetricPair = { value: number; limit: number };

export function compute(values: number[], limit: number): number {
  let total = 0;
  for (const value of values) {
    if (value > limit) {
      if (value % 2 === 0) {
        total += value;
      } else {
        total += limit;
      }
    }
  }
  return total;
}

export function helper(pair: MetricPair, offset: number): number {
  if (pair.value > pair.limit) {
    if (offset > 0) {
      return pair.value + offset;
    }
  }
  return pair.limit;
}
