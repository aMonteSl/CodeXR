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

// Shared chart component instances (created on first render, updated in place).
// Colors are CSS-variable driven (charts.css), so a theme change restyles them
// without any re-render.
const chartInstances = {};

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

// Inline SVG icons for the theme toggle. Using icons (not the words "Dark" /
// "Light") keeps the control compact and language-neutral; `stroke: currentColor`
// in the stylesheet colors them for whichever theme is active.
const THEME_ICON_SUN = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
const THEME_ICON_MOON = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    // In dark mode, offer the sun (switch to light); in light mode, the moon.
    themeToggle.innerHTML = theme === 'dark' ? THEME_ICON_SUN : THEME_ICON_MOON;
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
  // Charts read their colors from CSS variables (charts.css), so switching the
  // body[data-theme] attribute restyles every chart with no re-render.
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  setStoredTheme(newTheme);
}

// Make toggleTheme available globally for template compatibility
window.toggleTheme = toggleTheme;

function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
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
  console.log(' loadAnalysisData called with:', data);
  debugLog('Loading analysis data:', data);
  
  //  NEW: Preserve scroll position during updates
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  analysisData = normalizeIncomingDirectoryAnalysisData(data);
  fileData = analysisData.files || [];
  
  console.log(' File data loaded:', fileData.length, 'files');
  debugLog('File data loaded:', fileData.length, 'files');
  
  const noDataEl = document.getElementById('no-data');
  const resultsEl = document.getElementById('results');
  
  console.log(' Elements found - noData:', !!noDataEl, 'results:', !!resultsEl);
  
  if (noDataEl) {
    console.log(' Hiding no-data element');
    noDataEl.classList.add('hidden');
  }
  if (resultsEl) {
    console.log(' Showing results element');
    resultsEl.classList.remove('hidden');
  }
  
  try {
    console.log(' Updating header information...');
    updateHeaderInfo();
    debugLog('Header info updated');
    
    console.log(' Updating summary...');
    updateSummary();
    debugLog('Summary updated');
    
    console.log(' Updating complexity distribution...');
    updateComplexityDistribution();
    debugLog('Complexity distribution updated');
    
    console.log(' Updating language distribution...');
    updateLanguageDistribution();
    debugLog('Language distribution updated');
    
    console.log(' Updating file size distribution...');
    updateFileSizeDistribution();
    debugLog('File size distribution updated');
    
    console.log(' Updating complexity overview...');
    updateComplexityOverview();
    debugLog('Complexity overview updated');
    
    renderComplexFilesTable();
    debugLog('Complex files table updated');

    renderFileDetailsTable();
    debugLog('File details table updated');
    
    //  NEW: Restore scroll position after updates
    setTimeout(() => {
      window.scrollTo(scrollLeft, scrollTop);
      console.log(` Restored scroll position: ${scrollLeft}, ${scrollTop}`);
    }, 10);
    
    console.log(' All sections updated successfully');
    
  } catch (error) {
    console.error(' Error updating sections:', error);
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
      flashSSEStatus('New data received');
      showUpdateNotification();
      reloadAnalysisData();
      break;

    case 'dependency-updated':
      // The server recomputed the dependency graph as part of the re-analysis;
      // reload the freshly written artifact.
      console.log('DIRECTORY_ANALYSIS: Dependency data updated, reloading summary...');
      flashSSEStatus('New data received');
      loadDependencySummary();
      break;

    case 'historical-progress':
      // Comparison progress from the server (analyzing left/right versions).
      historicalPanel.handleSseMessage(data.data && data.data.type ? data.data : data);
      break;

    case 'historical-updated':
      // A comparison finished (or its working-copy side was re-analyzed).
      flashSSEStatus('New data received');
      historicalPanel.handleSseMessage(data.data && data.data.type ? data.data : data);
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
      statusElement.textContent = 'Live Updates';
      statusElement.style.backgroundColor = '#10b981';
      statusElement.style.color = 'white';
      break;
    case 'error':
      statusElement.textContent = 'Disconnected';
      statusElement.style.backgroundColor = '#ef4444';
      statusElement.style.color = 'white';
      break;
  }
}

let sseStatusFlashTimer = null;

/**
 * Momentarily surface that fresh data arrived, then fall back to the steady
 * "Live Updates" indicator.
 */
