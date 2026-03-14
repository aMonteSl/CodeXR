// Solidity fixture for CodeXR metrics
pragma solidity ^0.8.0;

contract MetricBox {
    function compute(uint256[] memory values, uint256 limit) public pure returns (uint256) {
        uint256 total = 0;
        for (uint256 index = 0; index < values.length; index++) {
            if (values[index] > limit) {
                if (values[index] % 2 == 0) {
                    total += values[index];
                } else {
                    total += limit;
                }
            }
        }
        return total;
    }

    function helper(uint256 value, uint256 offset) public pure returns (uint256) {
        if (value > offset) {
            if (offset > 0) {
                return value + offset;
            }
        }
        return value;
    }
}
