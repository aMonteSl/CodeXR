// Java fixture for CodeXR metrics
public class JavaMetrics {
    public int compute(int[] values, int limit) {
        int total = 0;
        for (int value : values) {
            if (value > limit) {
                if (value % 2 == 0) {
                    total += value;
                } else {
                    total += limit;
                }
            }
        }
        return total;
    }

    public int helper(int value, int offset) {
        if (value > offset) {
            if (offset > 0) {
                return value + offset;
            }
        }
        return value;
    }
}
