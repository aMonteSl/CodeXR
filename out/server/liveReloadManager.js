"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectLiveReloadScript = injectLiveReloadScript;
exports.injectVisualizationLiveReloadScript = injectVisualizationLiveReloadScript;
exports.injectHTMLLiveReloadScript = injectHTMLLiveReloadScript;
exports.notifyClientsAnalysisUpdated = notifyClientsAnalysisUpdated;
exports.notifyClientsDataRefresh = notifyClientsDataRefresh;
exports.notifyClients = notifyClients;
exports.addSSEClient = addSSEClient;
exports.removeSSEClient = removeSSEClient;
exports.notifyClientsHTMLUpdated = notifyClientsHTMLUpdated;
// Global store for SSE clients
let sseClients = [];
/**
 * Injects a unified LiveReload script that handles both analysis and visualization updates
 */
function injectLiveReloadScript(htmlContent) {
    // Extended list of selectors and components that combines both cases
    const scriptContent = createBaseLiveReloadScript({
        id: '__LIVE_RELOAD_CLIENT__',
        // List of events to listen for (now listens to both)
        eventName: ['analysisUpdated', 'dataRefresh'],
        // Combined selectors for data
        dataSelector: ['#data', '[babia-queryjson]'],
        // Combined selectors for charts
        chartSelector: ['#chart', '[babia-bars]', '[babia-cylinders]', '[babia-pie]', '[babia-donut]', '[babia-barsmap]'],
        // All supported component types
        componentTypes: ['babia-bars', 'babia-cylinders', 'babia-pie', 'babia-donut', 'babia-barsmap'],
        logPrefix: '🔄'
    });
    // Inject in exclusive mode to ensure only one script exists
    return injectCustomScript(htmlContent, '__LIVE_RELOAD_CLIENT__', scriptContent, true);
}
/**
 * Alias for compatibility with existing code - now calls the unified function
 * @deprecated Use injectLiveReloadScript instead
 */
function injectVisualizationLiveReloadScript(htmlContent) {
    console.log('⚠️ injectVisualizationLiveReloadScript is deprecated, using unified injectLiveReloadScript');
    return injectLiveReloadScript(htmlContent);
}
/**
 * Creates a base live reload script with given options
 */
