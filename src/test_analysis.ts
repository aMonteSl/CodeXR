/**
 * Quick test file to verify CodeXR analysis commands
 * This file should be analyzable by the extension
 */

function testFunction() {
    console.log("This is a test function");
    
    // Some complexity
    if (Math.random() > 0.5) {
        for (let i = 0; i < 10; i++) {
            console.log(`Iteration ${i}`);
        }
    } else {
        console.log("Random was too low");
    }
}

class TestClass {
    private value: number;
    
    constructor(value: number) {
        this.value = value;
    }
    
    getValue(): number {
        return this.value;
    }
    
    setValue(newValue: number): void {
        this.value = newValue;
    }
}

// Export for testing
export { testFunction, TestClass };
