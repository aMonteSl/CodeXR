(function() {
  // Get VSCode API
  const vscode = acquireVsCodeApi();
  let analysisData = null;
  
  // DOM elements
  const noDataEl = document.getElementById('no-data');
  const resultsEl = document.getElementById('results');
  
  // Listen for messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'setAnalysisData':
        // Store data and render the UI
        analysisData = message.data;
        renderAnalysisData();
        break;
    }
  });
  
  function renderAnalysisData() {
    if (!analysisData) return;
    
    // Update page title and hide the no-data message
    document.querySelector('.subtitle').textContent = 
      `${analysisData.fileName} (${analysisData.language}) - Analyzed on ${analysisData.timestamp}`;
    
    noDataEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    
    // Update basic metrics
    document.getElementById('total-lines').textContent = analysisData.totalLines;
    document.getElementById('code-lines').textContent = analysisData.codeLines;
    document.getElementById('comment-lines').textContent = analysisData.commentLines;
    document.getElementById('blank-lines').textContent = analysisData.blankLines;
    document.getElementById('function-count').textContent = analysisData.functionCount;
    document.getElementById('class-count').textContent = analysisData.classCount;
    
    // Update complexity metrics
    const avgComplexityEls = document.querySelectorAll('#avg-complexity');
    avgComplexityEls.forEach(el => el.textContent = analysisData.avgComplexity);
    
    const maxComplexityEls = document.querySelectorAll('#max-complexity');
    maxComplexityEls.forEach(el => el.textContent = analysisData.maxComplexity);
    
    const highComplexityEls = document.querySelectorAll('#high-complexity-count');
    highComplexityEls.forEach(el => el.textContent = analysisData.highComplexityCount);
    
    // Update highest/lowest complexity functions
    document.getElementById('highest-ccn-function').textContent = analysisData.highestComplexityFunction.name;
    document.getElementById('highest-ccn-value').textContent = `CCN: ${analysisData.highestComplexityFunction.value}`;
    
    document.getElementById('lowest-ccn-function').textContent = analysisData.lowestComplexityFunction.name;
    document.getElementById('lowest-ccn-value').textContent = `CCN: ${analysisData.lowestComplexityFunction.value}`;
    
    // Update distribution counts
    document.getElementById('simple-count').textContent = analysisData.complexityDistribution.simple;
    document.getElementById('moderate-count').textContent = analysisData.complexityDistribution.moderate;
    document.getElementById('complex-count').textContent = analysisData.complexityDistribution.complex;
    document.getElementById('very-complex-count').textContent = analysisData.complexityDistribution.veryComplex;
    
    // High complexity warning
    const warningText = analysisData.highComplexityCount > 0 
      ? `${analysisData.highComplexityCount} function(s) need attention` 
      : 'No high complexity functions';
    document.getElementById('high-complexity-warning').textContent = warningText;
    
    // Render function table
    renderFunctionTable();
  }
  
  function renderFunctionTable() {
    const tbody = document.getElementById('functions-body');
    tbody.innerHTML = '';
    
    if (!analysisData.functions || analysisData.functions.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.setAttribute('colspan', '6');
      cell.textContent = 'No functions found in this file';
      cell.classList.add('loading-message');
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }
    
    // Sort functions by complexity (highest first)
    const sortedFunctions = [...analysisData.functions].sort((a, b) => b.complexity - a.complexity);
    
    sortedFunctions.forEach(func => {
      const row = document.createElement('tr');
      
      // Function name
      const nameCell = document.createElement('td');
      const nameLink = document.createElement('span');
      nameLink.classList.add('function-link');
      nameLink.textContent = func.name;
      nameLink.addEventListener('click', () => {
        vscode.postMessage({
          command: 'showFunctionDetails',
          data: {
            function: func,
            filePath: analysisData.filePath,
            fileName: analysisData.fileName,
            language: analysisData.language
          }
        });
      });
      nameCell.appendChild(nameLink);
      row.appendChild(nameCell);
      
      // Start line
      const startLineCell = document.createElement('td');
      startLineCell.textContent = func.lineStart;
      row.appendChild(startLineCell);
      
      // End line
      const endLineCell = document.createElement('td');
      endLineCell.textContent = func.lineEnd;
      row.appendChild(endLineCell);
      
      // Length
      const lengthCell = document.createElement('td');
      lengthCell.textContent = func.lineCount;
      row.appendChild(lengthCell);
      
      // Parameters
      const paramsCell = document.createElement('td');
      paramsCell.textContent = func.parameters;
      row.appendChild(paramsCell);
      
      // Complexity with badge and color coding
      const complexityCell = document.createElement('td');
      
      // Create complexity badge
      const complexityBadge = document.createElement('span');
      complexityBadge.classList.add('complexity-badge');
      
      // Add appropriate class based on complexity
      const complexityClass = getComplexityClass(func.complexity);
      complexityBadge.classList.add(complexityClass);
      
      // Set text content
      complexityBadge.textContent = func.complexity;
      complexityCell.appendChild(complexityBadge);
      
      row.appendChild(complexityCell);
      
      tbody.appendChild(row);
    });
  }
  
  // Helper function to determine complexity class
  function getComplexityClass(complexity) {
    if (complexity <= 5) return 'complexity-low';
    if (complexity <= 10) return 'complexity-medium';
    if (complexity <= 20) return 'complexity-high';
    return 'complexity-critical';
  }
})();