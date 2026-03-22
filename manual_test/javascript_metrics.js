// JavaScript fixture for CodeXR metrics
export function compute(values, limit) {
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

export function helper(value, offset) {
  if (value > offset) {
    if (offset > 0) {
      return value + offset;
    }
  }
  return value;
}
