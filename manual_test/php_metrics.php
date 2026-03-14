<?php
// PHP fixture for CodeXR metrics
class MetricBox {
    public function compute(array $values, int $limit): int {
        $total = 0;
        foreach ($values as $value) {
            if ($value > $limit) {
                if ($value % 2 === 0) {
                    $total += $value;
                } else {
                    $total += $limit;
                }
            }
        }
        return $total;
    }

    public function helper(int $value, int $offset): int {
        if ($value > $offset) {
            if ($offset > 0) {
                return $value + $offset;
            }
        }
        return $value;
    }
}
