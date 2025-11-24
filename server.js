import http from 'http';
import fs from 'fs';
import path from 'path';
import { transformSync } from 'esbuild';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Normalize path
  let filePath = '.' + req.url.split('?')[0];
  if (filePath === './') filePath = './index.html';

  // Handle extensionless imports common in TS (e.g., import ... from './types')
  // Browser requests /types, we need to serve /types.ts
  let extname = path.extname(filePath);
  
  // Try to resolve file if extension is missing
  if (!fs.existsSync(filePath)) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      if (fs.existsSync(filePath + ext)) {
        filePath += ext;
        extname = ext;
        break;
      }
    }
  }

  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end(`File not found: ${req.url}`);
      return;
    }

    // Special handling for index.html to inject API_KEY
    if (filePath === './index.html') {
      let content = fs.readFileSync(filePath, 'utf-8');
      const apiKey = process.env.API_KEY || '';
      // Inject a shim for process.env so the frontend code works
      const shim = `<script>window.process = { env: { API_KEY: "${apiKey}" } };</script>`;
      // Insert before head or body
      content = content.replace('<head>', `<head>${shim}`);
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }

    // On-the-fly Transpilation for TS/TSX
    if (extname === '.ts' || extname === '.tsx') {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      try {
        const result = transformSync(rawContent, {
          loader: extname.slice(1), // 'ts' or 'tsx'
          format: 'esm', // Browser expects ES modules
          target: 'es2020',
          sourcemap: 'inline'
        });
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(result.code);
      } catch (e) {
        console.error("Transpile error:", e);
        res.writeHead(500);
        res.end(`Transpile Error: ${e.message}`);
      }
      return;
    }

    // Serve Static Files
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);

  } catch (error) {
    console.error(`Server error for ${filePath}:`, error);
    res.writeHead(500);
    res.end(`Server Error: ${error.code}`);
  }
});

server.listen(PORT, () => {
  console.log(`Zero-Chat Server running on port ${PORT}`);
});