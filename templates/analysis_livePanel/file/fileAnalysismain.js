/**
 * Modern Static Analysis Viewer JavaScript
 * Loads data.json and renders interactive analysis dashboard
 */

(function() {
  'use strict';
  
  // Global state
  let analysisData = null;
  let complexityChart = null;
  let currentTheme = 'light';
  
  // DOM elements cache
  const elements = {
    noData: null,
    results: null,
    subtitle: null,
    themeIcon: null
  };
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('ANALYSIS_VIEWER: Initializing static analysis viewer...');
    
    // Cache DOM elements
    cacheElements();
    
    // Initialize theme
    initializeTheme();
    
    // Initialize SSE for live updates
    initializeSSE();
    
    // Try to load analysis data
    loadAnalysisData();
  });
  
  /**
   * Initialize theme from window.initialTheme or localStorage
   */
  function initializeTheme() {
    // Try to get theme from injected window data first
    if (window.initialTheme) {
      currentTheme = window.initialTheme;
      console.log('ANALYSIS_VIEWER: Using injected theme:', currentTheme);
    } else {
      // Fallback to localStorage
      currentTheme = localStorage.getItem('analysisViewerTheme') || 'light';
      console.log('ANALYSIS_VIEWER: Using localStorage theme:', currentTheme);
    }
    
    // Apply the theme
    applyTheme(currentTheme);
  }
  
  /**
   * Apply theme to the document
   */
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    currentTheme = theme;
    
    // Update theme icon
    if (elements.themeIcon) {
      elements.themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
    
    console.log('ANALYSIS_VIEWER: Theme applied:', theme);
  }
  
  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    
    // Save to localStorage for persistence within static mode
    localStorage.setItem('analysisViewerTheme', newTheme);
    
    // Try to send update back to VS Code extension if available
    // This would require additional implementation for live sync
    if (window.vscode && window.vscode.postMessage) {
      window.vscode.postMessage({
        command: 'updateTheme',
        theme: newTheme
      });
    }
    
    console.log('ANALYSIS_VIEWER: Theme toggled to:', newTheme);
  }
  
  // Make toggleTheme available globally for onclick handler
  window.toggleTheme = toggleTheme;
  
  /**
   * Cache frequently used DOM elements
   */
  function cacheElements() {
    elements.noData = document.getElementById('no-data');
    elements.results = document.getElementById('results');
    elements.subtitle = document.querySelector('.subtitle');
    elements.themeIcon = document.getElementById('theme-icon');
  }
  
  function normalizeFunctionEntry(entry) {
    const lineStart = entry.lineStart || entry.startLine || 0;
    const lineEnd = entry.lineEnd || entry.endLine || lineStart;
    const lineCount = entry.lineCount || entry.length || Math.max((lineEnd - lineStart) + 1, 0);
    return {
      name: entry.functionName || entry.name || 'Unknown',
      functionName: entry.functionName || entry.name || 'Unknown',
      lineStart,
      lineEnd,
      lineCount,
      spanLines: entry.spanLines || Math.max((lineEnd - lineStart) + 1, 0),
      parameters: entry.parameters || entry.parameterCount || 0,
      maxNestingDepth: entry.maxNestingDepth || 0,
      complexity: entry.complexity || 0,
      complexityBand: entry.complexityBand || 'normal',
      cyclomaticDensity: entry.cyclomaticDensity || 0,
      treePath: entry.treePath || '',
    };
  }

  function normalizeIncomingAnalysisData(data) {
    if (Array.isArray(data)) {
      const functions = data.map(normalizeFunctionEntry);
      const first = data[0] || {};
      const computedAverageComplexity = functions.length > 0
        ? functions.reduce((sum, func) => sum + (func.complexity || 0), 0) / functions.length
        : 0;
      const computedMaxComplexity = functions.length > 0
        ? Math.max(...functions.map((func) => func.complexity || 0))
        : 0;
      const computedAverageParameters = functions.length > 0
        ? functions.reduce((sum, func) => sum + (func.parameters || 0), 0) / functions.length
        : 0;
      const computedAverageNestingDepth = functions.length > 0
        ? functions.reduce((sum, func) => sum + (func.maxNestingDepth || 0), 0) / functions.length
        : 0;
      const computedMaxNestingDepth = functions.length > 0
        ? Math.max(...functions.map((func) => func.maxNestingDepth || 0))
        : 0;

      return {
        fileName: first.fileName || 'Unknown File',
        filePath: first.filePath || '',
        language: first.language || 'Unknown',
        timestamp: first.timestamp || 'Unknown Time',
        totalLines: first.totalLines || 0,
        codeLines: first.codeLines || 0,
        commentLines: first.commentLines || 0,
        blankLines: first.blankLines || 0,
        commentRatio: typeof first.commentRatio === 'number' ? first.commentRatio : 0,
        codeRatio: typeof first.codeRatio === 'number' ? first.codeRatio : 0,
        blankRatio: typeof first.blankRatio === 'number' ? first.blankRatio : 0,
        functionCount: first.functionCount || functions.length,
        classCount: first.classCount || 0,
        fileSizeBytes: first.fileSizeBytes || 0,
        averageFunctionParameters: typeof first.averageFunctionParameters === 'number' ? first.averageFunctionParameters : computedAverageParameters,
        maxFunctionParameters: first.maxFunctionParameters || Math.max(...functions.map((func) => func.parameters || 0), 0),
        averageFunctionNestingDepth: typeof first.averageFunctionNestingDepth === 'number' ? first.averageFunctionNestingDepth : computedAverageNestingDepth,
        maxFunctionNestingDepth: first.maxFunctionNestingDepth || computedMaxNestingDepth,
        cyclomaticComplexityDensity: typeof first.cyclomaticComplexityDensity === 'number' ? first.cyclomaticComplexityDensity : 0,
        complexity: {
          averageComplexity: Number.isFinite(first.cyclomaticComplexityNumber) ? first.cyclomaticComplexityNumber : computedAverageComplexity,
          maxComplexity: first.maxComplexity || computedMaxComplexity,
          highComplexityFunctions: first.highComplexityFunctions || functions.filter((func) => (func.complexity || 0) > 10).length,
          criticalComplexityFunctions: first.criticalComplexityFunctions || functions.filter((func) => (func.complexity || 0) > 25).length,
        },
        functions
      };
    }

    if (data && Array.isArray(data.functions)) {
      return data;
    }

    return data;
  }

  function loadAnalysisData() {
    // First try: Use injected window.analysisData (preferred for static mode)
    if (window.analysisData) {
      console.log('ANALYSIS_VIEWER: Using injected analysis data');
      analysisData = normalizeIncomingAnalysisData(window.analysisData);
      renderAnalysisData();
      return;
    }
    
    // Second try: Load from data.json file
    console.log('ANALYSIS_VIEWER: Loading data from data.json...');
    fetch('./data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('ANALYSIS_VIEWER: Successfully loaded data.json', data);
        analysisData = normalizeIncomingAnalysisData(data);
        renderAnalysisData();
      })
      .catch(error => {
        console.error('ANALYSIS_VIEWER: Failed to load data.json:', error);
        showError('Failed to load analysis data: ' + error.message);
      });
  }
  
  /**
   * Show error message to user
   */
  function showError(message) {
    console.error('ANALYSIS_VIEWER:', message);
    
    if (elements.noData) {
      elements.noData.innerHTML = `<p>Error: ${message}</p>`;
      elements.noData.style.display = 'block';
      elements.noData.classList.remove('hidden');
    }
    
    if (elements.results) {
      elements.results.style.display = 'none';
      elements.results.classList.add('hidden');
    }
  }

  /**
   * Initialize Server-Sent Events for live updates
   */
  function initializeSSE() {
    console.log('ANALYSIS_VIEWER: Initializing SSE for live updates...');
    
    try {
      // Connect to the /events endpoint on the current server
      const eventSource = new EventSource('/events');
      
      eventSource.onopen = function(event) {
        console.log('ANALYSIS_VIEWER: SSE connection opened');
        showSSEStatus('connected');
      };
      
      eventSource.onmessage = function(event) {
        try {
          console.log('ANALYSIS_VIEWER: Raw SSE event.data:', event.data);
          const data = JSON.parse(event.data);
          console.log('ANALYSIS_VIEWER: Parsed SSE data:', data);
          console.log('ANALYSIS_VIEWER: Data type:', typeof data, 'data.type:', data.type);
          
          handleSSEMessage(data);
        } catch (error) {
          console.error('ANALYSIS_VIEWER: Error parsing SSE message:', error);
          console.error('ANALYSIS_VIEWER: Raw event.data was:', event.data);
        }
      };
      
      eventSource.onerror = function(event) {
        console.error('ANALYSIS_VIEWER: SSE connection error:', event);
        showSSEStatus('error');
        
        // Note: EventSource will automatically try to reconnect
      };
      
      // Store reference for potential cleanup
      window.analysisSSE = eventSource;
      
    } catch (error) {
      console.error('ANALYSIS_VIEWER: Failed to initialize SSE:', error);
      showSSEStatus('error');
    }
  }

  /**
   * Handle incoming SSE messages
   */
  function handleSSEMessage(data) {
    console.log('ANALYSIS_VIEWER: Handling SSE message, data.type:', data.type);
    console.log('ANALYSIS_VIEWER: Full data object:', data);
    
    // Check if we have nested data (EnhancedSSEManager format)
    const messageType = data.type || (data.data && data.data.type);
    console.log('ANALYSIS_VIEWER: Determined message type:', messageType);
    
    switch (messageType) {
      case 'connected':
        console.log('ANALYSIS_VIEWER: SSE connected for file:', data.fileUri || data.data?.fileUri);
        showSSEStatus('connected');
        break;
        
      case 'analysis-updated':
        console.log('ANALYSIS_VIEWER: Analysis updated for file:', data.fileUri || data.data?.fileUri);
        console.log('ANALYSIS_VIEWER: Triggering data reload...');
        showUpdateNotification();
        reloadAnalysisData();
        break;
        
      case 'heartbeat':
        console.log('ANALYSIS_VIEWER: Heartbeat received');
        // Keep-alive message, no action needed
        break;
        
      default:
        console.log('ANALYSIS_VIEWER: Unknown SSE message type:', messageType);
        console.log('ANALYSIS_VIEWER: Full data:', data);
    }
  }

  /**
   * Reload analysis data after SSE update notification
   */
  function reloadAnalysisData() {
    console.log('ANALYSIS_VIEWER: Reloading analysis data due to SSE update...');
    
    // Add cache busting to ensure fresh data
    fetch('./data.json?t=' + Date.now())
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('ANALYSIS_VIEWER: Successfully reloaded data.json via SSE');
        analysisData = normalizeIncomingAnalysisData(data);
        renderAnalysisData();
        showReloadNotification();
      })
      .catch(error => {
        console.error('ANALYSIS_VIEWER: Failed to reload data.json:', error);
        showError('Failed to reload analysis data: ' + error.message);
      });
  }

  /**
   * Show SSE connection status
   */
  function showSSEStatus(status) {
    // Create or update status indicator
    let statusElement = document.getElementById('sse-status');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'sse-status';
      statusElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        transition: all 0.3s ease;
        font-family: inherit;
      `;
      document.body.appendChild(statusElement);
    }
    
    switch (status) {
      case 'connected':
        statusElement.textContent = '🟢 Live Updates';
        statusElement.style.backgroundColor = '#10b981';
        statusElement.style.color = 'white';
        break;
      case 'error':
        statusElement.textContent = '🔴 Disconnected';
        statusElement.style.backgroundColor = '#ef4444';
        statusElement.style.color = 'white';
        break;
    }
  }

  /**
   * Show update notification
   */
  function showUpdateNotification() {
    showNotification('Analysis updated! Refreshing data...', '#3b82f6', 3000);
  }

  /**
   * Show reload completion notification
   */
  function showReloadNotification() {
    showNotification('Data refreshed successfully!', '#10b981', 2000);
  }

  /**
   * Show a temporary notification
   */
  function showNotification(message, backgroundColor = '#3b82f6', duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      background: ${backgroundColor};
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1001;
      font-family: inherit;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after specified duration
    setTimeout(() => {
      notification.remove();
    }, duration);
  }

  // Add CSS for animations if not already present
  if (!document.getElementById('sse-animations')) {
    const style = document.createElement('style');
    style.id = 'sse-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Main rendering function
   */
  function renderAnalysisData() {
    if (!analysisData) {
      showError('No analysis data available');
      return;
    }
    
    console.log('ANALYSIS_VIEWER: Rendering analysis data...');
    
    try {
      // Update page header
      updateHeader();
      
      // Show results, hide no-data message
      showResults();
      
      // Render all sections
      renderBasicMetrics();
      renderComplexityMetrics();
      renderComplexitySummary();
      renderFunctionsTable();
      renderDistributionMetrics();
      renderComplexityChart();
      renderDensityVisualization();
      
      console.log('ANALYSIS_VIEWER: Analysis data rendered successfully');
      
    } catch (error) {
      console.error('ANALYSIS_VIEWER: Error rendering analysis:', error);
      showError('Error rendering analysis: ' + error.message);
    }
  }
  
  /**
   * Update page header with file information
   */
  function updateHeader() {
    if (elements.subtitle && analysisData.fileName) {
      const fileName = analysisData.fileName || 'Unknown File';
      const language = analysisData.language || 'Unknown';
      const timestamp = analysisData.timestamp || 'Unknown Time';
      
      elements.subtitle.textContent = `${fileName} (${language}) - Analyzed on ${timestamp}`;
    }
  }
  
  /**
   * Show results section and hide no-data message
   */
  function showResults() {
    if (elements.noData) {
      elements.noData.style.display = 'none';
      elements.noData.classList.add('hidden');
    }
    
    if (elements.results) {
      elements.results.style.display = 'block';
      elements.results.classList.remove('hidden');
    }
  }
  
  /**
   * Render basic file metrics
   */
  function renderBasicMetrics() {
    const metrics = {
      'total-lines': analysisData.totalLines || 0,
      'code-lines': analysisData.codeLines || 0,
      'comment-lines': analysisData.commentLines || 0,
      'blank-lines': analysisData.blankLines || 0,
      'file-size': formatBytes(analysisData.fileSizeBytes || 0),
      'function-count': analysisData.functionCount || 0,
      'class-count': analysisData.classCount || 0,
      'comment-ratio': formatRatio(analysisData.commentRatio || 0),
      'code-ratio': formatRatio(analysisData.codeRatio || 0),
      'blank-ratio': formatRatio(analysisData.blankRatio || 0)
    };

    Object.entries(metrics).forEach(([id, value]) => {
      updateElementText(id, value);
    });
  }

  function renderComplexityMetrics() {
    const complexity = analysisData.complexity || {};
    const functions = analysisData.functions || [];
    const highComplexityCount = functions.filter(f => (f.complexity || 0) > 10).length;

    const complexityMetrics = {
      'avg-complexity': (complexity.averageComplexity || 0).toFixed(2),
      'max-complexity': complexity.maxComplexity || 0,
      'complexity-density': (analysisData.cyclomaticComplexityDensity || 0).toFixed(3),
      'high-complexity-count-summary': highComplexityCount,
      'high-complexity-count-ccn': highComplexityCount,
      'avg-function-parameters': (analysisData.averageFunctionParameters || 0).toFixed(2),
      'max-function-parameters': analysisData.maxFunctionParameters || 0,
      'avg-nesting-depth': (analysisData.averageFunctionNestingDepth || 0).toFixed(2),
      'max-nesting-depth': analysisData.maxFunctionNestingDepth || 0
    };

    Object.entries(complexityMetrics).forEach(([id, value]) => {
      updateElementText(id, value);
    });
  }

  function renderComplexitySummary() {
    const functions = analysisData.functions || [];
    
    if (functions.length === 0) {
      updateElementText('highest-ccn-function', 'No functions found');
      updateElementText('highest-ccn-value', '-');
      updateElementText('lowest-ccn-function', '-');
      updateElementText('lowest-ccn-value', '-');
      updateElementText('high-complexity-warning', 'No functions to analyze');
      return;
    }
    
    // Sort functions by complexity
    const sortedByComplexity = [...functions].sort((a, b) => (b.complexity || 0) - (a.complexity || 0));
    const highest = sortedByComplexity[0];
    const lowest = sortedByComplexity[sortedByComplexity.length - 1];
    const highCount = functions.filter(f => (f.complexity || 0) > 10).length;
    
    const summaryData = {
      'highest-ccn-function': highest?.name || 'Unknown',
      'highest-ccn-value': highest ? `CCN: ${highest.complexity || 0}` : '-',
      'lowest-ccn-function': lowest?.name || 'Unknown',
      'lowest-ccn-value': lowest ? `CCN: ${lowest.complexity || 0}` : '-',
      'high-complexity-warning': highCount > 0 
        ? `${highCount} function(s) need attention` 
        : 'All functions have low complexity'
    };
    
    Object.entries(summaryData).forEach(([id, value]) => {
      updateElementText(id, value);
    });
  }
  
  /**
   * Render functions table
   */
  function renderFunctionsTable() {
    const tbody = document.getElementById('functions-body');
    if (!tbody) {
      return;
    }

    const functions = analysisData.functions || [];

    if (functions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="no-data">No functions found in this file</td></tr>';
      return;
    }

    const rows = functions.map((func) => {
      const complexity = func.complexity || 0;
      const complexityClass = getComplexityClass(complexity);
      const density = func.cyclomaticDensity || (func.complexity || 0) / Math.max(func.lineCount || 1, 1);
      const densityClass = getDensityClass(density);

      return `
        <tr>
          <td class="function-name">${escapeHtml(func.name || "Unknown")}</td>
          <td>${func.lineStart || func.startLine || 0}</td>
          <td>${func.lineEnd || func.endLine || 0}</td>
          <td>${func.lineCount || func.length || 0}</td>
          <td>${func.spanLines || 0}</td>
          <td>${func.parameters || func.parameterCount || 0}</td>
          <td>${func.maxNestingDepth || 0}</td>
          <td>${formatComplexityBand(func.complexityBand)}</td>
          <td class="complexity ${complexityClass}">${complexity}</td>
          <td class="density ${densityClass}">${density.toFixed(3)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rows.join('');
  }

  function renderDistributionMetrics() {
    const functions = analysisData.functions || [];
    
    // Calculate distribution
    const distribution = {
      simple: functions.filter(f => (f.complexity || 0) >= 1 && (f.complexity || 0) <= 5).length,
      moderate: functions.filter(f => (f.complexity || 0) >= 6 && (f.complexity || 0) <= 10).length,
      complex: functions.filter(f => (f.complexity || 0) >= 11 && (f.complexity || 0) <= 20).length,
      'very-complex': functions.filter(f => (f.complexity || 0) >= 21).length
    };
    
    Object.entries(distribution).forEach(([level, count]) => {
      updateElementText(`${level}-count`, count);
    });
  }
  
  /**
   * Create complexity chart using Chart.js
   */
  function renderComplexityChart() {
    const canvas = document.getElementById('complexityChart');
    if (!canvas) {
      return;
    }
    
    const functions = analysisData.functions || [];
    const distribution = {
      'Simple (1-5)': functions.filter(f => (f.complexity || 0) >= 1 && (f.complexity || 0) <= 5).length,
      'Moderate (6-10)': functions.filter(f => (f.complexity || 0) >= 6 && (f.complexity || 0) <= 10).length,
      'Complex (11-20)': functions.filter(f => (f.complexity || 0) >= 11 && (f.complexity || 0) <= 20).length,
      'Very Complex (21+)': functions.filter(f => (f.complexity || 0) >= 21).length
    };
    
    const colors = [
      '#28a745', // Simple - Green
      '#ffc107', // Moderate - Yellow
      '#fd7e14', // Complex - Orange
      '#dc3545'  // Very Complex - Red
    ];
    
    // Destroy existing chart if it exists
    if (complexityChart) {
      complexityChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    complexityChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(distribution),
        datasets: [{
          data: Object.values(distribution),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        layout: {
          padding: 10
        },
        plugins: {
          legend: {
            display: false // We'll create custom legend
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return `${label}: ${value} functions (${percentage}%)`;
              }
            }
          }
        },
        onResize: function(chart, size) {
          console.log('ANALYSIS_VIEWER: Chart resized to:', size);
        }
      }
    });
    
    // Generate custom legend
    generateCustomLegend(distribution, colors);
  }
  
  /**
   * Generate custom legend for the chart
   */
  function generateCustomLegend(distribution, colors) {
    const legendContainer = document.getElementById('chart-legend');
    if (!legendContainer) {
      return;
    }
    
    const labels = Object.keys(distribution);
    const values = Object.values(distribution);
    const total = values.reduce((a, b) => a + b, 0);
    
    const legendItems = labels.map((label, index) => {
      const value = values[index];
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      const color = colors[index];
      
      return `
        <div class="chart-legend-item">
          <div class="chart-legend-color" style="background-color: ${color}"></div>
          <span>${label}: ${value} (${percentage}%)</span>
        </div>
      `;
    }).join('');
    
    legendContainer.innerHTML = legendItems;
  }
  
  /**
   * Render density visualization
   */
  function renderDensityVisualization() {
    const functions = analysisData.functions || [];
    
    if (functions.length === 0) {
      updateElementText('density-value', '0.00');
      const densityFill = document.getElementById('density-fill');
      if (densityFill) {
        densityFill.style.width = '0%';
      }
      return;
    }
    
    // Calculate densities for each function
    const functionDensities = functions.map(f => {
      const complexity = f.complexity || 0;
      const lines = f.lineCount || f.length || 1;
      return {
        name: f.name || 'Unknown',
        density: lines > 0 ? complexity / lines : 0,
        complexity: complexity,
        lines: lines
      };
    });
    
    // Calculate average density
    const totalComplexity = functions.reduce((sum, f) => sum + (f.complexity || 0), 0);
    const totalLines = functions.reduce((sum, f) => sum + (f.lineCount || f.length || 1), 0);
    const avgDensity = totalLines > 0 ? totalComplexity / totalLines : 0;
    
    // Update density display
    updateElementText('density-value', avgDensity.toFixed(3));
    
    // Update density bar (scale to max reasonable value of 1.0)
    const densityFill = document.getElementById('density-fill');
    if (densityFill) {
      const percentage = Math.min(avgDensity * 100, 100);
      densityFill.style.width = `${percentage}%`;
    }
    
    // Update density summary
    renderDensitySummary(functionDensities);
    
    // Update density distribution
    renderDensityDistribution(functionDensities);
  }
  
  /**
   * Render density summary (highest, lowest, high density count)
   */
  function renderDensitySummary(functionDensities) {
    if (functionDensities.length === 0) {
      return;
    }
    
    // Sort by density
    const sortedByDensity = [...functionDensities].sort((a, b) => b.density - a.density);
    
    // Highest density function
    const highest = sortedByDensity[0];
    updateElementText('highest-density-function', highest.name);
    updateElementText('highest-density-value', `${highest.density.toFixed(3)}`);
    
    // Lowest density function
    const lowest = sortedByDensity[sortedByDensity.length - 1];
    updateElementText('lowest-density-function', lowest.name);
    updateElementText('lowest-density-value', `${lowest.density.toFixed(3)}`);
    
    // High density functions (> 0.5)
    const highDensityFunctions = functionDensities.filter(f => f.density > 0.5);
    updateElementText('high-density-count', highDensityFunctions.length.toString());
    
    const warningText = highDensityFunctions.length > 0 ? 
      `${highDensityFunctions.length} function${highDensityFunctions.length === 1 ? '' : 's'} need${highDensityFunctions.length === 1 ? 's' : ''} attention` : 
      'All functions have acceptable density';
    updateElementText('high-density-warning', warningText);
  }
  
  /**
   * Render density distribution legend
   */
  function renderDensityDistribution(functionDensities) {
    if (functionDensities.length === 0) {
      return;
    }
    
    // Count functions by density range
    const counts = {
      low: 0,      // 0.0-0.1
      medium: 0,   // 0.1-0.3
      high: 0,     // 0.3-0.5
      veryHigh: 0  // 0.5+
    };
    
    functionDensities.forEach(f => {
      if (f.density <= 0.1) {
        counts.low++;
      } else if (f.density <= 0.3) {
        counts.medium++;
      } else if (f.density <= 0.5) {
        counts.high++;
      } else {
        counts.veryHigh++;
      }
    });
    
    // Update distribution counts
    updateElementText('density-simple-count', counts.low.toString());
    updateElementText('density-moderate-count', counts.medium.toString());
    updateElementText('density-high-count', counts.high.toString());
    updateElementText('density-very-high-count', counts.veryHigh.toString());
  }
  
  /**
   * Utility function to update element text content
   */
  function formatRatio(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
  }

  function formatBytes(bytes) {
    if (!bytes) {
      return '0 KB';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatComplexityBand(value) {
    if (!value) {
      return 'Normal';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function updateElementText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value.toString();
    }
  }
  
  /**
   * Get CSS class for complexity level
   */
  function getComplexityClass(complexity) {
    if (complexity <= 5) {
      return 'simple';
    }
    if (complexity <= 10) {
      return 'moderate';
    }
    if (complexity <= 20) {
      return 'complex';
    }
    return 'critical';
  }
  
  /**
   * Get CSS class for density level
   */
  function getDensityClass(density) {
    if (density <= 0.1) {
      return 'low';
    }
    if (density <= 0.3) {
      return 'medium';
    }
    if (density <= 0.5) {
      return 'high';
    }
    return 'very-high';
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Export for debugging
  window.AnalysisViewer = {
    data: () => analysisData,
    reload: loadAnalysisData,
    render: renderAnalysisData
  };
  
})();


