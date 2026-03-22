# Deep Python fixture

def deep_compute(values, limit, offset):
    total = 0
    for value in values:
        if value > limit:
            if offset > 0:
                total += value + offset
    return total
