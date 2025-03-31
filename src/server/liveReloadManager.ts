import * as http from 'http';

// Global store for SSE clients
let sseClients: http.ServerResponse[] = [];

/**
 * Injects the LiveReload script into HTML content if not already present
 * @param htmlContent Original HTML content
 * @returns HTML with LiveReload script injected
 */
export function injectLiveReloadScript(htmlContent: string): string {
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
  } else {
    return htmlContent + `\n${liveReloadScript}`;
  }
}

/**
 * Notifies all SSE clients to reload the page
 */
export function notifyClients(): void {
  sseClients.forEach(client => {
    client.write('data: reload\n\n');
  });
}

/**
 * Sets the SSE clients list
 * @param clients The array of SSE client response objects
 */
export function setSSEClients(clients: http.ServerResponse[]): void {
  sseClients = clients;
}

/**
 * Gets the current SSE clients list
 * @returns Array of SSE client response objects
 */
export function getSSEClients(): http.ServerResponse[] {
  return sseClients;
}

/**
 * Adds a client to the SSE clients list
 * @param client The SSE client response object to add
 */
export function addSSEClient(client: http.ServerResponse): void {
  sseClients.push(client);
}

/**
 * Removes a client from the SSE clients list
 * @param client The SSE client response object to remove
 */
export function removeSSEClient(client: http.ServerResponse): void {
  sseClients = sseClients.filter(c => c !== client);
}