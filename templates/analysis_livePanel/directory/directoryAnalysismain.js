// Use existing vscode API or get a reference to it
let vsCodeApi;
try {
  // If vscode is already declared in HTML, use it
  if (typeof vscode !== 'undefined') {
    vsCodeApi = vscode;
  } else {
    // Otherwise try to acquire it
    vsCodeApi = acquireVsCodeApi();
  }
} catch (error) {
  console.warn('VS Code API not available:', error);
  vsCodeApi = null;
}

// Global data storage
let analysisData = null;
let fileData = [];
let charts = {};

// Debug mode - set to false for production
const DEBUG_MODE = false;

// Theme management
function getStoredTheme() {
  try {
    return localStorage.getItem('directoryAnalysisTheme') || 'light';
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return 'light';
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem('directoryAnalysisTheme', theme);
  } catch (error) {
    console.warn('Failed to store theme:', error);
  }
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
  
  // Refresh charts with new theme colors if data is available
  if (analysisData && fileData.length > 0) {
    setTimeout(() => {
      updateComplexityDistribution();
      updateLanguageDistribution();
      updateFileSizeDistribution();
      updateComplexityOverview();
    }, 100); // Small delay to ensure theme is applied
  }
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  setStoredTheme(newTheme);
}

// Make toggleTheme available globally for template compatibility
window.toggleTheme = toggleTheme;

// Get theme-aware colors for charts
function getThemeColors() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  return {
    textColor: isDark ? '#e0e0e0' : '#212529',
    borderColor: isDark ? '#404040' : '#dee2e6',
    gridColor: isDark ? '#404040' : '#dee2e6'
  };
}

function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

// Initialize the view (legacy function for compatibility)
function init() {
  console.log('🔍 Legacy init function called - now handled by DOMContentLoaded');
}

// Load and display analysis data
function normalizePathValue(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function deriveDirectoryPath(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return 'Unknown';
  }

  const first = files[0] || {};
  const normalizedFilePath = normalizePathValue(first.filePath || '');
  const normalizedRelativePath = normalizePathValue(first.relativePath || first.fileName || '');

  if (!normalizedFilePath) {
    return 'Unknown';
  }

  if (normalizedRelativePath && normalizedFilePath.endsWith(normalizedRelativePath)) {
    return normalizedFilePath.slice(0, normalizedFilePath.length - normalizedRelativePath.length).replace(/\/$/, '') || normalizedFilePath;
  }

  const lastSlash = normalizedFilePath.lastIndexOf('/');
  return lastSlash > 0 ? normalizedFilePath.slice(0, lastSlash) : normalizedFilePath;
}

function buildSummaryFromFiles(files) {
  const summary = {
    totalFiles: Array.isArray(files) ? files.length : 0,
    totalFilesAnalyzed: 0,
    totalFilesNotAnalyzed: 0,
    totalLines: 0,
    totalComments: 0,
    totalBlankLines: 0,
    totalFunctions: 0,
    totalClasses: 0,
    averageComplexity: 0,
    commentRatio: 0,
    codeRatio: 0,
    blankRatio: 0,
    highComplexityFunctions: 0,
    criticalComplexityFunctions: 0,
    averageFunctionParameters: 0,
    maxFunctionParameters: 0,
    averageFunctionNestingDepth: 0,
    maxFunctionNestingDepth: 0,
    totalFileSizeBytes: 0,
    languages: {}
  };

  let complexityWeight = 0;
  let parameterWeight = 0;
  let nestingWeight = 0;
  let totalCodeLines = 0;
  let totalFunctionsForAggregates = 0;

  (files || []).forEach((file) => {
    const status = file.status || 'success';
    if (status === 'success') {
      summary.totalFilesAnalyzed += 1;
    } else {
      summary.totalFilesNotAnalyzed += 1;
    }

    summary.totalLines += file.totalLines || 0;
    summary.totalComments += file.commentLines || 0;
    summary.totalBlankLines += file.blankLines || 0;
    totalCodeLines += file.codeLines || 0;
    summary.totalFunctions += file.functionCount || 0;
    summary.totalClasses += file.classCount || 0;
    summary.totalFileSizeBytes += file.fileSizeBytes || 0;
    summary.highComplexityFunctions += file.highComplexityFunctions || 0;
    summary.criticalComplexityFunctions += file.criticalComplexityFunctions || 0;
    summary.maxFunctionParameters = Math.max(summary.maxFunctionParameters, file.maxFunctionParameters || 0);
    summary.maxFunctionNestingDepth = Math.max(summary.maxFunctionNestingDepth, file.maxFunctionNestingDepth || 0);

    const language = file.language || 'Unknown';
    summary.languages[language] = (summary.languages[language] || 0) + 1;

    const functionCount = file.functionCount || 0;
    if (functionCount > 0) {
      complexityWeight += (file.cyclomaticComplexityNumber || 0) * functionCount;
      parameterWeight += (file.averageFunctionParameters || 0) * functionCount;
      nestingWeight += (file.averageFunctionNestingDepth || 0) * functionCount;
      totalFunctionsForAggregates += functionCount;
    }
  });

  summary.averageComplexity = totalFunctionsForAggregates > 0
    ? complexityWeight / totalFunctionsForAggregates
    : 0;
  summary.averageFunctionParameters = totalFunctionsForAggregates > 0
    ? parameterWeight / totalFunctionsForAggregates
    : 0;
  summary.averageFunctionNestingDepth = totalFunctionsForAggregates > 0
    ? nestingWeight / totalFunctionsForAggregates
    : 0;
  summary.commentRatio = summary.totalLines > 0 ? summary.totalComments / summary.totalLines : 0;
  summary.codeRatio = summary.totalLines > 0 ? totalCodeLines / summary.totalLines : 0;
  summary.blankRatio = summary.totalLines > 0 ? summary.totalBlankLines / summary.totalLines : 0;

  return summary;
}