function createBaseLiveReloadScript(options) {
    const { id, eventName, dataSelector = '[babia-queryjson]', chartSelector = '[babia-bars], [babia-cylinders], [babia-pie], [babia-donut], [babia-barsmap]', componentTypes = ['babia-bars', 'babia-cylinders', 'babia-pie', 'babia-donut', 'babia-barsmap'], logPrefix = '🔵' } = options;
    // Convert selectors to arrays for consistent handling
    const dataSelectors = Array.isArray(dataSelector) ? dataSelector : [dataSelector];
    const chartSelectors = Array.isArray(chartSelector) ? chartSelector : [chartSelector];
    // Handle multiple event names
    const eventNames = Array.isArray(eventName) ? eventName : [eventName];
    // Create event listeners for each event name
    const eventListeners = eventNames.map(name => `
    // Handle ${name} events
    eventSource.addEventListener('${name}', function(event) {
      console.log('${logPrefix} Received ${name} event:', event);
      
      // Find data entities using all provided selectors
      let dataEntities = [];
      ${dataSelectors.map(selector => `
      dataEntities = [...dataEntities, ...document.querySelectorAll('${selector}')];`).join('')}
      
      // Find chart entities using all provided selectors
      let chartEntities = [];
      ${chartSelectors.map(selector => `
      chartEntities = [...chartEntities, ...document.querySelectorAll('${selector}')];`).join('')}
      
      if (dataEntities.length > 0) {
        const timestamp = Date.now();
        console.log('🔄 Refreshing ' + dataEntities.length + ' data entities');
        
        // Update each data entity
        dataEntities.forEach(dataEntity => {
          // Get current attributes
          const queryjson = dataEntity.getAttribute('babia-queryjson');
          if (queryjson) {
            // Add cache busting parameter
            const urlStr = typeof queryjson === 'string' ? queryjson : queryjson.url || '';
            let url = '';
            
            if (typeof urlStr === 'string') {
              url = urlStr.split('?')[0] + '?t=' + timestamp;
            }
            
            // Handle both string and object attributes
            if (typeof queryjson === 'string') {
              dataEntity.setAttribute('babia-queryjson', url);
            } else {
              const newAttr = { ...queryjson };
              newAttr.url = url;
              dataEntity.setAttribute('babia-queryjson', newAttr);
            }
            
            // Trigger data refresh event after a short delay
            setTimeout(() => {
              dataEntity.emit('data-loaded', {});
              console.log('📊 Data entity refreshed');
            }, 100);
          }
        });

        // Rebuild charts after data is loaded
        setTimeout(() => {
          chartEntities.forEach(chartEntity => {
            // Find which component type is used
            for (const type of ${JSON.stringify(componentTypes)}) {
              if (chartEntity.hasAttribute(type)) {
                const attributes = chartEntity.getAttribute(type);
                console.log('🔄 Rebuilding ' + type + ' chart');
                
                // Remove and re-add component to force refresh
                chartEntity.removeAttribute(type);
                setTimeout(() => {
                  chartEntity.setAttribute(type, attributes);
                  console.log('✅ Chart rebuilt successfully');
                }, 50);
                break;
              }
            }
          });
        }, 200);
      } else {
        console.warn('⚠️ No data entities found for refresh');
      }
    });
  `).join('\n');
    return `
  <script id="${id}">
    console.log('${logPrefix} Setting up EventSource for unified live reload...');

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
      console.log('🟢 EventSource connection established');
    };

    eventSource.onerror = function(err) {
      console.error('🔴 EventSource error:', err);
      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        eventSource.close();
        new EventSource('/live-reload');
      }, 3000);
    };

    ${eventListeners}

    // Handle general reload messages
    eventSource.onmessage = function(event) {
      console.log('Generic message received:', event.data);
      
      // Skip reload if in XR mode
      if (checkXRMode()) {
        console.log('⛔ Blocking page reload in XR mode');
        return false;
      }
      
      if (event.data === 'reload') {
        console.log('💫 Live reload triggered, refreshing page...');
        window.location.reload();
      }
    };
  </script>
  `;
}
/**
 * Injects a specialized LiveReload script for HTML/DOM visualizations
 * This handles updates to babia-html components separately from data-based charts
 */
function injectHTMLLiveReloadScript(htmlContent) {
    const scriptContent = createHTMLLiveReloadScript({
        id: '__LIVE_RELOAD_CLIENT_HTML__',
        eventName: 'htmlUpdated',
        htmlSelector: '[babia-html]',
        logPrefix: '🌐'
    });
    // Inject in exclusive mode to prevent conflicts
    return injectCustomScript(htmlContent, '__LIVE_RELOAD_CLIENT_HTML__', scriptContent, true);
}
/**
 * Creates a specialized live reload script for HTML-based visualizations
 */
function createHTMLLiveReloadScript(options) {
    const { id, eventName, htmlSelector, logPrefix } = options;
    return `
  <script id="${id}">
    console.log('${logPrefix} Setting up EventSource for HTML live reload...');

    const eventSource = new EventSource('/live-reload');
    let isXRMode = false;

    function checkXRMode() {
      isXRMode = !!document.querySelector('a-scene');
      console.log(isXRMode ? '🥽 XR mode detected' : '🖥️ Standard mode detected');
      return isXRMode;
    }

    document.addEventListener('DOMContentLoaded', checkXRMode);

    eventSource.onopen = function () {
      console.log('🟢 HTML EventSource connection established');
    };

    eventSource.onerror = function (err) {
      console.error('🔴 HTML EventSource error:', err);
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect HTML EventSource...');
        eventSource.close();
        new EventSource('/live-reload');
      }, 3000);
    };

    eventSource.addEventListener('${eventName}', function (event) {
      console.log('${logPrefix} Received ${eventName} event:', event);

      const htmlEntities = document.querySelectorAll('${htmlSelector}');
      if (htmlEntities.length === 0) {
        console.warn('⚠️ No HTML entities found for refresh');
        return;
      }

      console.log('🔄 Refreshing ' + htmlEntities.length + ' HTML entities');

      htmlEntities.forEach((htmlEntity, index) => {
        console.log('🌐 Updating babia-html entity #' + index);

        let newHtmlContent = '';
        try {
          const eventData = JSON.parse(event.data);
          newHtmlContent = eventData.htmlContent || '';
        } catch (e) {
          console.warn('⚠️ Could not parse HTML update event data');
          return;
        }

        if (!newHtmlContent) {
          console.warn('⚠️ No new HTML content provided');
          return;
        }

        const newConfig = {
          renderHTML: true,
          renderHTMLOnlyLeafs: true,
          distanceLevels: 0.7,
          html: newHtmlContent
        };

        try {
          console.log('🔧 Setting new babia-html component config...');
          htmlEntity.setAttribute('babia-html', newConfig);

          // Force component update
          const component = htmlEntity.components['babia-html'];
          if (component && typeof component.update === 'function') {
            console.log('🔄 Manually triggering update()...');
            component.update();
          }

          console.log('✅ babia-html component updated with new HTML');
        } catch (error) {
          console.error('❌ Failed to update babia-html component:', error);
        }
      });
    });

    eventSource.onmessage = function (event) {
      console.log('Generic HTML message received:', event.data);

      if (checkXRMode()) {
        console.log('⛔ Blocking page reload in XR mode (HTML visualization)');
        return false;
      }

      if (event.data === 'reload') {
        console.log('💫 HTML Live reload triggered, refreshing page...');
        window.location.reload();
      }
    };
  </script>
  `;
}
/**
 * Helper function to inject a script into HTML and ensure no duplicate scripts
 */
