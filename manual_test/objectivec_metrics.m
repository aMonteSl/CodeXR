// Objective-C fixture for CodeXR metrics
#import <Foundation/Foundation.h>

@interface MetricBox : NSObject
- (NSInteger)compute:(NSArray<NSNumber *> *)values limit:(NSInteger)limit;
- (NSInteger)helper:(NSInteger)value offset:(NSInteger)offset;
@end

@implementation MetricBox
- (NSInteger)compute:(NSArray<NSNumber *> *)values limit:(NSInteger)limit {
    NSInteger total = 0;
    for (NSNumber *value in values) {
        if (value.integerValue > limit) {
            if (value.integerValue % 2 == 0) {
                total += value.integerValue;
            } else {
                total += limit;
            }
        }
    }
    return total;
}

- (NSInteger)helper:(NSInteger)value offset:(NSInteger)offset {
    if (value > offset) {
        if (offset > 0) {
            return value + offset;
        }
    }
    return value;
}
@end
