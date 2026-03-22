<template>
  <section>{{ total }}</section>
</template>

<script lang="ts">
// Vue fixture for CodeXR metrics
export function compute(values: number[], limit: number): number {
  let total = 0;
  for (const value of values) {
    if (value > limit) {
      if (value % 2 === 0) {
        total += value;
      }
    }
  }
  return total;
}

export function helper(value: number, offset: number): number {
  if (value > offset) {
    if (offset > 0) {
      return value + offset;
    }
  }
  return value;
}
</script>

<!-- Vue comment for metric counting -->
