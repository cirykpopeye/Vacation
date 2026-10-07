import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tiny .env loader (no dependencies)
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const { runSearch } = await import('./lib/search.js');
const PUBLIC = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/search') {
      let body = '';
      for await (const c of req) body += c;
      const { prompt } = JSON.parse(body || '{}');
      if (!prompt || prompt.length > 1000) { res.writeHead(400).end(JSON.stringify({ error: 'prompt required (max 1000 chars)' })); return; }
      const result = await runSearch(prompt);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result));
      return;
    }
    const file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    if (file.includes('..')) { res.writeHead(400).end(); return; }
    const data = await readFile(join(PUBLIC, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(data);
  } catch (e) {
    const notFound = e.code === 'ENOENT';
    res.writeHead(notFound ? 404 : 500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: notFound ? 'not found' : e.message }));
  }
});
server.listen(process.env.PORT || 3000, () => console.log(`Vacation finder on http://localhost:${process.env.PORT || 3000}`));
