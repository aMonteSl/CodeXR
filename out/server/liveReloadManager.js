"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectLiveReloadScript = injectLiveReloadScript;
exports.injectVisualizationLiveReloadScript = injectVisualizationLiveReloadScript;
exports.notifyClientsAnalysisUpdated = notifyClientsAnalysisUpdated;
exports.notifyClientsDataRefresh = notifyClientsDataRefresh;
exports.notifyClients = notifyClients;
exports.addSSEClient = addSSEClient;
exports.removeSSEClient = removeSSEClient;
// Global store for SSE clients
let sseClients = [];
/**
 * Injects the LiveReload script into HTML content if not already present
 * @param htmlContent Original HTML content
 * @returns HTML with LiveReload script injected
 */
function injectLiveReloadScript(htmlContent) {
    // Check if the script is already injected
    if (htmlContent.includes('__LIVE_RELOAD_CLIENT__')) {
        return htmlContent;
    }
    // Create the live reload script with the proven working implementation
    const liveReloadScript = `
  <script id="__LIVE_RELOAD_CLIENT__">
    console.log('🔵 Setting up EventSource...');

    const eventSource = new EventSource('/live-reload');

    eventSource.onopen = function() {
        console.log('🟢 EventSource connection established');
    };

    eventSource.onerror = function(err) {
        console.error('🔴 EventSource error:', err);
    };

    eventSource.addEventListener('analysisUpdated', function(event) {
        console.log('⚡ Received analysisUpdated event:', event);

        const timestamp = Date.now();
        const dataEntity = document.querySelector('#data');
        const chartEntity = document.querySelector('#chart');

        if (dataEntity) {
            console.log('🔵 Forcing data reload with cache busting...');

            dataEntity.setAttribute('babia-queryjson', {
                url: './data.json?t=' + timestamp
            });

            setTimeout(() => {
                dataEntity.emit('data-loaded', {});

                if (chartEntity) {
                    const attributes = chartEntity.getAttribute('babia-bars');
                    console.log('🔵 Rebuilding chart with attributes:', attributes);

                    chartEntity.removeAttribute('babia-bars');

                    setTimeout(() => {
                        chartEntity.setAttribute('babia-bars', attributes);
                        console.log('✅ Chart rebuilt successfully');
                    }, 50);
                }
            }, 100);
        } else {
            console.warn('⚠️ dataEntity not found');
        }
    });

    // Only reload regular pages, not XR pages
    eventSource.onmessage = function(event) {
      console.log('Generic message received:', event.data);
      
      // Check if we're in XR mode (detected by presence of A-Frame scene)
      const isXRMode = !!document.querySelector('a-scene');
      
      if (isXRMode) {
        console.log('⛔ Blocking page reload in XR mode');
        return false;
      } else if (event.data === 'reload') {
        console.log('💫 Live reload triggered, refreshing page...');
        window.location.reload();
      }
    };
  </script>
  `;
    // Insert the script before the closing </body> tag
    return htmlContent.replace('</body>', `${liveReloadScript}\n</body>`);
}
/**
 * Injects a visualization-specific LiveReload script into HTML content
 * Does not modify the existing injectLiveReloadScript function
 * @param htmlContent Original HTML content
 * @returns HTML with Visualization LiveReload script injected
 */