function normalizeIncomingDirectoryAnalysisData(data) {
  if (Array.isArray(data)) {
    return {
      directoryPath: deriveDirectoryPath(data),
      timestamp: (data[0] && data[0].timestamp) || 'Unknown',
      summary: buildSummaryFromFiles(data),
      files: data
    };
  }

  return data;
}

function formatRatio(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatFileSize(bytes) {
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

function loadAnalysisData(data) {
  console.log('📊 loadAnalysisData called with:', data);
  debugLog('Loading analysis data:', data);
  
  // ✅ NEW: Preserve scroll position during updates
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  analysisData = normalizeIncomingDirectoryAnalysisData(data);
  fileData = analysisData.files || [];
  
  console.log('📊 File data loaded:', fileData.length, 'files');
  debugLog('File data loaded:', fileData.length, 'files');
  
  const noDataEl = document.getElementById('no-data');
  const resultsEl = document.getElementById('results');
  
  console.log('📊 Elements found - noData:', !!noDataEl, 'results:', !!resultsEl);
  
  if (noDataEl) {
    console.log('🔄 Hiding no-data element');
    noDataEl.classList.add('hidden');
  }
  if (resultsEl) {
    console.log('🔄 Showing results element');
    resultsEl.classList.remove('hidden');
  }
  
  try {
    console.log('🔄 Updating header information...');
    updateHeaderInfo();
    debugLog('Header info updated');
    
    console.log('🔄 Updating summary...');
    updateSummary();
    debugLog('Summary updated');
    
    console.log('🔄 Updating complexity distribution...');
    updateComplexityDistribution();
    debugLog('Complexity distribution updated');
    
    console.log('🔄 Updating language distribution...');
    updateLanguageDistribution();
    debugLog('Language distribution updated');
    
    console.log('🔄 Updating file size distribution...');
    updateFileSizeDistribution();
    debugLog('File size distribution updated');
    
    console.log('🔄 Updating complexity overview...');
    updateComplexityOverview();
    debugLog('Complexity overview updated');
    
    console.log('🔄 Updating top complex files...');
    updateTopComplexFiles();
    debugLog('Top complex files updated');
    
    console.log('🔄 Updating file table...');
    updateFileTable();
    debugLog('File table updated');
    
    // ✅ NEW: Restore scroll position after updates
    setTimeout(() => {
      window.scrollTo(scrollLeft, scrollTop);
      console.log(`🔄 Restored scroll position: ${scrollLeft}, ${scrollTop}`);
    }, 10);
    
    console.log('✅ All sections updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating sections:', error);
  }
}

/**
 * Initialize Server-Sent Events for live updates
 */
function initializeSSE() {
  console.log('DIRECTORY_ANALYSIS: Initializing SSE for live updates...');
  
  try {
    // Connect to the /events endpoint on the current server
    const eventSource = new EventSource('/events');
    
    eventSource.onopen = function(event) {
      console.log('DIRECTORY_ANALYSIS: SSE connection opened');
      showSSEStatus('connected');
    };
    
    eventSource.onmessage = function(event) {
      console.log('DIRECTORY_ANALYSIS: Raw SSE message received:', event);
      console.log('DIRECTORY_ANALYSIS: Event data type:', typeof event.data);
      console.log('DIRECTORY_ANALYSIS: Event data content:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        console.log('DIRECTORY_ANALYSIS: Parsed SSE data:', data);
        handleSSEMessage(data);
      } catch (error) {
        console.error('DIRECTORY_ANALYSIS: Error parsing SSE message:', error);
        console.error('DIRECTORY_ANALYSIS: Unparseable data:', event.data);
      }
    };
    
    eventSource.onerror = function(event) {
      console.error('DIRECTORY_ANALYSIS: SSE connection error:', event);
      showSSEStatus('error');
      
      // Note: EventSource will automatically try to reconnect
    };
    
    // Store reference for potential cleanup
    window.analysisSSE = eventSource;
    
  } catch (error) {
    console.error('DIRECTORY_ANALYSIS: Failed to initialize SSE:', error);
    showSSEStatus('error');
  }
}

/**
 * Handle incoming SSE messages
 */
function handleSSEMessage(data) {
  console.log('DIRECTORY_ANALYSIS: Handling SSE message, data.type:', data.type);
  console.log('DIRECTORY_ANALYSIS: Full data object:', data);
  
  // Check if we have nested data (EnhancedSSEManager format)
  const messageType = data.type || (data.data && data.data.type);
  console.log('DIRECTORY_ANALYSIS: Determined message type:', messageType);
  
  switch (messageType) {
    case 'connected':
      console.log('DIRECTORY_ANALYSIS: SSE connected for file:', data.fileUri || data.data?.fileUri);
      showSSEStatus('connected');
      break;
      
    case 'analysis-updated':
      console.log('DIRECTORY_ANALYSIS: Analysis updated for file:', data.fileUri || data.data?.fileUri);
      console.log('DIRECTORY_ANALYSIS: Triggering data reload...');
      showUpdateNotification();
      reloadAnalysisData();
      break;
      
    case 'heartbeat':
      console.log('DIRECTORY_ANALYSIS: Heartbeat received');
      // Keep-alive message, no action needed
      break;
      
    default:
      console.log('DIRECTORY_ANALYSIS: Unknown SSE message type:', messageType);
      console.log('DIRECTORY_ANALYSIS: Full data:', data);
  }
}

/**
 * Reload analysis data after SSE update notification
 */
function reloadAnalysisData() {
  console.log('DIRECTORY_ANALYSIS: Reloading analysis data due to SSE update...');
  
  // Add cache busting to ensure fresh data
  fetch('./data.json?t=' + Date.now())
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('DIRECTORY_ANALYSIS: Successfully reloaded data.json via SSE');
      loadAnalysisData(data);
      showReloadNotification();
    })
    .catch(error => {
      console.error('DIRECTORY_ANALYSIS: Failed to reload data.json:', error);
      // Show error in a user-friendly way
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        background: #ef4444;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1001;
        font-family: inherit;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      errorDiv.textContent = 'Failed to reload analysis data: ' + error.message;
      document.body.appendChild(errorDiv);
      
      setTimeout(() => {
        errorDiv.remove();
      }, 5000);
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

// Update header information (directory path, file counts, timestamp)
function updateHeaderInfo() {
  if (!analysisData) {
    return;
  }
  
  // Update directory path
  const directoryPath = analysisData.directoryPath || 'Unknown';
  const directoryPathEl = document.getElementById('directory-path');
  if (directoryPathEl) {
    directoryPathEl.textContent = directoryPath;
  }
  
  // Update file counts in header
  const summary = analysisData.summary || {};
  const fileCountEl = document.getElementById('file-count');
  const totalFileCountEl = document.getElementById('total-file-count');
  
  if (fileCountEl) {
    fileCountEl.textContent = summary.totalFilesAnalyzed || 0;
  }
  
  if (totalFileCountEl) {
    totalFileCountEl.textContent = summary.totalFiles || 0;
  }
  
  // Update timestamp
  const timestamp = analysisData.timestamp || 'Unknown';
  const timestampEl = document.getElementById('analysis-timestamp');
  if (timestampEl) {
    timestampEl.textContent = timestamp;
  }
}

// Update summary metrics
function updateSummary() {
  if (!analysisData.summary) {
    return;
  }

  const summary = analysisData.summary;
  document.getElementById('total-files').textContent = summary.totalFiles;
  document.getElementById('total-files-analyzed').textContent = summary.totalFilesAnalyzed;
  document.getElementById('total-files-not-analyzed').textContent = summary.totalFilesNotAnalyzed;
  document.getElementById('total-lines').textContent = summary.totalLines.toLocaleString();
  document.getElementById('total-comments').textContent = (summary.totalComments || 0).toLocaleString();
  document.getElementById('total-blank-lines').textContent = (summary.totalBlankLines || 0).toLocaleString();
  document.getElementById('total-functions').textContent = summary.totalFunctions;
  document.getElementById('total-classes').textContent = summary.totalClasses;
  document.getElementById('avg-complexity').textContent = summary.averageComplexity.toFixed(1);
  document.getElementById('max-complexity').textContent = findMaxComplexity();
  document.getElementById('comment-ratio-summary').textContent = formatRatio(summary.commentRatio);
  document.getElementById('code-ratio-summary').textContent = formatRatio(summary.codeRatio);
  document.getElementById('blank-ratio-summary').textContent = formatRatio(summary.blankRatio);
  document.getElementById('high-complexity-functions').textContent = summary.highComplexityFunctions;
  document.getElementById('critical-complexity-functions').textContent = summary.criticalComplexityFunctions;
  document.getElementById('avg-function-params').textContent = (summary.averageFunctionParameters || 0).toFixed(2);
  document.getElementById('max-function-params').textContent = summary.maxFunctionParameters || 0;
  document.getElementById('avg-function-nesting').textContent = (summary.averageFunctionNestingDepth || 0).toFixed(2);
  document.getElementById('max-function-nesting').textContent = summary.maxFunctionNestingDepth || 0;
}

function findMaxComplexity() {
  let maxAvgComplexity = 0;
  fileData.forEach(file => {
    const avgComplexity = file.cyclomaticComplexityNumber || 0;
    if (avgComplexity > maxAvgComplexity) {
      maxAvgComplexity = avgComplexity;
    }
  });
  return maxAvgComplexity.toFixed(1); // Return with 1 decimal place for consistency
}

// Update language distribution chart
function updateLanguageDistribution() {
  try {
    debugLog('Starting updateLanguageDistribution');
    const languageStats = {};
    
    fileData.forEach(file => {
      const lang = file.language || 'Unknown';
      if (!languageStats[lang]) {
        languageStats[lang] = { count: 0, lines: 0 };
      }
      languageStats[lang].count++;
      languageStats[lang].lines += file.totalLines || 0;
    });

    debugLog('Language stats calculated:', languageStats);

    const languages = Object.keys(languageStats);
    const counts = languages.map(lang => languageStats[lang].count);
    const colors = generateColors(languages.length);

    // Destroy existing chart if it exists
    if (charts.language) {
      charts.language.destroy();
    }

    const canvas = document.getElementById('language-chart');
    if (!canvas) {
      console.error('Language chart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const themeColors = getThemeColors();
    
    charts.language = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: languages,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: themeColors.borderColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: themeColors.textColor,
              font: {
                size: 11
              },
              padding: 15
            }
          }
        }
      }
    });

  // Update language stats
  const statsContainer = document.getElementById('language-stats');
  if (statsContainer) {
    statsContainer.innerHTML = languages.map(lang => {
      const stat = languageStats[lang];
      return `
        <div class="stat-item">
          <div class="stat-label">${lang}</div>
          <div class="stat-value">${stat.count} files, ${stat.lines.toLocaleString()} lines</div>
        </div>
      `;
    }).join('');
  }

  debugLog('Language distribution chart created successfully');
  } catch (error) {
    console.error('Error updating language distribution:', error);
  }
}

