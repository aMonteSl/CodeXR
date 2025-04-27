(function() {
  // Get VSCode API
  const vscode = acquireVsCodeApi();
  let functionData = null;
  let fileData = null;
  
  // DOM elements
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  
  // Listen for messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'setFunctionData':
        // Store data and render the UI
        functionData = message.data.function;
        fileData = {
          filePath: message.data.filePath,
          fileName: message.data.fileName,
          language: message.data.language
        };
        renderFunctionData();
        break;
    }
  });
  
  // Set up event listeners
  document.getElementById('back-link').addEventListener('click', () => {
    vscode.postMessage({
      command: 'backToFileAnalysis'
    });
  });
  
  document.getElementById('goto-link').addEventListener('click', () => {
    if (functionData && fileData) {
      vscode.postMessage({
        command: 'openFile',
        data: {
          path: fileData.filePath,
          line: functionData.lineStart
        }
      });
    }
  });
  
  function renderFunctionData() {
    if (!functionData || !fileData) return;
    
    // Hide loading, show results
    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    
    // Update page title and header
    document.title = `Function: ${functionData.name}`;
    document.getElementById('function-name').textContent = functionData.name;
    document.getElementById('function-location').textContent = 
      `${fileData.fileName} (${fileData.language}) - Lines ${functionData.lineStart}-${functionData.lineEnd}`;
    
    // Update metrics
    document.getElementById('line-count').textContent = functionData.lineCount;
    document.getElementById('params-count').textContent = functionData.parameters;
    document.getElementById('complexity').textContent = functionData.complexity;
    
    // Token count might not always be available
    const tokenCount = functionData.tokenCount || 'N/A';
    document.getElementById('token-count').textContent = tokenCount;
    
    // Max nesting depth might not always be available
    const nestingDepth = functionData.maxNestingDepth || 'N/A';
    document.getElementById('nesting-depth').textContent = nestingDepth;
    
    // Set complexity gauge
    const complexityGauge = document.getElementById('complexity-gauge-fill');
    const complexityValue = document.getElementById('complexity-value');
    const complexityCategory = document.getElementById('complexity-category');
    
    // Determine complexity category and percentage for gauge
    let category, percentage, categoryClass;
    
    if (functionData.complexity <= 5) {
      category = 'Simple';
      categoryClass = 'complexity-category-simple';
      percentage = (functionData.complexity / 5) * 25; // 0-25% of gauge
    } else if (functionData.complexity <= 10) {
      category = 'Moderate';
      categoryClass = 'complexity-category-moderate';
      percentage = 25 + ((functionData.complexity - 5) / 5) * 25; // 25-50% of gauge
    } else if (functionData.complexity <= 20) {
      category = 'Complex';
      categoryClass = 'complexity-category-complex';
      percentage = 50 + ((functionData.complexity - 10) / 10) * 25; // 50-75% of gauge
    } else {
      category = 'Very Complex';
      categoryClass = 'complexity-category-very-complex';
      // Cap at 100% but maintain proportion for very complex functions
      percentage = 75 + Math.min(((functionData.complexity - 20) / 20) * 25, 25); // 75-100% of gauge
    }
    
    // Update the gauge
    complexityGauge.style.width = `${percentage}%`;
    complexityValue.textContent = functionData.complexity;
    complexityValue.className = categoryClass;
    complexityCategory.textContent = category.toLowerCase();
    complexityCategory.className = categoryClass;
    
    // Show complexity details
    const complexityDetails = document.getElementById('complexity-details');
    complexityDetails.innerHTML = getComplexityExplanation(functionData.complexity, category);
    
    // Update file info
    document.getElementById('file-name').textContent = fileData.fileName;
    document.getElementById('start-line').textContent = functionData.lineStart;
    document.getElementById('end-line').textContent = functionData.lineEnd;
    document.getElementById('language').textContent = fileData.language;
    
    // Show recommendations based on complexity
    renderRecommendations(functionData.complexity, category);
  }
  
  function getComplexityExplanation(complexity, category) {
    switch(category) {
      case 'Simple':
        return `
          <p>This function has good complexity (CCN: ${complexity}). Simple functions are typically:</p>
          <ul>
            <li>Easy to understand and test</li>
            <li>Have few decision points (if, switch, loops, etc.)</li>
            <li>Less prone to bugs and easier to maintain</li>
          </ul>
        `;
      case 'Moderate':
        return `
          <p>This function has moderate complexity (CCN: ${complexity}). Consider:</p>
          <ul>
            <li>It's still within acceptable range but getting more complex</li>
            <li>May require more thorough tests to cover all paths</li>
            <li>Could potentially benefit from some refactoring</li>
          </ul>
        `;
      case 'Complex':
        return `
          <p>This function has high complexity (CCN: ${complexity}). This indicates:</p>
          <ul>
            <li>Many decision points and potential execution paths</li>
            <li>More difficult to understand, test and maintain</li>
            <li>Higher likelihood of containing bugs</li>
            <li>Should be considered for refactoring</li>
          </ul>
        `;
      case 'Very Complex':
        return `
          <p>This function has critically high complexity (CCN: ${complexity}). This indicates:</p>
          <ul>
            <li>Too many decision points and execution paths</li>
            <li>Very difficult to understand, test, and maintain</li>
            <li>High risk of containing bugs</li>
            <li>Strongly recommended for refactoring</li>
          </ul>
        `;
    }
  }
  
  function renderRecommendations(complexity, category) {
    const recommendationsSection = document.getElementById('recommendations-section');
    const recommendationsContainer = document.getElementById('recommendations');
    
    // Add class based on complexity category
    recommendationsContainer.className = `recommendations ${category.toLowerCase()}`;
    
    // Clear previous recommendations
    recommendationsContainer.innerHTML = '';
    
    // Generate recommendations based on complexity
    const recommendations = [];
    
    if (complexity > 5) {
      recommendations.push({
        title: 'Consider breaking down complex conditions',
        description: 'Extract complex conditional expressions into well-named functions or variables to improve readability.'
      });
    }
    
    if (complexity > 10) {
      recommendations.push({
        title: 'Extract helper functions',
        description: 'Identify sections of code that perform distinct operations and extract them into separate functions.'
      });
      
      recommendations.push({
        title: 'Apply early returns',
        description: 'Use early returns to handle special cases and reduce nesting depth.'
      });
    }
    
    if (complexity > 20) {
      recommendations.push({
        title: 'Refactor into multiple functions',
        description: 'This function is doing too much. Split it into smaller, more focused functions with single responsibilities.'
      });
      
      recommendations.push({
        title: 'Consider design patterns',
        description: 'Apply appropriate design patterns to handle complexity, such as Strategy pattern for multiple algorithms.'
      });
      
      recommendations.push({
        title: 'Prioritize for testing',
        description: 'Add this function to your high-priority testing queue as complex functions are more prone to bugs.'
      });
    }
    
    // If no specific recommendations, hide the section for simple functions
    if (recommendations.length === 0) {
      recommendations.push({
        title: 'Good job! This function is well-structured',
        description: 'Continue to maintain this level of simplicity in your code.'
      });
    }
    
    // Add recommendations to the DOM
    recommendations.forEach(rec => {
      const recElement = document.createElement('div');
      recElement.className = 'recommendation';
      
      const titleElement = document.createElement('div');
      titleElement.className = 'recommendation-title';
      titleElement.textContent = rec.title;
      
      const descElement = document.createElement('p');
      descElement.className = 'recommendation-description';
      descElement.textContent = rec.description;
      
      recElement.appendChild(titleElement);
      recElement.appendChild(descElement);
      recommendationsContainer.appendChild(recElement);
    });
  }
})();