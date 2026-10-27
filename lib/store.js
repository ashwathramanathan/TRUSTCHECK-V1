'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ENTITIES_FILE = path.join(DATA_DIR, 'entities.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

let entities = [];
let reports = [];
let writeChain = Promise.resolve();

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  entities = JSON.parse(fs.readFileSync(ENTITIES_FILE, 'utf8')).entities || [];
  if (fs.existsSync(REPORTS_FILE)) {
    try {
      reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
      if (!Array.isArray(reports)) reports = [];
    } catch (err) {
      console.error('reports.json is unreadable; starting empty:', err.message);
      reports = [];
    }
  } else {
    fs.writeFileSync(REPORTS_FILE, '[]');
  }
}

function persist() {
  // Serialise writes and swap atomically so a crash can't leave a half-written file.
  writeChain = writeChain.then(async () => {
    const tmp = REPORTS_FILE + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(reports, null, 2));
    await fs.promises.rename(tmp, REPORTS_FILE);
  }).catch((err) => console.error('Failed to save reports:', err));
  return writeChain;
}

const getEntities = () => entities;
const getReports = () => reports;

async function addReport(report) {
  reports.unshift(report);
  await persist();
  return report;
}

async function updateReport(id, patch) {
  const r = reports.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, patch);
  await persist();
  return r;
}

async function replaceReports(next) {
  reports = next;
  await persist();
}

module.exports = { init, getEntities, getReports, addReport, updateReport, replaceReports };
