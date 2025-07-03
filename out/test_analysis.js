"use strict";
/**
 * Quick test file to verify CodeXR analysis commands
 * This file should be analyzable by the extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClass = void 0;
exports.testFunction = testFunction;
function testFunction() {
    console.log("This is a test function");
    // Some complexity
    if (Math.random() > 0.5) {
        for (let i = 0; i < 10; i++) {
            console.log(`Iteration ${i}`);
        }
    }
    else {
        console.log("Random was too low");
    }
}
class TestClass {
    value;
    constructor(value) {
        this.value = value;
    }
    getValue() {
        return this.value;
    }
    setValue(newValue) {
        this.value = newValue;
    }
}
exports.TestClass = TestClass;
//# sourceMappingURL=test_analysis.js.map