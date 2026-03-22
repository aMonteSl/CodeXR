# GDScript fixture for CodeXR metrics
class_name MetricBox

func compute(values: Array, limit: int, offset: int) -> int:
    var total := 0
    for value in values:
        if value > limit:
            if value % 2 == 0:
                total += value + offset
            else:
                total += limit
    return total

func helper(value: int, seed: int) -> int:
    if value > seed:
        if seed > 0:
            return value + seed
    return value
