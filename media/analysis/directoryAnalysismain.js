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
function loadAnalysisData(data) {
  console.log('📊 loadAnalysisData called with:', data);
  debugLog('Loading analysis data:', data);
  
  // ✅ NEW: Preserve scroll position during updates
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  analysisData = data;
  fileData = data.files || [];
  
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
  document.getElementById('total-functions').textContent = summary.totalFunctions;
  document.getElementById('total-classes').textContent = summary.totalClasses;
  document.getElementById('avg-complexity').textContent = summary.averageComplexity.toFixed(1);
  document.getElementById('max-complexity').textContent = findMaxComplexity();
}

// Find maximum AVERAGE complexity across all files (not function-level max)
function findMaxComplexity() {
  let maxAvgComplexity = 0;
  fileData.forEach(file => {
    const avgComplexity = file.meanComplexity || 0;
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
    charts.language = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: languages,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--background-color')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--foreground-color'),
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
    charts.size = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(sizeCategories),
      datasets: [{
        label: 'Number of Files',
        data: Object.values(sizeCategories),
        backgroundColor: ['#27ae60', '#f39c12', '#e67e22', '#e74c3c'],
        borderWidth: 1,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
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
            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground-color'),
            font: {
              size: 11
            }
          },
          grid: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground-color'),
            font: {
              size: 11
            }
          },
          grid: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
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
      const avgComplexity = file.meanComplexity || 0;
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
    charts.complexity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Low (≤5)', 'Medium (6-10)', 'High (11-20)', 'Critical (>20)'],
      datasets: [{
        label: 'Number of Files',
        data: [complexityBuckets.low, complexityBuckets.medium, complexityBuckets.high, complexityBuckets.critical],
        backgroundColor: ['#27ae60', '#f39c12', '#e67e22', '#e74c3c'],
        borderWidth: 1,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
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
            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground-color'),
            font: {
              size: 11
            }
          },
          grid: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground-color'),
            font: {
              size: 11
            }
          },
          grid: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
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
    .filter(file => file.meanComplexity > 0)
    .sort((a, b) => (b.meanComplexity || 0) - (a.meanComplexity || 0))
    .slice(0, 10);

  const container = document.getElementById('complex-files-list');
  const isDeepMode = window.analysisMode === 'deep';
  
  container.innerHTML = sortedFiles.map(file => {
    const complexity = file.meanComplexity || 0;
    const classification = getFileComplexityClassification(complexity);
    
    // Show relative path for deep mode, just filename for shallow mode
    const displayName = isDeepMode && file.relativePath && file.relativePath !== file.fileName 
      ? file.relativePath 
      : file.fileName;
    
    return `
      <div class="file-item ${classification.cssClass}">
        <div class="file-name" title="${file.filePath}">${displayName}</div>
        <div class="file-details">
          <span class="complexity-badge ${classification.cssClass}">${complexity.toFixed(1)} CCN</span>
          <span>${file.functionCount || 0} functions</span>
          <span>${file.totalLines || 0} lines</span>
        </div>
      </div>
    `;
  }).join('');
}

// Update file table
function updateFileTable() {
  const tbody = document.getElementById('file-table-body');
  const isDeepMode = window.analysisMode === 'deep';
  
  tbody.innerHTML = fileData.map(file => {
    const avgComplexity = file.meanComplexity || 0;
    const classification = getFileComplexityClassification(avgComplexity);
    const fileSizeKB = file.fileSizeBytes ? (file.fileSizeBytes / 1024).toFixed(1) + ' KB' : '0 KB';
    
    // Find max function complexity for this file
    const fileFunctions = analysisData.functions ? 
      analysisData.functions.filter(func => func.filePath === file.filePath) : [];
    const maxFunctionComplexity = fileFunctions.length > 0 ? 
      Math.max(...fileFunctions.map(func => func.complexity || 0)) : 0;
    
    // Show relative path for deep mode, just filename for shallow mode
    const displayName = isDeepMode && file.relativePath && file.relativePath !== file.fileName 
      ? file.relativePath 
      : file.fileName;
    
    return `
      <tr class="${classification.cssClass}">
        <td class="file-name clickable" title="${file.filePath}" data-file-path="${file.filePath}">
          <span class="file-name-link">${displayName}</span>
        </td>
        <td>${file.language || 'Unknown'}</td>
        <td>${fileSizeKB}</td>
        <td>${(file.totalLines || 0).toLocaleString()}</td>
        <td>${file.functionCount || 0}</td>
        <td>${file.classCount || 0}</td>
        <td>${avgComplexity.toFixed(1)}</td>
        <td>${maxFunctionComplexity}</td>
      </tr>
    `;
  }).join('');
  
  // Add click handlers for file names
  const fileNameCells = document.querySelectorAll('.file-name.clickable');
  fileNameCells.forEach(cell => {
    cell.addEventListener('click', handleFileClick);
  });
}

// Handle file name click to open individual analysis
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
        return (b.meanComplexity || 0) - (a.meanComplexity || 0);
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

    // Classify each file based on its average CCN (meanComplexity)
    fileData.forEach(file => {
      const avgComplexity = file.meanComplexity || 0;
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
      borderColor: '#2c3e50'
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
            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground-color') || '#ffffff',
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
  
  // Check if we have analysis data available immediately
  if (window.analysisData) {
    console.log('✅ Found window.analysisData, initializing...');
    loadAnalysisData(window.analysisData);
  } else {
    console.warn('❌ No window.analysisData found in DOMContentLoaded');
    // Try a delayed check in case the script tag hasn't executed yet
    setTimeout(function() {
      if (window.analysisData) {
        console.log('✅ Found window.analysisData after delay, initializing...');
        loadAnalysisData(window.analysisData);
      } else {
        console.error('❌ Still no window.analysisData after delay');
      }
    }, 100);
  }
  
  // ✅ NEW: Set up a backup polling mechanism to check for data.json updates
  // This provides a fallback if the message system fails
  let lastDataHash = null;
  
  function checkForDataUpdates() {
    fetch('./data.json')
      .then(response => response.json())
      .then(data => {
        // Create a simple hash of the data to detect changes
        const dataString = JSON.stringify(data);
        const currentHash = dataString.length + '_' + data.summary.analyzedAt;
        
        if (lastDataHash && lastDataHash !== currentHash) {
          console.log('🔄 Detected data.json change via polling, updating...');
          window.analysisData = data;
          loadAnalysisData(data);
        }
        
        lastDataHash = currentHash;
      })
      .catch(error => {
        console.warn('⚠️ Failed to poll data.json:', error);
      });
  }
  
  // Check for updates every 2 seconds as a backup
  setInterval(checkForDataUpdates, 2000);
  
  // Initial check after a short delay
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
