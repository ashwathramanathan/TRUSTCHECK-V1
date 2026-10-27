'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { verify, matchEntity, analyzeKeywords, analyzeDomains } = require('../lib/verify');
const { validateReport } = require('../lib/reports');

const entities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'entities.json'), 'utf8')).entities;
const run = (query, context = '', reports = [], type = 'company') => verify({ query, type, context }, entities, reports);
const rep = (name, status = 'pending') => ({ id: Math.random() + '', entityName: name, status, category: 'upfront_fee', createdAt: new Date().toISOString() });

test('exact match and alias are VERIFIED', () => {
  assert.equal(run('Infosys').verdict, 'VERIFIED');
  assert.equal(run('TCS').verdict, 'VERIFIED');
  assert.equal(run('infosys limited').verdict, 'VERIFIED');
});

test('unknown name is UNVERIFIED, not suspicious', () => {
  assert.equal(run('Totally Unknown Startup').verdict, 'UNVERIFIED');
});

test('lookalike name is flagged but not called a scam on its own', () => {
  assert.equal(matchEntity('Infosis', entities).kind, 'lookalike');
  assert.equal(run('Infosis').verdict, 'UNVERIFIED');
});

test('name that merely contains a verified name is partial', () => {
  assert.equal(matchEntity('Infosys Careers Hub', entities).kind, 'partial');
  assert.equal(run('Infosys Careers Hub').verdict, 'UNVERIFIED');
});

test('scam phrases make an offer SUSPICIOUS even for a verified company', () => {
  const r = run('Infosys', 'Pay ₹999 registration fee to confirm your seat. Guaranteed placement!');
  assert.equal(r.verdict, 'SUSPICIOUS');
  assert.equal(r.checks.keywords.level, 'high');
});

test('official domain passes, wrong domain and free email fail', () => {
  assert.equal(run('Infosys', 'Apply at https://www.infosys.com/careers').checks.database.domain.status, 'pass');
  assert.equal(run('Infosys', 'Apply at infosys-careers.xyz').verdict, 'SUSPICIOUS');
  assert.equal(run('Infosys', 'Mail hr.infosys@gmail.com').verdict, 'SUSPICIOUS');
  assert.equal(run('Infosys', 'Mail recruiter@infosys.com').verdict, 'VERIFIED');
});

test('keyword analysis: clean text finds nothing', () => {
  assert.equal(analyzeKeywords('We are pleased to invite you to an interview on Monday.').level, 'none');
});

test('domain extraction ignores abbreviations and splits emails', () => {
  const d = analyzeDomains('e.g. contact hr@acme-careers.xyz or visit www.acme.com');
  assert.deepEqual(d.emailDomains, ['acme-careers.xyz']);
  assert.deepEqual(d.hosts, ['acme.com']);
});

test('community reports are counted, dismissed ones ignored', () => {
  const r = run('Unknown Co', '', [rep('Unknown Co'), rep('unknown co.'), rep('Unknown Co', 'dismissed')]);
  assert.equal(r.checks.community.count, 2);
  assert.equal(r.checks.community.status, 'warn');
  const many = run('Unknown Co', '', [rep('Unknown Co'), rep('Unknown Co'), rep('Unknown Co')]);
  assert.equal(many.verdict, 'SUSPICIOUS');
});

test('score is clamped 0-100 and explained', () => {
  const r = run('Infosys', 'Pay ₹999 registration fee. Send Aadhaar and OTP. Guaranteed job. WhatsApp only. Hurry!');
  assert.ok(r.score.value >= 0 && r.score.value <= 100);
  assert.ok(r.score.breakdown.length > 0);
});

test('report validation', () => {
  assert.ok(validateReport({}).errors.entityName);
  const ok = validateReport({ entityName: 'Fake Co', offerType: 'internship', category: 'upfront_fee', description: 'They asked me to pay five hundred rupees before the offer letter.' });
  assert.ok(ok.value);
  assert.ok(validateReport({ ...ok.value, evidenceUrl: 'javascript:alert(1)' }).errors.evidenceUrl);
});