// Update file size distribution
function updateFileSizeDistribution() {
  try {
    debugLog('Starting updateFileSizeDistribution');
    const sizeCategories = { 'Small (<1KB)': 0, 'Medium (1-10KB)': 0, 'Large (10-100KB)': 0, 'Very Large (>100KB)': 0 };
    
    fileData.forEach(file => {
      const sizeInBytes = file.fileSizeBytes || 0;
      const sizeInKB = sizeInBytes / 1024;
      
      if (sizeInKB < 1) {
        sizeCategories['Small (<1KB)']++;
      } else if (sizeInKB < 10) {
        sizeCategories['Medium (1-10KB)']++;
      } else if (sizeInKB < 100) {
        sizeCategories['Large (10-100KB)']++;
      } else {
        sizeCategories['Very Large (>100KB)']++;
      }
    });

    debugLog('Size categories calculated:', sizeCategories);

    // Destroy existing chart if it exists
    if (charts.size) {
      charts.size.destroy();
    }

    const canvas = document.getElementById('size-chart');
    if (!canvas) {
      console.error('Size chart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const themeColors = getThemeColors();
    
    charts.size = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(sizeCategories),
      datasets: [{
        label: 'Number of Files',
        data: Object.values(sizeCategories),
        backgroundColor: ['#27ae60', '#f39c12', '#e67e22', '#e74c3c'],
        borderWidth: 1,
        borderColor: themeColors.borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: themeColors.textColor,
            font: {
              size: 11
            }
          },
          grid: {
            color: themeColors.gridColor
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: themeColors.textColor,
            font: {
              size: 11
            }
          },
          grid: {
            color: themeColors.gridColor
          }
        }
      }
    }
  });

  debugLog('File size distribution chart created successfully');
  } catch (error) {
    console.error('Error updating file size distribution:', error);
  }
}

