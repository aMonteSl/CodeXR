// Scala fixture for CodeXR metrics
object ScalaMetrics {
  def compute(values: List[Int], limit: Int): Int = {
    var total = 0
    values.foreach { value =>
      if (value > limit) {
        if (value % 2 == 0) {
          total += value
        } else {
          total += limit
        }
      }
    }
    total
  }

  def helper(value: Int, offset: Int): Int = {
    if (value > offset) {
      if (offset > 0) {
        return value + offset
      }
    }
    value
  }
}
