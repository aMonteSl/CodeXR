// Kotlin fixture for CodeXR metrics
class MetricBox(private val limit: Int) {
    fun compute(values: List<Int>, offset: Int): Int {
        var total = 0
        for (value in values) {
            if (value > limit) {
                if (value % 2 == 0) {
                    total += value + offset
                } else {
                    total += limit
                }
            }
        }
        return total
    }

    fun helper(value: Int, offset: Int): Int {
        if (value > offset) {
            if (offset > 0) {
                return value + offset
            }
        }
        return value
    }
}