// Update complexity overview (using same classification as distribution)
function updateComplexityOverview() {
  try {
    debugLog('Starting updateComplexityOverview');
    const complexityBuckets = { low: 0, medium: 0, high: 0, critical: 0 };
    
    fileData.forEach(file => {
      const avgComplexity = file.cyclomaticComplexityNumber || 0;
      const classification = getFileComplexityClassification(avgComplexity);
      
      switch (classification.category) {
        case 'low':
          complexityBuckets.low++;
          break;
        case 'medium':
          complexityBuckets.medium++;
          break;
        case 'high':
          complexityBuckets.high++;
          break;
        case 'critical':
          complexityBuckets.critical++;
          break;
      }
    });

    debugLog('Complexity buckets calculated:', complexityBuckets);

    // Destroy existing chart if it exists
    if (charts.complexity) {
      charts.complexity.destroy();
    }

    const canvas = document.getElementById('complexity-chart');
    if (!canvas) {
      console.error('Complexity chart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const themeColors = getThemeColors();
    
    charts.complexity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Low (≤5)', 'Medium (6-10)', 'High (11-20)', 'Critical (>20)'],
      datasets: [{
        label: 'Number of Files',
        data: [complexityBuckets.low, complexityBuckets.medium, complexityBuckets.high, complexityBuckets.critical],
        backgroundColor: ['#27ae60', '#f39c12', '#e67e22', '#e74c3c'],
        borderWidth: 1,
        borderColor: themeColors.borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: themeColors.textColor,
            font: {
              size: 11
            }
          },
          grid: {
            color: themeColors.gridColor
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: themeColors.textColor,
            font: {
              size: 11
            }
          },
          grid: {
            color: themeColors.gridColor
          }
        }
      }
    }
  });

  debugLog('Complexity overview chart created successfully');
  } catch (error) {
    console.error('Error updating complexity overview:', error);
  }
}

