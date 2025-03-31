"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectLiveReloadScript = injectLiveReloadScript;
exports.notifyClients = notifyClients;
exports.setSSEClients = setSSEClients;
exports.getSSEClients = getSSEClients;
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
    // Avoid duplication
    if (htmlContent.indexOf('<!-- LiveReload -->') !== -1) {
        return htmlContent;
    }
    const liveReloadScript = `<!-- LiveReload -->
<script>
  // Configuration for live reload
  const evtSource = new EventSource('/livereload');
  
  // Reload handler
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      window.location.reload();
    }
  };
  
  // Cleanup when closing
  window.addEventListener('beforeunload', function() {
    evtSource.close();
  });
</script>`;
    // Insert before body closing tag
    if (htmlContent.indexOf('</body>') !== -1) {
        return htmlContent.replace('</body>', `${liveReloadScript}\n</body>`);
    }
    else {
        return htmlContent + `\n${liveReloadScript}`;
    }
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
 * Sets the SSE clients list
 * @param clients The array of SSE client response objects
 */
function setSSEClients(clients) {
    sseClients = clients;
}
/**
 * Gets the current SSE clients list
 * @returns Array of SSE client response objects
 */
function getSSEClients() {
    return sseClients;
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