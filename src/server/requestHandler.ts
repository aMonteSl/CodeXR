import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { 
  injectLiveReloadScript, 
  addSSEClient, 
  removeSSEClient 
} from './liveReloadManager';

/**
 * Handles live reload requests
 * @param req Incoming HTTP request
 * @param res HTTP response
 */
function handleLiveReload(req: http.IncomingMessage, res: http.ServerResponse): void {
  // Set headers for an SSE connection
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  
  // Register this response as an active SSE client
  addSSEClient(res);
  
  // When the client closes the connection, remove it from the list
  req.on('close', () => {
    removeSSEClient(res);
  });
}

/**
 * Determines the content type based on file extension
 * @param ext File extension
 * @returns Content type
 */
function getContentType(ext: string): string {
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
  return mimeTypes[ext] || 'text/plain';
}

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
    // Get URL path or default to '/'
    let urlPath = req.url || '/';
    
    // Handle default route
    if (urlPath === '/') {
      urlPath = '/' + path.basename(selectedFile);
    }
    
    // Handle livereload endpoint
    if (urlPath === '/livereload') {
      handleLiveReload(req, res);
      return;
    }
    
    // Decode URL to handle spaces and special characters
    urlPath = decodeURIComponent(urlPath);
    
    // Clean up path to prevent directory traversal
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
    
    // Convert URL to file path
    let filePath: string;
    
    // Special handling for relative URLs that go outside the example folder
    if (safePath.includes('../../data/')) {
      // Handle paths going to the data directory outside the example folder
      const dataDir = path.join(path.dirname(fileDir), '..', 'data');
      const dataFile = path.basename(safePath);
      filePath = path.join(dataDir, dataFile);
      
      console.log(`Resolving data path: ${safePath} -> ${filePath}`);
    } else {
      // Normal path resolution
      filePath = path.join(fileDir, safePath.replace(/^\//, ''));
    }
    
    // Check if file exists
    fs.stat(filePath, (err, stats) => {
      if (err) {
        console.error(`File not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      
      // Get file extension and content type
      const ext = path.extname(filePath).toLowerCase();
      const contentType = getContentType(ext);
      
      // Read file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end(`Server Error: ${err.message}`);
          return;
        }
        
        // Process HTML content
        if (ext === '.html') {
          // Inject live reload script
          const processedData = injectLiveReloadScript(data.toString());
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(processedData);
        } else {
          // Serve other files as-is
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    });
  };
}