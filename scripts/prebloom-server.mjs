#!/usr/bin/env node
/**
 * Standalone Prebloom server for development
 * Runs on port 8080 (or PREBLOOM_PORT env var)
 */

import { createServer } from 'node:http';
import { handlePrebloomHttpRequest } from '../dist/prebloom/api/index.js';

const PORT = process.env.PREBLOOM_PORT || 4000;  // Dev: 4000, Docker: 8080

const server = createServer(async (req, res) => {
  // CORS headers for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle prebloom routes
  const handled = await handlePrebloomHttpRequest(req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[prebloom] Server running on http://localhost:${PORT}`);
  console.log(`[prebloom] Supabase: ${process.env.SUPABASE_URL ? 'configured' : 'NOT configured'}`);
});
