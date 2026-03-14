// Zig fixture for CodeXR metrics
const std = @import("std");

pub fn compute(values: []const i32, limit: i32) i32 {
    var total: i32 = 0;
    for (values) |value| {
        if (value > limit) {
            if (@mod(value, 2) == 0) {
                total += value;
            } else {
                total += limit;
            }
        }
    }
    return total;
}

pub fn helper(value: i32, offset: i32) i32 {
    if (value > offset) {
        if (offset > 0) {
            return value + offset;
        }
    }
    return value;
}
