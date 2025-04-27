"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectLiveReloadScript = injectLiveReloadScript;
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