function flashSSEStatus(message) {
  const statusElement = document.getElementById('sse-status');
  if (!statusElement) {
    return;
  }
  statusElement.textContent = message;
  statusElement.style.backgroundColor = '#3b82f6';
  statusElement.style.color = 'white';
  if (sseStatusFlashTimer) {
    clearTimeout(sseStatusFlashTimer);
  }
  sseStatusFlashTimer = setTimeout(() => {
    sseStatusFlashTimer = null;
    showSSEStatus('connected');
  }, 2500);
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

// Update language distribution chart (categorical donut: identity per language,
// fixed slot order; languages beyond the 8 categorical slots fold into "Other").
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

    const ranked = Object.keys(languageStats)
      .map(lang => ({ label: lang, value: languageStats[lang].count }))
      .sort((a, b) => b.value - a.value);
    const segments = ranked.slice(0, 8).map((entry, index) => ({
      label: entry.label,
      value: entry.value,
      colorClass: codexrSeriesClass(index),
    }));
    const rest = ranked.slice(8);
    if (rest.length > 0) {
      segments.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((sum, entry) => sum + entry.value, 0),
        colorClass: 'codexr-other',
      });
    }

    if (!chartInstances.language) {
      chartInstances.language = new CodexrDonutChart('language-chart', {
        centerLabel: 'Files',
        ariaLabel: 'Files per language',
      });
    }
    chartInstances.language.setData(segments);

    // Per-language stats grid (files + lines per language).
    const statsContainer = document.getElementById('language-stats');
    if (statsContainer) {
      statsContainer.innerHTML = Object.keys(languageStats).map(lang => {
        const stat = languageStats[lang];
        return `
          <div class="stat-item">
            <div class="stat-label">${escapeHtml(lang)}</div>
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

    // File size is a magnitude ordering, not a severity: one sequential hue.
    if (!chartInstances.size) {
      chartInstances.size = new CodexrBarChart('size-chart', {
        colorClass: 'codexr-sequential',
      });
    }
    chartInstances.size.setData(Object.keys(sizeCategories).map(category => ({
      label: category,
      value: sizeCategories[category],
      detail: 'files',
    })));

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

    // Complexity bands are severities: status colors, direct-labeled per bar.
    if (!chartInstances.complexity) {
      chartInstances.complexity = new CodexrBarChart('complexity-chart');
    }
    chartInstances.complexity.setData([
      { label: 'Low (≤5)', value: complexityBuckets.low, colorClass: 'codexr-status-good', detail: 'files' },
      { label: 'Medium (6-10)', value: complexityBuckets.medium, colorClass: 'codexr-status-warning', detail: 'files' },
      { label: 'High (11-20)', value: complexityBuckets.high, colorClass: 'codexr-status-serious', detail: 'files' },
      { label: 'Critical (>20)', value: complexityBuckets.critical, colorClass: 'codexr-status-critical', detail: 'files' },
    ]);

    debugLog('Complexity overview chart created successfully');
  } catch (error) {
    console.error('Error updating complexity overview:', error);
  }
}

// ── Table registry ───────────────────────────────────────────────────────────
// Every list in this view is a shared DataTable. Instances are cached by mount
// id so live updates (SSE reloads, dependency refresh) re-render existing tables
// instead of rebuilding them and losing the user's current search/sort.
const dataTables = {};

function upsertDataTable(mountId, options, rows) {
  if (dataTables[mountId]) {
    dataTables[mountId].setRows(rows);
  } else {
    dataTables[mountId] = new DataTable(mountId, Object.assign({}, options, { rows: rows }));
  }
  return dataTables[mountId];
}

// Ask the extension to open a single file's own analysis (from a clickable row).
function openFileAnalysis(filePath) {
  if (!filePath) {
    return;
  }
  try {
    if (vsCodeApi) {
      vsCodeApi.postMessage({ command: 'openFileAnalysis', filePath: filePath });
    }
  } catch (error) {
    console.error('Failed to open file analysis:', error);
  }
}

// Shared cell renderers / row helpers for the file tables.
function renderFileNameCell(file, displayName) {
  return `<span class="cell-link" title="${escapeHtml(file.filePath || '')}">${escapeHtml(displayName || '')}</span>`;
}

function fileComplexityRowClass(file) {
  return getFileComplexityClassification(file.cyclomaticComplexityNumber || 0).cssClass;
}

// Most Complex Files — the files carrying cyclomatic complexity, searchable and
// sortable, defaulting to the highest average CCN first.
function renderComplexFilesTable() {
  const rows = fileData.filter(file => (file.cyclomaticComplexityNumber || 0) > 0);
  upsertDataTable('complex-files-table', {
    searchPlaceholder: 'Search files...',
    emptyMessage: 'No complex files detected.',
    sort: { key: 'cyclomaticComplexityNumber', dir: 'desc' },
    rowClass: fileComplexityRowClass,
    onRowClick: file => openFileAnalysis(file.filePath),
    columns: [
      {
        key: 'fileName', label: 'File',
        render: file => renderFileNameCell(
          file,
          file.relativePath && file.relativePath !== file.fileName ? file.relativePath : file.fileName,
        ),
      },
      { key: 'language', label: 'Language', align: 'center', value: file => file.language || 'Unknown' },
      {
        key: 'cyclomaticComplexityNumber', label: 'Avg CCN', align: 'center', defaultDir: 'desc',
        value: file => file.cyclomaticComplexityNumber || 0,
        render: file => escapeHtml((file.cyclomaticComplexityNumber || 0).toFixed(1)),
      },
      { key: 'functionCount', label: 'Functions', align: 'center', defaultDir: 'desc', value: file => file.functionCount || 0 },
      { key: 'maxFunctionNestingDepth', label: 'Max Nesting', align: 'center', defaultDir: 'desc', value: file => file.maxFunctionNestingDepth || 0 },
      { key: 'highComplexityFunctions', label: 'High-risk Fns', align: 'center', defaultDir: 'desc', value: file => file.highComplexityFunctions || 0 },
    ],
  }, rows);
}

// File Details — the full per-file metric table (the reference table style):
// search box, "Sort by" menu, sortable headers, fixed-height internal scroll,
// and a clickable file name that opens that file's own analysis.
function renderFileDetailsTable() {
  upsertDataTable('file-details-table', {
    searchPlaceholder: 'Search files...',
    emptyMessage: 'No files analyzed.',
    sort: { key: 'fileName', dir: 'asc' },
    rowClass: fileComplexityRowClass,
    onRowClick: file => openFileAnalysis(file.filePath),
    columns: [
      { key: 'fileName', label: 'File', render: file => renderFileNameCell(file, file.fileName) },
      {
        key: 'relativePath', label: 'Relative Path',
        value: file => file.relativePath || file.fileName || '',
        render: file => {
          const relPath = file.relativePath || file.fileName || '';
          return `<span class="cell-path" title="${escapeHtml(relPath)}">${escapeHtml(relPath)}</span>`;
        },
      },
      { key: 'language', label: 'Language', align: 'center', value: file => file.language || 'Unknown' },
      {
        key: 'fileSizeBytes', label: 'Size', align: 'right', defaultDir: 'desc',
        value: file => file.fileSizeBytes || 0,
        render: file => escapeHtml(formatFileSize(file.fileSizeBytes || 0)),
      },
      {
        key: 'totalLines', label: 'Lines', align: 'right', defaultDir: 'desc',
        value: file => file.totalLines || 0,
        render: file => escapeHtml((file.totalLines || 0).toLocaleString()),
      },
      { key: 'functionCount', label: 'Functions', align: 'center', defaultDir: 'desc', value: file => file.functionCount || 0 },
      {
        key: 'cyclomaticComplexityNumber', label: 'Avg CCN', align: 'center', defaultDir: 'desc',
        value: file => file.cyclomaticComplexityNumber || 0,
        render: file => escapeHtml((file.cyclomaticComplexityNumber || 0).toFixed(1)),
      },
      { key: 'maxComplexity', label: 'Max Fn CCN', align: 'center', defaultDir: 'desc', value: file => file.maxComplexity || 0 },
      {
        key: 'commentRatio', label: 'Comment %', align: 'center', defaultDir: 'desc',
        value: file => file.commentRatio || 0,
        render: file => escapeHtml(formatRatio(file.commentRatio || 0)),
      },
      {
        key: 'averageFunctionParameters', label: 'Avg Params', align: 'center', defaultDir: 'desc',
        value: file => file.averageFunctionParameters || 0,
        render: file => escapeHtml((file.averageFunctionParameters || 0).toFixed(2)),
      },
      { key: 'maxFunctionParameters', label: 'Max Params', align: 'center', defaultDir: 'desc', value: file => file.maxFunctionParameters || 0 },
      {
        key: 'averageFunctionNestingDepth', label: 'Avg Nesting', align: 'center', defaultDir: 'desc',
        value: file => file.averageFunctionNestingDepth || 0,
        render: file => escapeHtml((file.averageFunctionNestingDepth || 0).toFixed(2)),
      },
      { key: 'maxFunctionNestingDepth', label: 'Max Nesting', align: 'center', defaultDir: 'desc', value: file => file.maxFunctionNestingDepth || 0 },
      { key: 'highComplexityFunctions', label: 'High CCN Fns', align: 'center', defaultDir: 'desc', value: file => file.highComplexityFunctions || 0 },
      { key: 'criticalComplexityFunctions', label: 'Critical CCN Fns', align: 'center', defaultDir: 'desc', value: file => file.criticalComplexityFunctions || 0 },
    ],
  }, fileData);
}

//  SHARED: Get complexity classification based on file's average CCN
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

// (File Details filtering and sorting are now handled by the shared DataTable.)

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

// Create complexity distribution donut chart (status colors: severity bands).
function createComplexityDistributionChart(distribution) {
  if (!chartInstances.complexityDistribution) {
    chartInstances.complexityDistribution = new CodexrDonutChart('complexity-distribution-chart', {
      centerLabel: 'Files',
      ariaLabel: 'Files per complexity band',
    });
  }
  chartInstances.complexityDistribution.setData([
    { label: 'Low (≤5)', value: distribution.simple, colorClass: 'codexr-status-good' },
    { label: 'Medium (6-10)', value: distribution.moderate, colorClass: 'codexr-status-warning' },
    { label: 'High (11-20)', value: distribution.complex, colorClass: 'codexr-status-serious' },
    { label: 'Critical (>20)', value: distribution.veryComplex, colorClass: 'codexr-status-critical' },
  ]);
}

// ============================================================
// Dependency Summary (shared CodexrDependencySummaryPanel)
// ============================================================
// All rendering lives in the shared component
// (templates/components/livepanel/dependencySummaryPanel.js); this file only
// wires initial loading and the `dependency-updated` SSE event to it.

const dependencyPanel = new CodexrDependencySummaryPanel();

function loadDependencySummary() {
  return dependencyPanel.load();
}

// Load the current dependency dataset on startup; subsequent updates arrive via
// the `dependency-updated` SSE event (see handleSSEMessage).
function initializeDependencyGraphSummary() {
  loadDependencySummary();
}

// ============================================================
// Historical Comparison (shared CodexrHistoricalPanel)
// ============================================================
// Compare the working copy against any local Git branch/tag/commit. The shared
// panel owns the whole REST + SSE flow
// (templates/components/livepanel/historicalPanel.js).

const historicalPanel = new CodexrHistoricalPanel();

// Handle messages from the extension
window.addEventListener('message', event => {
  const message = event.data;
  console.log(' Received message from extension:', message);
  switch (message.command) {
    case 'updateData':
      console.log(' Processing updateData message with:', message.data);
      // Store the new data
      window.analysisData = message.data;
      // Reload the analysis with new data
      loadAnalysisData(message.data);
      console.log(' Data updated successfully');
      break;
    case 'refresh':
      console.log(' Processing refresh command');
      // Try to reload from window.analysisData if available
      if (window.analysisData) {
        console.log(' Refreshing with existing window.analysisData');
        loadAnalysisData(window.analysisData);
      } else {
        console.log(' No analysisData available, attempting to fetch from data.json');
        // Attempt to fetch data.json directly
        fetch('./data.json')
          .then(response => response.json())
          .then(data => {
            console.log(' Fetched data from data.json:', data);
            window.analysisData = data;
            loadAnalysisData(data);
          })
          .catch(error => {
            console.error(' Failed to fetch data.json:', error);
          });
      }
      break;
    default:
      console.log(' Unknown message command:', message.command);
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log(' DOMContentLoaded event fired');
  
  // Initialize theme from window.initialTheme (set by server) or localStorage fallback
  let initialTheme = 'light';
  if (window.initialTheme) {
    initialTheme = window.initialTheme;
    console.log(' Using server-provided theme:', initialTheme);
  } else {
    initialTheme = getStoredTheme();
    console.log(' Using stored theme:', initialTheme);
  }
  applyTheme(initialTheme);
  
  // Set up theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Set up the Dependency Summary (auto-runs on load; SSE-driven afterwards)
  initializeDependencyGraphSummary();

  // Set up the Historical Comparison panel (loads Git references, or explains
  // why the feature is unavailable for this target).
  historicalPanel.initialize();

  // Listen for the analysisDataLoaded event from the template
  window.addEventListener('analysisDataLoaded', function(event) {
    console.log(' Received analysisDataLoaded event, initializing...');
    loadAnalysisData(event.detail);
  });
  
  // Check if we have analysis data available immediately (fallback)
  if (window.analysisData) {
    console.log(' Found window.analysisData immediately, initializing...');
    loadAnalysisData(window.analysisData);
  } else {
    console.log('Waiting for analysisDataLoaded event...');
  }
  
  // Live updates arrive over SSE; the tables re-render themselves on reload.
  initializeSSE();
});
