(function() {
  // Get DOM elements
  const noDataEl = document.getElementById('no-data');
  const resultsEl = document.getElementById('results');
  const filesSectionEl = document.getElementById('files-section');
  const filesListEl = document.getElementById('files-list');
  
  // Get metric elements
  const totalLinesEl = document.getElementById('total-lines');
  const codeLinesEl = document.getElementById('code-lines');
  const commentLinesEl = document.getElementById('comment-lines');
  const blankLinesEl = document.getElementById('blank-lines');
  const functionCountEl = document.getElementById('function-count');
  const classCountEl = document.getElementById('class-count');
  
  // Get chart elements
  const pieEl = document.querySelector('.pie');
  
  // VS Code API
  const vscode = acquireVsCodeApi();
  
  // Handle messages from extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'showFileAnalysis':
        showFileAnalysis(message.analysis);
        break;
      case 'showProjectAnalysis':
        showProjectAnalysis(message.analysis);
        break;
    }
  });
  
  /**
   * Display results for a single file analysis
   */
  function showFileAnalysis(analysis) {
    // Hide loading, show results
    noDataEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    filesSectionEl.classList.add('hidden');
    
    // Update metrics display
    updateMetrics(analysis.metrics);
    
    // Update subtitle
    document.querySelector('.subtitle').textContent = `Analysis of ${analysis.fileName}`;
    
    // Update pie chart
    updatePieChart(analysis.metrics);
  }
  
  /**
   * Display results for a project analysis
   */
  function showProjectAnalysis(analysis) {
    // Hide loading, show results
    noDataEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    filesSectionEl.classList.remove('hidden');
    
    // Update metrics with summary
    updateMetrics(analysis.summary);
    
    // Update subtitle
    document.querySelector('.subtitle').textContent = 
      `Analysis of ${analysis.files.length} files (${new Date(analysis.analyzedAt).toLocaleString()})`;
    
    // Update pie chart
    updatePieChart(analysis.summary);
    
    // Generate file list
    generateFilesList(analysis.files);
  }
  
  /**
   * Update the metrics display
   */
  function updateMetrics(metrics) {
    totalLinesEl.textContent = metrics.totalLines;
    codeLinesEl.textContent = metrics.codeLines;
    commentLinesEl.textContent = metrics.commentLines;
    blankLinesEl.textContent = metrics.blankLines;
    functionCountEl.textContent = metrics.functionCount;
    classCountEl.textContent = metrics.classCount;
  }
  
  /**
   * Update the pie chart visualization
   */
  function updatePieChart(metrics) {
    if (!pieEl) return;
    
    const codePercent = (metrics.codeLines / metrics.totalLines) * 100;
    const commentPercent = (metrics.commentLines / metrics.totalLines) * 100;
    const blankPercent = (metrics.blankLines / metrics.totalLines) * 100;
    
    // Set CSS variables for the pie chart
    document.documentElement.style.setProperty('--code-percent', `${codePercent}%`);
    document.documentElement.style.setProperty('--comment-percent', `${commentPercent}%`);
    
    // Update the center text
    const pieCenter = document.querySelector('.pie-center');
    if (pieCenter) {
      pieCenter.textContent = `${metrics.totalLines} Lines`;
    }
    
    // Update legend percentages
    const codeLegend = document.querySelector('.legend-item.code .legend-percent');
    const commentsLegend = document.querySelector('.legend-item.comments .legend-percent');
    const blankLegend = document.querySelector('.legend-item.blank .legend-percent');
    
    if (codeLegend) codeLegend.textContent = `${Math.round(codePercent)}% (${metrics.codeLines})`;
    if (commentsLegend) commentsLegend.textContent = `${Math.round(commentPercent)}% (${metrics.commentLines})`;
    if (blankLegend) blankLegend.textContent = `${Math.round(blankPercent)}% (${metrics.blankLines})`;
  }
  
  /**
   * Generate the files list for project analysis
   */
  function generateFilesList(files) {
    // Clear previous list
    filesListEl.innerHTML = '';
    
    // Sort files by code lines (descending)
    const sortedFiles = [...files].sort((a, b) => b.metrics.codeLines - a.metrics.codeLines);
    
    // Generate items for each file
    for (const file of sortedFiles) {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.dataset.path = file.filePath;
      
      // Add click handler to open file
      fileItem.addEventListener('click', () => {
        vscode.postMessage({
          command: 'showDetails',
          filePath: file.filePath
        });
      });
      
      // File name element
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = file.fileName;
      
      // File metrics container
      const fileMetrics = document.createElement('div');
      fileMetrics.className = 'file-metrics';
      
      // Lines metric
      const linesMetric = document.createElement('div');
      linesMetric.className = 'file-metric';
      linesMetric.textContent = `${file.metrics.totalLines} lines`;
      
      // Functions metric
      const functionsMetric = document.createElement('div');
      functionsMetric.className = 'file-metric';
      functionsMetric.textContent = `${file.metrics.functionCount} funcs`;
      
      // Add elements to container
      fileMetrics.appendChild(linesMetric);
      fileMetrics.appendChild(functionsMetric);
      
      // Add to file item
      fileItem.appendChild(fileName);
      fileItem.appendChild(fileMetrics);
      
      // Add to list
      filesListEl.appendChild(fileItem);
    }
  }
})();