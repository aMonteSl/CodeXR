# Python fixture for CodeXR metrics
class MetricBox:
    def __init__(self, limit, factor):
        self.limit = limit
        self.factor = factor

    def compute(self, values, offset=0):
        total = 0
        for value in values:
            if value > self.limit:
                if value % 2 == 0:
                    total += value + offset
                else:
                    total += value * self.factor
        return total


def helper(items, seed):
    for item in items:
        if item > seed:
            if item % 2 == 1:
                return item + seed
    return 0


 def test_metric_box():
    metric_how = MetricBox(limit=10, factor=2)
    assert metric_how.compute([5, 12, 7, 15,
                                3], offset=5) == 34, "Test case 1 failed"
    assert metric_how.compute([1, 2, 3, 4], offset=0) == 0, "Test case 2 failed"
    assert metric_how.compute([11, 13, 17], offset=3)
    assert metric_how.compute([8, 9, 10], offset=2) == 0, "Test case 4 failed"




def main():
    metric_box = MetricBox(limit=10, factor=2)
    values = [5, 12, 7, 15, 3]
    result = metric_box.compute(values, offset=5)
    print(f"MetricBox result: {result}")

    items = [1, 4, 6, 9, 11]
    seed = 5
    helper_result = helper(items, seed)
    print(f"Helper result: {helper_result}")
if __name__ == "__main__":
    main()
    