'use strict';
/**
 * TrustCheck server. Zero dependencies: only Node's built-in modules.
 * Run:  npm start   ->  http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const store = require('./lib/store');
const { verify } = require('./lib/verify');
const { OFFER_TYPES, CATEGORIES, STATUSES, validateReport } = require('./lib/reports');

// Optional .env support without extra packages.
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* ignore */ }

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const VERIFY_TYPES = ['internship', 'company', 'certificate'];

store.init();

/* ---------- helpers ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
const json = (res, status, data) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

function clientIp(req) {
  if (TRUST_PROXY) {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function readJson(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// Tiny in-memory rate limiter: `max` hits per `windowMs` per IP per bucket.
const hits = new Map();
function limited(bucket, ip, max, windowMs) {
  const key = bucket + '|' + ip;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) if (!arr.length || now - arr[arr.length - 1] > 3600000) hits.delete(k);
}, 600000).unref();

const publicReport = (r) => ({
  id: r.id, entityName: r.entityName, offerType: r.offerType, category: r.category,
  website: r.website, description: r.description, evidenceUrl: r.evidenceUrl,
  status: r.status, createdAt: r.createdAt, isDemo: !!r.isDemo,
});

/* ---------- API ---------- */

async function api(req, res, url) {
  const p = url.pathname;
  const ip = clientIp(req);

  if (req.method === 'GET' && p === '/api/meta') {
    return json(res, 200, { offerTypes: OFFER_TYPES, categories: CATEGORIES, statuses: STATUSES });
  }

  if (req.method === 'GET' && p === '/api/stats') {
    const ents = store.getEntities();
    const reps = store.getReports().filter((r) => r.status !== 'dismissed');
    const count = (k) => ents.filter((e) => e.kinds.includes(k)).length;
    return json(res, 200, {
      entities: { total: ents.length, company: count('company'), internship: count('internship'), certificate: count('certificate') },
      reports: {
        total: reps.length,
        pending: reps.filter((r) => r.status === 'pending').length,
        underReview: reps.filter((r) => r.status === 'under_review').length,
        reviewed: reps.filter((r) => r.status === 'reviewed').length,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && p === '/api/entities') {
    return json(res, 200, {
      items: store.getEntities().map((e) => ({ id: e.id, name: e.name, kinds: e.kinds, domains: e.domains, note: e.note })),
    });
  }

  if (req.method === 'POST' && p === '/api/verify') {
    if (limited('verify', ip, 60, 60000)) return json(res, 429, { error: 'Too many checks. Please wait a minute and try again.' });
    const body = await readJson(req);
    const query = String(body.query || '').trim();
    const type = String(body.type || 'company');
    const context = String(body.context || '').slice(0, 3000);
    if (query.length < 2 || query.length > 150) return json(res, 400, { error: 'Enter a name between 2 and 150 characters.' });
    if (!VERIFY_TYPES.includes(type)) return json(res, 400, { error: 'Unknown type.' });
    return json(res, 200, verify({ query, type, context }, store.getEntities(), store.getReports()));
  }

  if (req.method === 'GET' && p === '/api/reports') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const category = url.searchParams.get('category') || '';
    const status = url.searchParams.get('status') || '';
    const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 10));

    let list = store.getReports().filter((r) => r.status !== 'dismissed');
    if (category && CATEGORIES[category]) list = list.filter((r) => r.category === category);
    if (status && STATUSES[status] && status !== 'dismissed') list = list.filter((r) => r.status === status);
    if (q) list = list.filter((r) => `${r.entityName} ${r.description} ${r.website}`.toLowerCase().includes(q));
    list = [...list].sort((a, b) => (sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));

    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    return json(res, 200, { items: list.slice((page - 1) * limit, page * limit).map(publicReport), total, page, pages });
  }

  if (req.method === 'POST' && p === '/api/reports') {
    if (limited('report', ip, 5, 15 * 60000)) return json(res, 429, { error: 'You have submitted several reports recently. Please try again in a few minutes.' });
    const body = await readJson(req);
    // Honeypot: real users never fill this hidden field. Pretend success so bots learn nothing.
    if (body && body.companySite) return json(res, 201, { ok: true, id: crypto.randomUUID() });
    const result = validateReport(body);
    if (result.errors) return json(res, 400, { error: 'Please fix the highlighted fields.', errors: result.errors });
    const report = {
      id: crypto.randomUUID(), ...result.value, status: 'pending', createdAt: new Date().toISOString(),
    };
    await store.addReport(report);
    return json(res, 201, { ok: true, id: report.id });
  }

  // Moderation: PATCH /api/reports/:id  { "status": "reviewed" }  with header x-admin-token
  const m = /^\/api\/reports\/([0-9a-f-]{36})$/.exec(p);
  if (req.method === 'PATCH' && m) {
    const token = process.env.ADMIN_TOKEN || '';
    const given = String(req.headers['x-admin-token'] || '');
    const ok = token.length >= 8 && given.length === token.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token));
    if (!ok) return json(res, 403, { error: 'Admin access is disabled or the token is wrong.' });
    const body = await readJson(req);
    if (!STATUSES[body.status]) return json(res, 400, { error: 'Unknown status.' });
    const updated = await store.updateReport(m[1], { status: body.status });
    return updated ? json(res, 200, publicReport(updated)) : json(res, 404, { error: 'Report not found.' });
  }

  return json(res, 404, { error: 'Not found.' });
}

/* ---------- static files ---------- */

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- server ---------- */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) json(res, status, { error: status === 500 ? 'Something went wrong on the server.' : err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`TrustCheck running at http://localhost:${PORT}`));
}

module.exports = server;
