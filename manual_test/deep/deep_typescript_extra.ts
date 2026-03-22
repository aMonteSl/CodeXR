// Deep TypeScript fixture
export function deepCompute(values: number[], limit: number, offset: number): number {
  let total = 0;
  for (const value of values) {
    if (value > limit) {
      if (offset > 0) {
        total += value + offset;
      }
    }
  }
  return total;
}
