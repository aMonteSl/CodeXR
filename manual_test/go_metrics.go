// Go fixture for CodeXR metrics
package manualtest

type MetricBox struct {
	Limit int
}

func Compute(values []int, limit int) int {
	total := 0
	for _, value := range values {
		if value > limit {
			if value%2 == 0 {
				total += value
			} else {
				total += limit
			}
		}
	}
	return total
}

func Helper(value int, offset int) int {
	if value > offset {
		if offset > 0 {
			return value + offset
		}
	}
	return value
}
