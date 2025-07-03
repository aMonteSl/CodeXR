/**
 * Simple test file for static analysis verification
 */

class TestClass {
  private name: string;
  private age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  // Simple function with low complexity
  getName(): string {
    return this.name;
  }

  // Function with moderate complexity
  getAgeCategory(includeDetails: boolean = false): string {
    if (this.age < 18) {
      if (includeDetails) {
        return `Minor: ${this.age} years old`;
      }
      return "Minor";
    } else if (this.age < 65) {
      if (includeDetails) {
        return `Adult: ${this.age} years old`;
      }
      return "Adult";
    } else {
      if (includeDetails) {
        return `Senior: ${this.age} years old`;
      }
      return "Senior";
    }
  }

  // Function with higher complexity
  calculateRisk(healthScore: number, lifestyle: string, hasInsurance: boolean): string {
    let risk = 0;
    
    if (this.age > 65) {
      risk += 3;
    } else if (this.age > 45) {
      risk += 2;
    } else if (this.age > 25) {
      risk += 1;
    }
    
    if (healthScore < 50) {
      risk += 3;
    } else if (healthScore < 75) {
      risk += 1;
    }
    
    switch (lifestyle) {
      case 'sedentary':
        risk += 2;
        break;
      case 'active':
        risk -= 1;
        break;
      case 'athletic':
        risk -= 2;
        break;
    }
    
    if (!hasInsurance) {
      risk += 1;
    }
    
    if (risk <= 2) {
      return 'Low';
    } else if (risk <= 5) {
      return 'Medium';
    } else {
      return 'High';
    }
  }
}

// Standalone function
function processData(data: any[], threshold: number): any[] {
  return data.filter(item => item.value > threshold)
            .map(item => ({ ...item, processed: true }))
            .sort((a, b) => b.value - a.value);
}

export { TestClass, processData };
