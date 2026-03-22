-- Lua fixture for CodeXR metrics
local MetricBox = {}
MetricBox.__index = MetricBox

function MetricBox:new(limit)
  return setmetatable({ limit = limit }, self)
end

function MetricBox:compute(values, offset)
  local total = 0
  for _, value in ipairs(values) do
    if value > self.limit then
      if value % 2 == 0 then
        total = total + value + offset
      else
        total = total + self.limit
      end
    end
  end
  return total
end

function MetricBox:helper(value, seed)
  if value > seed then
    if seed > 0 then
      return value + seed
    end
  end
  return value
end

return MetricBox
