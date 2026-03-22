// C++ fixture for CodeXR metrics
#include <vector>

class MetricBox {
public:
    int compute(const std::vector<int>& values, int limit) {
        int total = 0;
        for (int value : values) {
            if (value > limit) {
                if ((value % 2) == 0) {
                    total += value;
                } else {
                    total += limit;
                }
            }
        }
        return total;
    }

    int helper(int value, int offset) {
        if (value > offset) {
            if (offset > 0) {
                return value + offset;
            }
        }
        return value;
    }
};
