/**
 * File LivePanel — classic analysis dashboard for a single file.
 *
 * Loads data.json (produced by the Python analysis backend), renders metric
 * tiles, complexity/density summaries, an interactive functions table and
 * SVG charts, and hosts the shared Dependency Summary and Historical
 * Comparison panels. Live updates arrive over SSE (`/events`).
 *
 * Shared components (bundled ahead of this file by the LivePanel parser):
 * DataTable, CodexrDonutChart, CodexrBarChart, CodexrPairedBarChart,
 * CodexrDependencySummaryPanel, CodexrHistoricalPanel, escapeHtml.
 */

// Global state
let analysisData = null;

// Shared chart component instances (created on first render, updated in place).
// Colors are CSS-variable driven (charts.css), so a theme change restyles them
// without any re-render.
const chartInstances = {};
const dataTables = {};

// ── Theme management ─────────────────────────────────────────────────────────

function getStoredTheme() {
  try {
    return localStorage.getItem('fileAnalysisTheme') || 'light';
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return 'light';
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem('fileAnalysisTheme', theme);
  } catch (error) {
    console.warn('Failed to store theme:', error);
  }
}

// Inline SVG icons for the theme toggle (see the directory panel for rationale).
const THEME_ICON_SUN = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
const THEME_ICON_MOON = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' ? THEME_ICON_SUN : THEME_ICON_MOON;
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
  // Charts read their colors from CSS variables (charts.css); nothing to re-render.
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  setStoredTheme(newTheme);
}

window.toggleTheme = toggleTheme;

// ── Data normalization ───────────────────────────────────────────────────────

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

// ── Data loading ─────────────────────────────────────────────────────────────

function loadAnalysisData() {
  fetch('./data.json?t=' + Date.now())
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      analysisData = normalizeIncomingAnalysisData(data);
      renderAnalysisData();
    })
    .catch(error => {
      console.error('FILE_ANALYSIS: Failed to load data.json:', error);
      showError('Failed to load analysis data: ' + error.message);
    });
}

function showError(message) {
  console.error('FILE_ANALYSIS:', message);
  const noData = document.getElementById('no-data');
  const results = document.getElementById('results');
  if (noData) {
    noData.textContent = '';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Error: ' + message;
    noData.appendChild(paragraph);
    noData.classList.remove('hidden');
  }
  if (results) {
    results.classList.add('hidden');
  }
}

// ── SSE live updates ─────────────────────────────────────────────────────────

