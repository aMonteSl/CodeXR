import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { 
  injectLiveReloadScript, 
  addSSEClient, 
  removeSSEClient 
} from './liveReloadManager';

/**
 * Creates the HTTP request handler function
 * @param fileDir Directory of the HTML file
 * @param selectedFile Path to the HTML file
 * @returns Request handler function
 */
export function createRequestHandler(
  fileDir: string, 
  selectedFile: string
): http.RequestListener {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Special endpoint for SSE connections (live reload)
    if (req.url === '/livereload') {
      // Set headers for an SSE connection
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');
      
      // Register this response as an active SSE client
      // Using the centralized client management in liveReloadManager
      addSSEClient(res);
      
      // When the client closes the connection, remove it from the list
      req.on('close', () => {
        removeSSEClient(res);
      });
      return;
    }

    // For all other routes, determine which file to serve
    let filePath = path.join(fileDir, req.url || '');
    // If the root ('/') is requested, serve the selected HTML file
    if (req.url === '/' || req.url === '') {
      filePath = selectedFile;
    }

    // Check if file exists
    fs.exists(filePath, exists => {
      if (!exists) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }

      // Determine MIME type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
      };
      const contentType = mimeTypes[ext] || 'text/plain';

      // Special handling for the main HTML file
      if (filePath === selectedFile && contentType === 'text/html') {
        // Read file as text
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error reading the file');
            return;
          }
          
          // Inject live reload script if not already present
          const injectedData = injectLiveReloadScript(data);
          
          // Send HTML with injected LiveReload script
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(injectedData);
        });
      } else {
        // For files other than the main HTML, serve them without modification
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error reading the file');
            return;
          }
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      }
    });
  };
}