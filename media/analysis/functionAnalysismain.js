(function() {
  // Get VSCode API
  const vscode = acquireVsCodeApi();
  let functionData = null;
  
  // DOM elements
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  
  // Listen for messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'setFunctionData':
        // Store data and render the UI
        functionData = message.data;
        console.log('📨 Received function data:', functionData);
        renderFunctionData();
        break;
    }
  });
  
  function renderFunctionData() {
    if (!functionData) {
      console.warn('No function data available');
      return;
    }
    
    console.log('🎨 Rendering function data for:', functionData.function.name);
    
    // Update page title and navigation
    document.getElementById('function-name').textContent = `Function: ${functionData.function.name}`;
    document.getElementById('function-location').textContent = 
      `${functionData.fileName} (${functionData.language}) - Lines ${functionData.function.lineStart}-${functionData.function.lineEnd}`;
    
    // Set up navigation links
    const backLink = document.getElementById('back-link');
    if (backLink) {
      backLink.addEventListener('click', () => {
        vscode.postMessage({
          command: 'backToFileAnalysis',
          data: { filePath: functionData.filePath }
        });
      });
    }
    
    const gotoLink = document.getElementById('goto-link');
    if (gotoLink) {
      gotoLink.addEventListener('click', () => {
        vscode.postMessage({
          command: 'openInEditor',
          data: { 
            filePath: functionData.filePath,
            lineNumber: functionData.function.lineStart
          }
        });
      });
    }
    
    // Hide loading and show results
    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    
    // Update function overview metrics
    document.getElementById('line-count').textContent = functionData.function.lineCount || '-';
    document.getElementById('params-count').textContent = functionData.function.parameters || '-';
    document.getElementById('complexity').textContent = functionData.function.complexity || '-';
    document.getElementById('token-count').textContent = functionData.function.tokenCount || '-';
    document.getElementById('nesting-depth').textContent = functionData.function.maxNestingDepth || '-';
    
    // Update complexity analysis
    const complexity = functionData.function.complexity || 0;
    document.getElementById('complexity-value').textContent = complexity;
    document.getElementById('complexity-category').textContent = functionData.complexityCategory || 'Unknown';
    
    // Update complexity gauge
    updateComplexityGauge(complexity);
    
    // Update complexity details
    const complexityText = document.getElementById('complexity-text');
    if (complexityText) {
      complexityText.innerHTML = `This function has <span id="complexity-value">${complexity}</span> cyclomatic complexity, which is considered <span id="complexity-category">${functionData.complexityCategory}</span>.`;
    }
    
    // Update location details
    document.getElementById('file-name').textContent = functionData.fileName || '-';
    document.getElementById('start-line').textContent = functionData.function.lineStart || '-';
    document.getElementById('end-line').textContent = functionData.function.lineEnd || '-';
    document.getElementById('language').textContent = functionData.language || '-';
    
    // Update recommendations
    updateRecommendations(functionData.recommendations || []);
    
    console.log('✅ Function data rendered successfully');
  }
  
  function updateComplexityGauge(complexity) {
    const gaugeFill = document.getElementById('complexity-gauge-fill');
    if (!gaugeFill) return;
    
    // Calculate percentage (max out at 30 for visual purposes)
    const maxComplexity = 30;
    const percentage = Math.min((complexity / maxComplexity) * 100, 100);
    
    // Set width
    gaugeFill.style.width = `${percentage}%`;
    
    // Set color based on complexity
    let color;
    if (complexity <= 5) {
      color = '#4caf50'; // Green
    } else if (complexity <= 10) {
      color = '#ff9800'; // Orange
    } else if (complexity <= 20) {
      color = '#f44336'; // Red
    } else {
      color = '#9c27b0'; // Purple
    }
    
    gaugeFill.style.backgroundColor = color;
  }
  
  function updateRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('recommendations');
    if (!recommendationsContainer) return;
    
    recommendationsContainer.innerHTML = '';
    
    if (recommendations.length === 0) {
      recommendationsContainer.innerHTML = '<p>No specific recommendations available.</p>';
      return;
    }
    
    const list = document.createElement('ul');
    recommendations.forEach(rec => {
      const listItem = document.createElement('li');
      listItem.textContent = rec;
      list.appendChild(listItem);
    });
    
    recommendationsContainer.appendChild(list);
  }
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Function analysis page loaded');
    
    // If we already have data, render it
    if (functionData) {
      renderFunctionData();
    }
  });
})();