function injectVisualizationLiveReloadScript(htmlContent) {
    // Check if the script is already injected
    if (htmlContent.includes('__VISUALIZATION_LIVE_RELOAD_CLIENT__')) {
        return htmlContent;
    }
    // Create a completely separate script for visualization reloading
    const visualizationLiveReloadScript = `
  <script id="__VISUALIZATION_LIVE_RELOAD_CLIENT__">
    console.log('🔵 Setting up BabiaXR Visualization LiveReload...');

    const eventSource = new EventSource('/live-reload');
    let isXRMode = false;

    // Check if we're in an A-Frame scene
    function checkXRMode() {
      isXRMode = !!document.querySelector('a-scene');
      console.log(isXRMode ? '🥽 XR mode detected' : '🖥️ Standard mode detected');
      return isXRMode;
    }

    document.addEventListener('DOMContentLoaded', checkXRMode);

    eventSource.onopen = function() {
      console.log('🟢 Visualization LiveReload connected');
    };

    eventSource.onerror = function(err) {
      console.error('🔴 Visualization LiveReload error:', err);
      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        eventSource.close();
        new EventSource('/live-reload');
      }, 3000);
    };

    // Handle data refresh events (JSON changes)
    eventSource.addEventListener('dataRefresh', function(event) {
      console.log('📊 Visualization data refresh event received');
      
      // Get all babia-queryjson elements
      const dataEntities = document.querySelectorAll('[babia-queryjson]');
      const chartEntities = document.querySelectorAll('[babia-bars], [babia-cylinders], [babia-pie], [babia-donut], [babia-barsmap]');
      
      if (dataEntities.length > 0) {
        const timestamp = Date.now();
        console.log('🔄 Refreshing ' + dataEntities.length + ' visualization data entities');
        
        // Update each data entity
        dataEntities.forEach(dataEntity => {
          // Get current attributes
          const queryjson = dataEntity.getAttribute('babia-queryjson');
          if (queryjson) {
            // Add cache busting parameter
            const urlStr = queryjson.url || '';
            const url = urlStr.split('?')[0] + '?t=' + timestamp;
            
            // Create new attributes object with updated URL
            const newAttr = { ...queryjson };
            newAttr.url = url;
            
            // Update the attribute
            dataEntity.setAttribute('babia-queryjson', newAttr);
            
            setTimeout(() => {
              // Trigger data refresh event
              dataEntity.emit('data-loaded', {});
              console.log('📊 Visualization data entity refreshed');
            }, 100);
          }
        });

        // Rebuild charts
        setTimeout(() => {
          chartEntities.forEach(chartEntity => {
            // Find which component type is used
            const componentTypes = ['babia-bars', 'babia-cylinders', 'babia-pie', 'babia-donut', 'babia-barsmap'];
            for (const type of componentTypes) {
              if (chartEntity.hasAttribute(type)) {
                const attributes = chartEntity.getAttribute(type);
                console.log('🔄 Rebuilding visualization ' + type + ' chart');
                
                // Remove and re-add component to force refresh
                chartEntity.removeAttribute(type);
                setTimeout(() => {
                  chartEntity.setAttribute(type, attributes);
                  console.log('✅ Visualization chart rebuilt');
                }, 50);
                break;
              }
            }
          });
        }, 200);
      }
    });

    // Handle HTML changes
    eventSource.onmessage = function(event) {
      // Skip reload if in XR mode
      if (checkXRMode()) {
        console.log('⛔ Blocking visualization page reload in XR mode');
        return;
      }
      
      if (event.data === 'reload') {
        console.log('💫 Visualization live reload triggered, refreshing page...');
        window.location.reload();
      }
    };
  </script>
  `;
    // Insert the script before the closing </body> tag
    return htmlContent.replace('</body>', `${visualizationLiveReloadScript}\n</body>`);
}
/**
 * Notifies all SSE clients that analysis data has been updated
 */
function notifyClientsAnalysisUpdated() {
    sseClients.forEach(client => {
        try {
            // Send in exactly this format to match what Express server does
            client.write(`event: analysisUpdated\n`);
            client.write(`data: updated\n\n`);
            console.log('Sent analysisUpdated event to client');
        }
        catch (error) {
            console.error('Error sending SSE analysis update:', error);
        }
    });
}
/**
 * Notifies all SSE clients that data has been refreshed
 */
function notifyClientsDataRefresh() {
    sseClients.forEach(client => {
        try {
            // Send event for data refresh (different from analysis update)
            client.write(`event: dataRefresh\n`);
            client.write(`data: refreshed\n\n`);
            console.log('Sent dataRefresh event to client');
        }
        catch (error) {
            console.error('Error sending SSE data refresh:', error);
        }
    });
}
/**
 * Notifies all SSE clients to reload the page
 */
function notifyClients() {
    sseClients.forEach(client => {
        client.write('data: reload\n\n');
    });
}
/**
 * Adds a client to the SSE clients list
 * @param client The SSE client response object to add
 */
function addSSEClient(client) {
    sseClients.push(client);
}
/**
 * Removes a client from the SSE clients list
 * @param client The SSE client response object to remove
 */
function removeSSEClient(client) {
    sseClients = sseClients.filter(c => c !== client);
}
//# sourceMappingURL=liveReloadManager.js.map