function initializeSSE() {
  try {
    const eventSource = new EventSource('/events');

    eventSource.onopen = function() {
      showSSEStatus('connected');
    };

    eventSource.onmessage = function(event) {
      try {
        handleSSEMessage(JSON.parse(event.data));
      } catch (error) {
        console.error('FILE_ANALYSIS: Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = function() {
      // EventSource retries automatically; just reflect the state.
      showSSEStatus('error');
    };

    window.analysisSSE = eventSource;
  } catch (error) {
    console.error('FILE_ANALYSIS: Failed to initialize SSE:', error);
    showSSEStatus('error');
  }
}

function handleSSEMessage(data) {
  const messageType = data.type || (data.data && data.data.type);

  switch (messageType) {
    case 'connected':
      showSSEStatus('connected');
      break;

    case 'analysis-updated':
      // The file was re-analyzed by the watcher chain; reload data.json.
      flashSSEStatus('New data received');
      loadAnalysisData();
      break;

    case 'dependency-updated':
      // The server recomputed the dependency dataset as part of re-analysis.
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
      break;

    default:
      console.log('FILE_ANALYSIS: Unknown SSE message type:', messageType);
  }
}

function showSSEStatus(status) {
  let statusElement = document.getElementById('sse-status');
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = 'sse-status';
    statusElement.className = 'sse-status';
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

// Momentarily surface that fresh data arrived, then fall back to the steady
// "Live Updates" indicator.
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

// ── Rendering ────────────────────────────────────────────────────────────────

function renderAnalysisData() {
  if (!analysisData) {
    showError('No analysis data available');
    return;
  }

  const noData = document.getElementById('no-data');
  const results = document.getElementById('results');
  if (noData) {
    noData.classList.add('hidden');
  }
  if (results) {
    results.classList.remove('hidden');
  }

  try {
    updateHeader();
    renderBasicMetrics();
    renderComplexityMetrics();
    renderComplexitySummary();
    renderTopFunctionsChart();
    renderFunctionsTable();
    renderDistribution();
    renderDensityVisualization();
  } catch (error) {
    console.error('FILE_ANALYSIS: Error rendering analysis:', error);
    showError('Error rendering analysis: ' + error.message);
  }
}

function updateHeader() {
  updateElementText('file-name', analysisData.fileName || 'Unknown File');
  updateElementText('file-language', analysisData.language || 'Unknown');
  updateElementText('analysis-timestamp', analysisData.timestamp || 'Unknown');
}

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

// Top functions by CCN: severity-colored bars, direct-labeled.
function renderTopFunctionsChart() {
  const functions = analysisData.functions || [];
  if (!chartInstances.topFunctions) {
    chartInstances.topFunctions = new CodexrBarChart('top-functions-chart', { maxRows: 10 });
  }
  const rows = [...functions]
    .sort((a, b) => (b.complexity || 0) - (a.complexity || 0))
    .filter(func => (func.complexity || 0) > 0)
    .map(func => ({
      label: func.name,
      value: func.complexity || 0,
      colorClass: complexityColorClass(func.complexity || 0),
      detail: `lines ${func.lineStart}-${func.lineEnd} · ${func.parameters} params`,
    }));
  chartInstances.topFunctions.setData(rows);
}

// All functions: shared DataTable (search, sort, internal scroll).
function renderFunctionsTable() {
  const functions = analysisData.functions || [];
  const config = {
    searchPlaceholder: 'Search functions...',
    emptyMessage: 'No functions found in this file.',
    sort: { key: 'complexity', dir: 'desc' },
    rowClass: func => functionRowClass(func.complexity || 0),
    columns: [
      { key: 'name', label: 'Function' },
      { key: 'lineStart', label: 'Start', align: 'right', searchable: false },
      { key: 'lineEnd', label: 'End', align: 'right', searchable: false },
      { key: 'lineCount', label: 'Length', align: 'right', defaultDir: 'desc', searchable: false },
      { key: 'spanLines', label: 'Span', align: 'right', defaultDir: 'desc', searchable: false },
      { key: 'parameters', label: 'Params', align: 'center', defaultDir: 'desc', searchable: false },
      { key: 'maxNestingDepth', label: 'Nesting', align: 'center', defaultDir: 'desc', searchable: false },
      {
        key: 'complexityBand', label: 'Band', align: 'center',
        render: func => `<span class="data-table-badge ${bandBadgeClass(func.complexityBand)}">${escapeHtml(formatComplexityBand(func.complexityBand))}</span>`,
      },
      {
        key: 'complexity', label: 'CCN', align: 'center', defaultDir: 'desc',
        render: func => `<span class="complexity ${getComplexityClass(func.complexity || 0)}">${func.complexity || 0}</span>`,
      },
      {
        key: 'cyclomaticDensity', label: 'Density', align: 'right', defaultDir: 'desc', searchable: false,
        value: func => functionDensity(func),
        render: func => escapeHtml(functionDensity(func).toFixed(3)),
      },
    ],
  };

  if (dataTables.functions) {
    dataTables.functions.setRows(functions);
  } else {
    dataTables.functions = new DataTable('functions-table', Object.assign({}, config, { rows: functions }));
  }
}

function functionDensity(func) {
  return func.cyclomaticDensity || (func.complexity || 0) / Math.max(func.lineCount || 1, 1);
}

function renderDistribution() {
  const functions = analysisData.functions || [];
  const distribution = {
    simple: functions.filter(f => (f.complexity || 0) >= 1 && (f.complexity || 0) <= 5).length,
    moderate: functions.filter(f => (f.complexity || 0) >= 6 && (f.complexity || 0) <= 10).length,
    complex: functions.filter(f => (f.complexity || 0) >= 11 && (f.complexity || 0) <= 20).length,
    'very-complex': functions.filter(f => (f.complexity || 0) >= 21).length
  };

  Object.entries(distribution).forEach(([level, count]) => {
    updateElementText(`${level}-count`, count);
  });

  if (!chartInstances.distribution) {
    chartInstances.distribution = new CodexrDonutChart('complexity-distribution-chart', {
      centerLabel: 'Functions',
      ariaLabel: 'Functions per complexity band',
    });
  }
  chartInstances.distribution.setData([
    { label: 'Simple (1-5)', value: distribution.simple, colorClass: 'codexr-status-good' },
    { label: 'Moderate (6-10)', value: distribution.moderate, colorClass: 'codexr-status-warning' },
    { label: 'Complex (11-20)', value: distribution.complex, colorClass: 'codexr-status-serious' },
    { label: 'Very Complex (21+)', value: distribution['very-complex'], colorClass: 'codexr-status-critical' },
  ]);
}

// ── Cyclomatic density section ───────────────────────────────────────────────

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

  const functionDensities = functions.map(f => ({
    name: f.name || 'Unknown',
    density: functionDensity(f),
  }));

  const totalComplexity = functions.reduce((sum, f) => sum + (f.complexity || 0), 0);
  const totalLines = functions.reduce((sum, f) => sum + (f.lineCount || 1), 0);
  const avgDensity = totalLines > 0 ? totalComplexity / totalLines : 0;

  updateElementText('density-value', avgDensity.toFixed(3));
  const densityFill = document.getElementById('density-fill');
  if (densityFill) {
    densityFill.style.width = `${Math.min(avgDensity * 100, 100)}%`;
  }

  renderDensitySummary(functionDensities);
  renderDensityDistribution(functionDensities);
}

function renderDensitySummary(functionDensities) {
  if (functionDensities.length === 0) {
    return;
  }

  const sortedByDensity = [...functionDensities].sort((a, b) => b.density - a.density);
  const highest = sortedByDensity[0];
  const lowest = sortedByDensity[sortedByDensity.length - 1];

  updateElementText('highest-density-function', highest.name);
  updateElementText('highest-density-value', highest.density.toFixed(3));
  updateElementText('lowest-density-function', lowest.name);
  updateElementText('lowest-density-value', lowest.density.toFixed(3));

  const highDensityFunctions = functionDensities.filter(f => f.density > 0.5);
  updateElementText('high-density-count', highDensityFunctions.length.toString());
  updateElementText('high-density-warning', highDensityFunctions.length > 0
    ? `${highDensityFunctions.length} function${highDensityFunctions.length === 1 ? '' : 's'} need${highDensityFunctions.length === 1 ? 's' : ''} attention`
    : 'All functions have acceptable density');
}

function renderDensityDistribution(functionDensities) {
  const counts = { low: 0, medium: 0, high: 0, veryHigh: 0 };
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

  updateElementText('density-simple-count', counts.low.toString());
  updateElementText('density-moderate-count', counts.medium.toString());
  updateElementText('density-high-count', counts.high.toString());
  updateElementText('density-very-high-count', counts.veryHigh.toString());
}

// ── Formatting helpers ───────────────────────────────────────────────────────

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

function bandBadgeClass(band) {
  if (band === 'critical') {
    return 'is-bad';
  }
  if (band === 'high' || band === 'warning') {
    return 'is-warn';
  }
  return 'is-neutral';
}

function updateElementText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value.toString();
  }
}

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

