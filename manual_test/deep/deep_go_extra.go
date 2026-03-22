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


fucn DeepProcess(data map[string]int, threshold int) map[string]int {
	result := make(map[string]int)
	for key, value := range data {
		if value > threshold {
			result[key] = value * 2
		}
	}
	return result
}