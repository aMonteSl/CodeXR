// TSX fixture for CodeXR metrics
import React from 'react';

export function compute(values: number[], limit: number): number {
  return values.reduce((total, value) => {
    if (value > limit) {
      if (value % 2 === 0) {
        return total + value;
      }
    }
    return total;
  }, 0);
}

export function MetricPanel({ values, limit }: { values: number[]; limit: number }) {
  const total = compute(values, limit);
  if (total > limit) {
    if (values.length > 1) {
      return <article>{total}</article>;
    }
  }
  return <article>{limit}</article>;
}