// DataTable row accent classes shared with the directory panel's stylesheet.
function functionRowClass(complexity) {
  if (complexity <= 5) {
    return 'low-complexity';
  }
  if (complexity <= 10) {
    return 'medium-complexity';
  }
  if (complexity <= 20) {
    return 'high-complexity';
  }
  return 'critical-complexity';
}

function complexityColorClass(complexity) {
  if (complexity <= 5) {
    return 'codexr-status-good';
  }
  if (complexity <= 10) {
    return 'codexr-status-warning';
  }
  if (complexity <= 20) {
    return 'codexr-status-serious';
  }
  return 'codexr-status-critical';
}

// ── Shared feature panels ────────────────────────────────────────────────────

// Dependency Summary: rendering lives in the shared component
// (templates/components/livepanel/dependencySummaryPanel.js).
const dependencyPanel = new CodexrDependencySummaryPanel();

function loadDependencySummary() {
  return dependencyPanel.load();
}

// Historical Comparison: compare this file's working copy against any local
// Git branch/tag/commit (templates/components/livepanel/historicalPanel.js).
const historicalPanel = new CodexrHistoricalPanel();

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  applyTheme(window.initialTheme || getStoredTheme());

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  loadAnalysisData();
  loadDependencySummary();
  historicalPanel.initialize();
  initializeSSE();
});

// Export for debugging
window.AnalysisViewer = {
  data: () => analysisData,
  reload: loadAnalysisData,
  render: renderAnalysisData
};