function injectCustomScript(htmlContent, scriptId, scriptContent, exclusiveMode = false) {
    // Check if this script is already injected
    if (htmlContent.includes(scriptId)) {
        return htmlContent;
    }
    // In exclusive mode, remove any other live reload scripts
    if (exclusiveMode) {
        // List of all possible live reload script IDs
        const liveReloadScriptIds = [
            '__LIVE_RELOAD_CLIENT__',
            '__VISUALIZATION_LIVE_RELOAD_CLIENT__'
        ];
        // Remove other script IDs from the list
        const otherScriptIds = liveReloadScriptIds.filter(id => id !== scriptId);
        // Check and remove each other script
        let processedHtml = htmlContent;
        for (const otherId of otherScriptIds) {
            if (processedHtml.includes(otherId)) {
                console.log(`Removing existing script ${otherId} to avoid conflicts`);
                // Simple removal approach - find the script tag containing the ID and remove it
                const startTag = `<script id="${otherId}">`;
                const endTag = `</script>`;
                const startIndex = processedHtml.indexOf(startTag);
                if (startIndex !== -1) {
                    const endIndex = processedHtml.indexOf(endTag, startIndex) + endTag.length;
                    if (endIndex > startTag.length) {
                        processedHtml = processedHtml.substring(0, startIndex) + processedHtml.substring(endIndex);
                    }
                }
            }
        }
        htmlContent = processedHtml;
    }
    // Insert the script before the closing </body> tag
    return htmlContent.replace('</body>', `${scriptContent}\n</body>`);
}
/**
 * Server-side functions for client notifications
 */
function notifyClientsAnalysisUpdated() {
    sseClients.forEach(client => {
        try {
            client.write(`event: analysisUpdated\n`);
            client.write(`data: updated\n\n`);
            console.log('Sent analysisUpdated event to client');
        }
        catch (error) {
            console.error('Error sending SSE analysis update:', error);
        }
    });
}
function notifyClientsDataRefresh() {
    sseClients.forEach(client => {
        try {
            client.write(`event: dataRefresh\n`);
            client.write(`data: refreshed\n\n`);
            console.log('Sent dataRefresh event to client');
        }
        catch (error) {
            console.error('Error sending SSE data refresh:', error);
        }
    });
}
function notifyClients() {
    sseClients.forEach(client => {
        client.write('data: reload\n\n');
    });
}
function addSSEClient(client) {
    sseClients.push(client);
}
function removeSSEClient(client) {
    sseClients = sseClients.filter(c => c !== client);
}
function notifyClientsHTMLUpdated(htmlContent) {
    sseClients.forEach(client => {
        try {
            client.write(`event: htmlUpdated\n`);
            client.write(`data: ${JSON.stringify({ htmlContent })}\n\n`);
            console.log('Sent htmlUpdated event to client with new HTML content');
        }
        catch (error) {
            console.error('Error sending SSE HTML update:', error);
        }
    });
}
//# sourceMappingURL=liveReloadManager.js.map