import * as http from 'http';

// Global store for SSE clients
let sseClients: http.ServerResponse[] = [];

/**
 * Options for creating a live reload script
 */
interface LiveReloadOptions {
  id: string;                        // Script ID to prevent duplicates
  eventName: string | string[];      // Main event(s) to listen for
  dataSelector?: string | string[];  // CSS selector(s) for data entities
  chartSelector?: string | string[]; // CSS selector(s) for chart entities
  componentTypes?: string[];         // Component types to handle
  logPrefix?: string;                // Prefix for console logs
}

/**
 * Injects a unified LiveReload script that handles both analysis and visualization updates
 */
export function injectLiveReloadScript(htmlContent: string): string {
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
export function injectVisualizationLiveReloadScript(htmlContent: string): string {
  console.log('⚠️ injectVisualizationLiveReloadScript is deprecated, using unified injectLiveReloadScript');
  return injectLiveReloadScript(htmlContent);
}

/**
 * Creates a base live reload script with given options
 */
function createBaseLiveReloadScript(options: LiveReloadOptions): string {
  const {
    id,
    eventName,
    dataSelector = '[babia-queryjson]',
    chartSelector = '[babia-bars], [babia-cylinders], [babia-pie], [babia-donut], [babia-barsmap]',
    componentTypes = ['babia-bars', 'babia-cylinders', 'babia-pie', 'babia-donut', 'babia-barsmap'],
    logPrefix = '🔵'
  } = options;

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
 * Helper function to inject a script into HTML and ensure no duplicate scripts
 */
function injectCustomScript(htmlContent: string, scriptId: string, scriptContent: string, exclusiveMode: boolean = false): string {
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
export function notifyClientsAnalysisUpdated(): void {
  sseClients.forEach(client => {
    try {
      client.write(`event: analysisUpdated\n`);
      client.write(`data: updated\n\n`);
      console.log('Sent analysisUpdated event to client');
    } catch (error) {
      console.error('Error sending SSE analysis update:', error);
    }
  });
}

export function notifyClientsDataRefresh(): void {
  sseClients.forEach(client => {
    try {
      client.write(`event: dataRefresh\n`);
      client.write(`data: refreshed\n\n`);
      console.log('Sent dataRefresh event to client');
    } catch (error) {
      console.error('Error sending SSE data refresh:', error);
    }
  });
}

export function notifyClients(): void {
  sseClients.forEach(client => {
    client.write('data: reload\n\n');
  });
}

export function addSSEClient(client: http.ServerResponse): void {
  sseClients.push(client);
}

export function removeSSEClient(client: http.ServerResponse): void {
  sseClients = sseClients.filter(c => c !== client);
}