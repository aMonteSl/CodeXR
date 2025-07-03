(function() {
  // Get VSCode API if available (for potential future use)
  let vscode;
  try {
    vscode = acquireVsCodeApi();
  } catch (e) {
    // Running outside VSCode context
    console.warn('VSCode API not available - running in browser mode');
  }
  
  // ✅ CRITICAL FIX: Use injected data instead of fetch
  let analysisData = window.analysisData || null;
  
  // DOM elements
  const noDataEl = document.getElementById('no-data');
  const resultsEl = document.getElementById('results');
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    // Check if we have data available
    if (analysisData) {
      renderAnalysisData();
    } else {
      // Fallback: listen for postMessage (for backward compatibility)
      if (vscode) {
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'setAnalysisData') {
            analysisData = message.data;
            renderAnalysisData();
          }
        });
      } else {
        showError('No analysis data available');
      }
    }
  });
  
  function showError(message) {
    if (noDataEl) {
      noDataEl.innerHTML = `<p>Error: ${message}</p>`;
      noDataEl.style.display = 'block';
    }
    if (resultsEl) {
      resultsEl.style.display = 'none';
    }
  }
  
  function renderAnalysisData() {
    if (!analysisData) {
      return;
    }
    
    console.log('Rendering analysis data:', analysisData);
    
    // Update page title and hide the no-data message
    if (document.querySelector('.subtitle')) {
      document.querySelector('.subtitle').textContent = 
        `${analysisData.fileName} (${analysisData.language}) - Analyzed on ${analysisData.timestamp}`;
    }
    
    if (noDataEl) {
      noDataEl.classList.add('hidden');
      noDataEl.style.display = 'none';
    }
    if (resultsEl) {
      resultsEl.classList.remove('hidden');
      resultsEl.style.display = 'block';
    }
    
    // Update basic metrics
    const basicMetrics = {
      'total-lines': analysisData.totalLines || 0,
      'code-lines': analysisData.codeLines || 0,
      'comment-lines': analysisData.commentLines || 0,
      'blank-lines': analysisData.blankLines || 0,
      'function-count': analysisData.functionCount || 0,
      'class-count': analysisData.classCount || 0
    };
    
    Object.entries(basicMetrics).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value.toString();
      }
    });
    
    // Update complexity metrics
    const complexity = analysisData.complexity || {};
    const functions = analysisData.functions || [];
    
    // Calculate high complexity count
    const highComplexityCount = functions.filter(f => (f.complexity || 0) > 10).length;
    
    const complexityMetrics = {
      'avg-complexity': (complexity.averageComplexity || 0).toFixed(2),
      'max-complexity': complexity.maxComplexity || 0
    };
    
    Object.entries(complexityMetrics).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value.toString();
      }
    });
    
    // ✅ FIXED: Update both high complexity count elements with unique IDs
    const summaryCountEl = document.getElementById('high-complexity-count-summary');
    if (summaryCountEl) {
      summaryCountEl.textContent = highComplexityCount.toString();
    }
    
    const ccnCountEl = document.getElementById('high-complexity-count-ccn');
    if (ccnCountEl) {
      ccnCountEl.textContent = highComplexityCount.toString();
    }
    
    // Update complexity summary
    updateComplexitySummary(functions);
    
    // Update functions table
    updateFunctionsTable(functions);
    
    // Update complexity distribution
    updateComplexityDistribution(functions);
    
    // Create complexity chart
    createComplexityChart(functions);
    
    // Update density visualization
    updateDensityVisualization(functions);
    
    console.log('Analysis data rendered successfully');
  }
  
  function updateComplexitySummary(functions) {
    if (functions.length === 0) {
      return;
    }
    
    const sortedByComplexity = [...functions].sort((a, b) => (b.complexity || 0) - (a.complexity || 0));
    const highest = sortedByComplexity[0];
    const lowest = sortedByComplexity[sortedByComplexity.length - 1];
    const highCount = functions.filter(f => (f.complexity || 0) > 10).length;
    
    const summaryElements = {
      'highest-ccn-function': highest?.name || '-',
      'highest-ccn-value': highest ? `CCN: ${highest.complexity}` : '-',
      'lowest-ccn-function': lowest?.name || '-',
      'lowest-ccn-value': lowest ? `CCN: ${lowest.complexity}` : '-',
      'high-complexity-warning': highCount > 0 ? `${highCount} function(s) need attention` : 'All functions are low complexity'
    };
    
    Object.entries(summaryElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }
  
  function updateFunctionsTable(functions) {
    const tbody = document.getElementById('functions-body');
    if (!tbody) {
      return;
    }
    
    if (functions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">No functions found</td></tr>';
      return;
    }
    
    tbody.innerHTML = functions.map((func, index) => {
      const complexityClass = getComplexityClass(func.complexity || 0);
      const density = func.cyclomaticDensity || 0;
      const densityClass = getDensityClass(density);
      const densityFormatted = density.toFixed(3);
      
      return `
        <tr>
          <td class="function-name clickable" data-function-index="${index}">${func.name || 'Unknown'}</td>
          <td>${func.lineStart || 0}</td>
          <td>${func.lineEnd || 0}</td>
          <td>${func.lineCount || 0}</td>
          <td>${func.parameters || 0}</td>
          <td class="complexity ${complexityClass}">${func.complexity || 0}</td>
          <td class="density ${densityClass}">${densityFormatted}</td>
        </tr>
      `;
    }).join('');
    
    // Add click event listeners to function names
    const functionNameCells = tbody.querySelectorAll('.function-name.clickable');
    functionNameCells.forEach(cell => {
      cell.addEventListener('click', (event) => {
        const functionIndex = parseInt(event.target.dataset.functionIndex);
        const functionData = functions[functionIndex];
        if (functionData) {
          openFunctionDetails(functionData);
        }
      });
    });
  }
  
  function updateComplexityDistribution(functions) {
    const distribution = {
      simple: 0,    // 1-5
      moderate: 0,  // 6-10
      complex: 0,   // 11-20
      veryComplex: 0 // 21+
    };
    
    functions.forEach(func => {
      const ccn = func.complexity || 0;
      if (ccn <= 5) {
        distribution.simple++;
      } else if (ccn <= 10) {
        distribution.moderate++;
      } else if (ccn <= 20) {
        distribution.complex++;
      } else {
        distribution.veryComplex++;
      }
    });
    
    const distributionElements = {
      'simple-count': distribution.simple,
      'moderate-count': distribution.moderate,
      'complex-count': distribution.complex,
      'very-complex-count': distribution.veryComplex
    };
    
    Object.entries(distributionElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value.toString();
      }
    });
  }
  
  function createComplexityChart(functions) {
    const canvas = document.getElementById('complexityChart');
    if (!canvas || !window.Chart) {
      console.log('Chart.js not available or canvas not found');
      return;
    }
    
    const distribution = {
      simple: 0,    // 1-5
      moderate: 0,  // 6-10
      complex: 0,   // 11-20
      veryComplex: 0 // 21+
    };
    
    functions.forEach(func => {
      const ccn = func.complexity || 0;
      if (ccn <= 5) {
        distribution.simple++;
      } else if (ccn <= 10) {
        distribution.moderate++;
      } else if (ccn <= 20) {
        distribution.complex++;
      } else {
        distribution.veryComplex++;
      }
    });
    
    const data = {
      labels: ['Simple (1-5)', 'Moderate (6-10)', 'Complex (11-20)', 'Very Complex (21+)'],
      datasets: [{
        data: [distribution.simple, distribution.moderate, distribution.complex, distribution.veryComplex],
        backgroundColor: [
          '#27ae60', // Simple - green
          '#f39c12', // Moderate - orange
          '#e67e22', // Complex - dark orange
          '#e74c3c'  // Very Complex - red
        ],
        borderWidth: 2,
        borderColor: '#2c3e50'
      }]
    };
    
    new Chart(canvas, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  function updateDensityVisualization(functions) {
    if (functions.length === 0) {
      return;
    }
    
    // Calculate average cyclomatic density
    const densities = functions.map(f => f.cyclomaticDensity || 0).filter(d => d > 0);
    const avgDensity = densities.length > 0 ? 
      densities.reduce((sum, d) => sum + d, 0) / densities.length : 0;
    
    const densityValue = document.getElementById('density-value');
    const densityFill = document.getElementById('density-fill');
    
    if (densityValue) {
      densityValue.textContent = avgDensity.toFixed(3);
    }
    
    if (densityFill) {
      // Scale density to percentage (assuming max density of 1.0 = 100%)
      const percentage = Math.min(avgDensity * 100, 100);
      densityFill.style.width = `${percentage}%`;
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
    return 'very-complex';
  }
  
  function getDensityClass(density) {
    if (density <= 0.25) {
      return 'density-low';
    }
    if (density <= 0.5) {
      return 'density-medium';
    }
    return 'density-high';
  }

  function openFunctionDetails(functionData) {
    console.log('Opening function details for:', functionData.name);
    
    // Send message to extension to open function details panel
    if (vscode) {
      vscode.postMessage({
        command: 'openFunctionDetails',
        data: {
          function: functionData,
          fileName: analysisData ? analysisData.fileName : 'Unknown',
          filePath: analysisData ? analysisData.filePath : '',
          language: analysisData ? analysisData.language : 'Unknown'
        }
      });
    } else {
      console.warn('VSCode API not available - simulating function details open');
      // For browser testing, show an alert
      const complexity = functionData.complexity || 0;
      const density = functionData.cyclomaticDensity ? functionData.cyclomaticDensity.toFixed(3) : '0.000';
      alert(`Function Details for: ${functionData.name}\n\nMetrics:\n- Complexity: ${complexity}\n- Density: ${density}\n- Lines: ${functionData.lineCount || 0}\n- Parameters: ${functionData.parameters || 0}\n\nIn VS Code, this would open a detailed analysis panel.`);
    }
  }
})();