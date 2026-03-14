# Ruby fixture for CodeXR metrics
class MetricBox
  def initialize(limit, factor)
    @limit = limit
    @factor = factor
  end

  def compute(values, offset = 0)
    total = 0
    values.each do |value|
      if value > @limit
        if value.even?
          total += value + offset
        else
          total += value * @factor
        end
      end
    end
    total
  end

  def helper(value, seed)
    if value > seed
      if seed.positive?
        return value + seed
      end
    end
    value
  end
end
