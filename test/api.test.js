'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Use a throwaway data directory so tests never touch real reports.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-'));
fs.copyFileSync(path.join(__dirname, '..', 'data', 'entities.json'), path.join(tmp, 'entities.json'));
process.env.DATA_DIR = tmp;

const server = require('../server');
let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
test.after(() => server.close());

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('serves the app and blocks path traversal', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /TrustCheck/);
  assert.equal((await fetch(base + '/..%2Fserver.js')).status === 200, false);
});

test('stats reflect real data', async () => {
  const s = await (await fetch(base + '/api/stats')).json();
  assert.ok(s.entities.total > 20);
  assert.equal(s.reports.total, 0);
});

test('verify endpoint validates input', async () => {
  assert.equal((await post('/api/verify', { query: 'a', type: 'company' })).status, 400);
  assert.equal((await post('/api/verify', { query: 'Infosys', type: 'nope' })).status, 400);
  const ok = await (await post('/api/verify', { query: 'Infosys', type: 'company' })).json();
  assert.equal(ok.verdict, 'VERIFIED');
});

test('report lifecycle: reject invalid, accept valid, list, filter, affects verification', async () => {
  const bad = await post('/api/reports', { entityName: 'x' });
  assert.equal(bad.status, 400);
  assert.ok((await bad.json()).errors.description);

  const good = { entityName: 'Shady Interns Ltd', offerType: 'internship', category: 'upfront_fee', description: 'They demanded a registration fee before sending any offer letter.', evidenceUrl: 'https://example.com/shot.png' };
  assert.equal((await post('/api/reports', good)).status, 201);

  const list = await (await fetch(base + '/api/reports?q=shady')).json();
  assert.equal(list.total, 1);
  assert.equal(list.items[0].status, 'pending');
  assert.equal((await (await fetch(base + '/api/reports?category=fake_certificate')).json()).total, 0);

  const v = await (await post('/api/verify', { query: 'Shady Interns', type: 'company' })).json();
  assert.equal(v.checks.community.count, 1);

  const stats = await (await fetch(base + '/api/stats')).json();
  assert.equal(stats.reports.total, 1);
});

test('honeypot pretends success but stores nothing', async () => {
  const before = (await (await fetch(base + '/api/reports')).json()).total;
  const r = await post('/api/reports', { companySite: 'spam', entityName: 'Bot Co' });
  assert.equal(r.status, 201);
  assert.equal((await (await fetch(base + '/api/reports')).json()).total, before);
});

test('admin endpoint is disabled without a token', async () => {
  const res = await fetch(base + '/api/reports/00000000-0000-0000-0000-000000000000', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"status":"reviewed"}' });
  assert.equal(res.status, 403);
});
