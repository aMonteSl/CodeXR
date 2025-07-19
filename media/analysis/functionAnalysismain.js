(function() {
  // Get VSCode API
  const vscode = acquireVsCodeApi();
  let functionData = window.functionData || null;
  
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
    document.getElementById('cyclomatic-density').textContent = 
      functionData.function.cyclomaticDensity ? functionData.function.cyclomaticDensity.toFixed(3) : '-';
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
    if (!gaugeFill) {
      return;
    }
    
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
    if (!recommendationsContainer) {
      return;
    }
    
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
  
  /**
   * Initialize Server-Sent Events for live updates
   */
  function initializeSSE() {
    console.log('FUNCTION_ANALYSIS: Initializing SSE for live updates...');
    
    try {
      // Connect to the /events endpoint on the current server
      const eventSource = new EventSource('/events');
      
      eventSource.onopen = function(event) {
        console.log('FUNCTION_ANALYSIS: SSE connection opened');
        showSSEStatus('connected');
      };
      
      eventSource.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          console.log('FUNCTION_ANALYSIS: SSE message received:', data);
          handleSSEMessage(data);
        } catch (error) {
          console.error('FUNCTION_ANALYSIS: Error parsing SSE message:', error);
        }
      };
      
      eventSource.onerror = function(event) {
        console.error('FUNCTION_ANALYSIS: SSE connection error:', event);
        showSSEStatus('error');
        
        // Note: EventSource will automatically try to reconnect
      };
      
      // Store reference for potential cleanup
      window.analysisSSE = eventSource;
      
    } catch (error) {
      console.error('FUNCTION_ANALYSIS: Failed to initialize SSE:', error);
      showSSEStatus('error');
    }
  }

  /**
   * Handle incoming SSE messages
   */
  function handleSSEMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('FUNCTION_ANALYSIS: SSE connected for file:', data.fileUri);
        showSSEStatus('connected');
        break;
        
      case 'analysis-updated':
        console.log('FUNCTION_ANALYSIS: Analysis updated for file:', data.fileUri);
        showUpdateNotification();
        // For function analysis, we might need to refresh the function data
        break;
        
      case 'heartbeat':
        // Keep-alive message, no action needed
        break;
        
      default:
        console.log('FUNCTION_ANALYSIS: Unknown SSE message type:', data.type);
    }
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
    showNotification('Analysis updated!', '#3b82f6', 2000);
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
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Function analysis page loaded');
    
    // Initialize SSE for live updates
    initializeSSE();
    
    // If we already have data, render it
    if (functionData) {
      renderFunctionData();
    }
  });
})();