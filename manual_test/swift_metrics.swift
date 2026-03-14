// Swift fixture for CodeXR metrics
struct MetricBox {
    func compute(values: [Int], limit: Int) -> Int {
        var total = 0
        for value in values {
            if value > limit {
                if value % 2 == 0 {
                    total += value
                } else {
                    total += limit
                }
            }
        }
        return total
    }

    func helper(value: Int, offset: Int) -> Int {
        if value > offset {
            if offset > 0 {
                return value + offset
            }
        }
        return value
    }
}
