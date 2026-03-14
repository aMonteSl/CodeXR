// C# fixture for CodeXR metrics
public class MetricBox
{
    public int Compute(int[] values, int limit)
    {
        var total = 0;
        foreach (var value in values)
        {
            if (value > limit)
            {
                if (value % 2 == 0)
                {
                    total += value;
                }
                else
                {
                    total += limit;
                }
            }
        }
        return total;
    }

    public int Helper(int value, int offset)
    {
        if (value > offset)
        {
            if (offset > 0)
            {
                return value + offset;
            }
        }
        return value;
    }
}
