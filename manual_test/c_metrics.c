// C fixture for CodeXR metrics
#include <stddef.h>

typedef struct MetricPair {
    int value;
    int limit;
} MetricPair;

int compute(const int *values, size_t count, int limit) {
    int total = 0;
    for (size_t index = 0; index < count; ++index) {
        if (values[index] > limit) {
            if ((values[index] % 2) == 0) {
                total += values[index];
            } else {
                total += limit;
            }
        }
    }
    return total;
}

int helper(MetricPair pair, int offset) {
    if (pair.value > pair.limit) {
        if (offset > 0) {
            return pair.value + offset;
        }
    }
    return pair.limit;
}
