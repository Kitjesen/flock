'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT       = parseInt(process.env.CHAT_PORT  || '3457', 10);
const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '3456', 10);
const HTML_FILE  = path.join(__dirname, 'public', 'index.html');

const server = http.createServer((req, res) => {
  // ── Serve UI ──────────────────────────────────────────────────
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(HTML_FILE);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500);
      return res.end('Chat UI not found: ' + HTML_FILE);
    }
  }

  // ── Proxy /v1/* → maxproxy ────────────────────────────────────
  if (req.url.startsWith('/v1/')) {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = { ...req.headers, host: `${PROXY_HOST}:${PROXY_PORT}` };
      delete headers['content-length'];
      if (body.length) headers['content-length'] = Buffer.byteLength(body);

      const proxyReq = http.request(
        { hostname: PROXY_HOST, port: PROXY_PORT, path: req.url, method: req.method, headers },
        proxyRes => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on('error', err => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `MaxProxy unreachable: ${err.message}`, type: 'proxy_error' } }));
        }
      });
      if (body.length) proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[FLOCK Chat] http://127.0.0.1:${PORT}`);
});
