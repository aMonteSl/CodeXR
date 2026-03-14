// Deep Go fixture
package deepmanual

func DeepCompute(values []int, limit int, offset int) int {
	total := 0
	for _, value := range values {
		if value > limit {
			if offset > 0 {
				total += value + offset
			}
		}
	}

	return total
}