// Update top complex files
function updateTopComplexFiles() {
  const sortedFiles = [...fileData]
    .filter(file => file.cyclomaticComplexityNumber > 0)
    .sort((a, b) => (b.cyclomaticComplexityNumber || 0) - (a.cyclomaticComplexityNumber || 0))
    .slice(0, 10);

  const container = document.getElementById('complex-files-list');
  const isDeepMode = window.analysisMode === "deep";

  container.innerHTML = sortedFiles.map(file => {
    const complexity = file.cyclomaticComplexityNumber || 0;
    const classification = getFileComplexityClassification(complexity);
    const displayName = isDeepMode && file.relativePath && file.relativePath !== file.fileName
      ? file.relativePath
      : file.fileName;

    return `
      <div class="file-item ${classification.cssClass}">
        <div class="file-name" title="${file.filePath}">${displayName}</div>
        <div class="file-details">
          <span class="complexity-badge ${classification.cssClass}">${complexity.toFixed(1)} CCN</span>
          <span>${file.functionCount || 0} functions</span>
          <span>${file.maxFunctionNestingDepth || 0} max nesting</span>
          <span>${file.highComplexityFunctions || 0} high-risk</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateFileTable() {
  const tbody = document.getElementById('file-table-body');

  tbody.innerHTML = fileData.map(file => {
    const avgComplexity = file.cyclomaticComplexityNumber || 0;
    const classification = getFileComplexityClassification(avgComplexity);
    const maxFunctionComplexity = file.maxComplexity || 0;

    return `
      <tr class="${classification.cssClass}">
        <td class="file-name clickable" title="${file.filePath}" data-file-path="${file.filePath}">
          <span class="file-name-link">${file.fileName}</span>
        </td>
        <td class="relative-path" title="${file.relativePath || file.fileName}">
          ${file.relativePath || file.fileName}
        </td>
        <td>${file.language || "Unknown"}</td>
        <td>${formatFileSize(file.fileSizeBytes || 0)}</td>
        <td>${(file.totalLines || 0).toLocaleString()}</td>
        <td>${file.functionCount || 0}</td>
        <td>${avgComplexity.toFixed(1)}</td>
        <td>${maxFunctionComplexity}</td>
        <td>${formatRatio(file.commentRatio || 0)}</td>
        <td>${(file.averageFunctionParameters || 0).toFixed(2)}</td>
        <td>${file.maxFunctionParameters || 0}</td>
        <td>${(file.averageFunctionNestingDepth || 0).toFixed(2)}</td>
        <td>${file.maxFunctionNestingDepth || 0}</td>
        <td>${file.highComplexityFunctions || 0}</td>
        <td>${file.criticalComplexityFunctions || 0}</td>
      </tr>
    `;
  }).join('');

  const fileNameCells = document.querySelectorAll('.file-name.clickable');
  fileNameCells.forEach(cell => {
    cell.addEventListener('click', handleFileClick);
  });
}

function handleFileClick(event) {
  const filePath = event.currentTarget.getAttribute('data-file-path');
  if (!filePath) {
    console.error('No file path found for clicked file');
    return;
  }
  
  // Send message to extension to open individual file analysis
  const message = {
    command: 'openFileAnalysis',
    filePath: filePath
  };
  
  try {
    if (vsCodeApi) {
      vsCodeApi.postMessage(message);
    } else {
      console.warn('VS Code API not available for postMessage');
    }
  } catch (error) {
    console.error('Failed to send message to VS Code:', error);
  }
}

// ✅ SHARED: Get complexity classification based on file's average CCN
function getFileComplexityClassification(avgCCN) {
  if (avgCCN <= 5) {
    return {
      category: 'low',
      label: 'Low',
      cssClass: 'low-complexity',
      color: '#27ae60' // Green
    };
  }
  if (avgCCN <= 10) {
    return {
      category: 'medium',
      label: 'Medium', 
      cssClass: 'medium-complexity',
      color: '#f39c12' // Orange
    };
  }
  if (avgCCN <= 20) {
    return {
      category: 'high',
      label: 'High',
      cssClass: 'high-complexity', 
      color: '#e67e22' // Dark orange
    };
  }
  return {
    category: 'critical',
    label: 'Critical',
    cssClass: 'critical-complexity',
    color: '#e74c3c' // Red
  };
}

// Legacy function for backward compatibility
function getComplexityClass(ccn) {
  return getFileComplexityClassification(ccn).cssClass;
}

// Filter files based on search input
function filterFiles() {
  const filter = document.getElementById('file-filter').value.toLowerCase();
  const rows = document.querySelectorAll('#file-table tbody tr');
  
  rows.forEach(row => {
    const fileName = row.querySelector('.file-name').textContent.toLowerCase();
    const matches = fileName.includes(filter);
    row.style.display = matches ? '' : 'none';
  });
}

// Sort files by selected criteria
function sortFiles() {
  const sortBy = document.getElementById('sort-by').value;
  
  fileData.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.fileName.localeCompare(b.fileName);
      case 'size':
        return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
      case 'complexity':
        return (b.cyclomaticComplexityNumber || 0) - (a.cyclomaticComplexityNumber || 0);
      case 'lines':
        return (b.totalLines || 0) - (a.totalLines || 0);
      case 'functions':
        return (b.functionCount || 0) - (a.functionCount || 0);
      default:
        return 0;
    }
  });
  
  updateFileTable();
}

// Update complexity distribution based on file-level average CCN
function updateComplexityDistribution() {
  try {
    if (!fileData || fileData.length === 0) {
      // No files to analyze, set all counts to 0
      document.getElementById('simple-count').textContent = '0';
      document.getElementById('moderate-count').textContent = '0';
      document.getElementById('complex-count').textContent = '0';
      document.getElementById('very-complex-count').textContent = '0';
      return;
    }

    const distribution = {
      simple: 0,    // Low: CCN ≤ 5
      moderate: 0,  // Medium: CCN 6-10
      complex: 0,   // High: CCN 11-20
      veryComplex: 0 // Critical: CCN > 20
    };

    // Classify each file based on its average CCN (cyclomaticComplexityNumber)
    fileData.forEach(file => {
      const avgComplexity = file.cyclomaticComplexityNumber || 0;
      const classification = getFileComplexityClassification(avgComplexity);
      
      switch (classification.category) {
        case 'low':
          distribution.simple++;
          break;
        case 'medium':
          distribution.moderate++;
          break;
        case 'high':
          distribution.complex++;
          break;
        case 'critical':
          distribution.veryComplex++;
          break;
      }
    });

    // Update the counts
    document.getElementById('simple-count').textContent = distribution.simple;
    document.getElementById('moderate-count').textContent = distribution.moderate;
    document.getElementById('complex-count').textContent = distribution.complex;
    document.getElementById('very-complex-count').textContent = distribution.veryComplex;

    // Create the doughnut chart
    createComplexityDistributionChart(distribution);
  } catch (error) {
    console.error('Error updating complexity distribution:', error);
    // Set fallback values
    document.getElementById('simple-count').textContent = '0';
    document.getElementById('moderate-count').textContent = '0';
    document.getElementById('complex-count').textContent = '0';
    document.getElementById('very-complex-count').textContent = '0';
  }
}

// Create complexity distribution doughnut chart
function createComplexityDistributionChart(distribution) {
  const canvas = document.getElementById('complexity-distribution-chart');
  if (!canvas || !window.Chart) {
    debugLog('Chart.js not available or canvas not found for complexity distribution');
    return;
  }

  // Destroy existing chart if it exists
  if (window.complexityDistributionChart) {
    window.complexityDistributionChart.destroy();
  }

  const data = {
    labels: ['Low (≤5)', 'Medium (6-10)', 'High (11-20)', 'Critical (>20)'],
    datasets: [{
      data: [distribution.simple, distribution.moderate, distribution.complex, distribution.veryComplex],
      backgroundColor: [
        '#27ae60', // Low - green
        '#f39c12', // Medium - orange
        '#e67e22', // High - dark orange
        '#e74c3c'  // Critical - red
      ],
      borderWidth: 2,
      borderColor: getThemeColors().borderColor
    }]
  };

  window.complexityDistributionChart = new Chart(canvas, {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
            color: getThemeColors().textColor,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
              return `${context.label}: ${context.parsed} files (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Generate unique colors for charts
function generateColors(count) {
  const baseColors = [
    '#27ae60', '#3498db', '#9b59b6', '#e74c3c', '#f39c12',
    '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#2ecc71',
    '#8e44ad', '#c0392b', '#d35400', '#16a085', '#2c3e50',
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
    '#a55eea', '#26de81', '#fd79a8', '#6c5ce7', '#fab1a0',
    '#ff7675', '#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e',
    '#e17055', '#00b894', '#00cec9', '#0984e3', '#6c5ce7'
  ];
  
  const colors = [];
  
  // First, use all base colors without repetition
  for (let i = 0; i < count && i < baseColors.length; i++) {
    colors.push(baseColors[i]);
  }
  
  // If we need more colors than base colors, generate HSL variations
  if (count > baseColors.length) {
    const remainingCount = count - baseColors.length;
    for (let i = 0; i < remainingCount; i++) {
      // Generate unique HSL colors with good saturation and lightness
      // Using golden angle for optimal color distribution
      const hue = (i * 137.508) % 360;
      // Vary saturation and lightness for better distinction
      const saturation = 65 + (i % 4) * 10; // 65%, 75%, 85%, 95%
      const lightness = 45 + (i % 3) * 15; // 45%, 60%, 75%
      colors.push(`hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`);
    }
  }
  
  return colors;
}

// Handle messages from the extension
window.addEventListener('message', event => {
  const message = event.data;
  console.log('📨 Received message from extension:', message);
  switch (message.command) {
    case 'updateData':
      console.log('🔄 Processing updateData message with:', message.data);
      // Store the new data
      window.analysisData = message.data;
      // Reload the analysis with new data
      loadAnalysisData(message.data);
      console.log('✅ Data updated successfully');
      break;
    case 'refresh':
      console.log('🔄 Processing refresh command');
      // Try to reload from window.analysisData if available
      if (window.analysisData) {
        console.log('🔄 Refreshing with existing window.analysisData');
        loadAnalysisData(window.analysisData);
      } else {
        console.log('🔄 No analysisData available, attempting to fetch from data.json');
        // Attempt to fetch data.json directly
        fetch('./data.json')
          .then(response => response.json())
          .then(data => {
            console.log('✅ Fetched data from data.json:', data);
            window.analysisData = data;
            loadAnalysisData(data);
          })
          .catch(error => {
            console.error('❌ Failed to fetch data.json:', error);
          });
      }
      break;
    default:
      console.log('❓ Unknown message command:', message.command);
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 DOMContentLoaded event fired');
  
  // Initialize theme from window.initialTheme (set by server) or localStorage fallback
  let initialTheme = 'light';
  if (window.initialTheme) {
    initialTheme = window.initialTheme;
    console.log('🎨 Using server-provided theme:', initialTheme);
  } else {
    initialTheme = getStoredTheme();
    console.log('🎨 Using stored theme:', initialTheme);
  }
  applyTheme(initialTheme);
  
  // Set up theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Listen for the analysisDataLoaded event from the template
  window.addEventListener('analysisDataLoaded', function(event) {
    console.log('✅ Received analysisDataLoaded event, initializing...');
    loadAnalysisData(event.detail);
  });
  
  // Check if we have analysis data available immediately (fallback)
  if (window.analysisData) {
    console.log('✅ Found window.analysisData immediately, initializing...');
    loadAnalysisData(window.analysisData);
  } else {
    console.log('⏳ Waiting for analysisDataLoaded event...');
  }
  
  // ✅ NEW: Initialize Server-Sent Events for live updates
  initializeSSE();
  
  // ✅ DIRECTORY ANALYSIS: Use SSE for live updates, NO polling needed
  // Directory analysis uses SSE events for real-time updates
  let lastDataHash = null;
  
  function checkForDataUpdates() {
    // Only for debugging or manual refresh - not automatic polling
    fetch('./data.json')
      .then(response => response.json())
      .then(data => {
        // Create a simple hash of the data to detect changes
        const dataString = JSON.stringify(data);
        const currentHash = dataString.length + '_' + data.summary.analyzedAt;
        
        if (lastDataHash && lastDataHash !== currentHash) {
          console.log('🔄 Detected data.json change via manual check, updating...');
          window.analysisData = data;
          loadAnalysisData(data);
        }
        
        lastDataHash = currentHash;
      })
      .catch(error => {
        console.warn('⚠️ Failed to check data.json:', error);
      });
  }
  
  // ❌ REMOVED: No automatic polling for directory analysis
  // Directory analysis uses SSE events for live updates
  // setInterval(checkForDataUpdates, 2000);
  
  // Initial check only - no repeated polling
  setTimeout(checkForDataUpdates, 1000);
  
  // Set up event listeners
  try {
    const fileFilter = document.getElementById('file-filter');
    const sortBy = document.getElementById('sort-by');
    
    if (fileFilter) {
      fileFilter.addEventListener('input', filterFiles);
    } else {
      console.warn('file-filter element not found');
    }
    
    if (sortBy) {
      sortBy.addEventListener('change', sortFiles);
    } else {
      console.warn('sort-by element not found');
    }
  } catch (error) {
    console.warn('Error setting up event listeners:', error);
  }
});

// Legacy support for the old init function
function init() {
  console.log('🔍 Legacy init function called');
  // This is now handled by DOMContentLoaded
}

