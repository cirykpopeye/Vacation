import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runSearch } from './search.js';
import { validateBody, toV1, ApiError } from './validate.js';

const PUBLIC = join(fileURLToPath(new URL('..', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript' };
const hits = new Map(); // rate-limit buckets: id -> [timestamps]

function send(res, status, obj, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }).end(JSON.stringify(obj));
}
function cors(req) {
  const allow = process.env.CORS_ORIGIN; // e.g. "https://my-system.example" or "*"
  if (!allow) return {};
  return { 'access-control-allow-origin': allow, 'access-control-allow-headers': 'authorization,x-api-key,content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS' };
}
function authorize(req) {
  const want = process.env.API_KEY;
  if (!want) return 'anon';
  const got = (req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')).toString();
  const a = Buffer.from(got), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'unauthorized', 'missing or invalid API key');
  return 'key';
}
function rateLimit(id) {
  const max = Number(process.env.RATE_LIMIT_PER_MIN || 20), now = Date.now();
  const list = (hits.get(id) || []).filter((t) => now - t < 60e3);
  if (list.length >= max) throw new ApiError(429, 'rate_limited', `max ${max} searches per minute`);
  list.push(now); hits.set(id, list);
}
async function readBody(req) {
  let size = 0, body = '';
  for await (const c of req) { size += c.length; if (size > 20_000) throw new ApiError(413, 'too_large', 'body too large'); body += c; }
  try { return JSON.parse(body || '{}'); } catch { throw new ApiError(400, 'invalid_json', 'body is not valid JSON'); }
}

export function createApp() {
  return http.createServer(async (req, res) => {
    const headers = cors(req);
    const path = req.url.split('?')[0];
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, headers).end(); return; }
      if (path === '/api/v1/health') { send(res, 200, { status: 'ok' }, headers); return; }
      if (path === '/api/v1/search') {
        if (req.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'use POST');
        authorize(req);
        rateLimit(req.socket.remoteAddress || 'unknown');
        const input = validateBody(await readBody(req));
        send(res, 200, toV1(await runSearch(input)), headers);
        return;
      }
      if (path.startsWith('/api/')) throw new ApiError(404, 'not_found', 'unknown endpoint');
      const file = path === '/' ? '/index.html' : path;
      if (file.includes('..')) throw new ApiError(400, 'invalid_request', 'bad path');
      const data = await readFile(join(PUBLIC, file));
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(data);
    } catch (e) {
      if (e instanceof ApiError) return send(res, e.status, { error: { code: e.code, message: e.message } }, headers);
      if (e.code === 'ENOENT') return send(res, 404, { error: { code: 'not_found', message: 'not found' } }, headers);
      console.error(e);
      send(res, 502, { error: { code: 'upstream_error', message: 'search failed, try again' } }, headers);
    }
  });
}
