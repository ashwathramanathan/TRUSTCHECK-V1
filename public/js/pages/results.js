import { api } from '../api.js';
import {
  esc, icon, Badge, CheckPill, ErrorState, EmptyState, SearchForm, bindSearchForm, Disclaimer, dateFmt,
} from '../components.js';

const TYPE_LABEL = { internship: 'Internship', company: 'Company', certificate: 'Certificate' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LoadingView = (q) => `
  <div class="card" role="status" aria-live="polite">
    <p class="eyebrow">Checking</p>
    <h2>${esc(q)}</h2>
    <ul class="loading-steps">
      <li><span class="spinner"></span>Layer 1 · Looking up the verified database</li>
      <li><span class="spinner"></span>Layer 2 · Scanning for scam phrases</li>
      <li><span class="spinner"></span>Layer 3 · Searching community reports</li>
    </ul>
  </div>`;

function Check({ layer, ic, title, check, body }) {
  return `
  <article class="card check">
    <div class="check__top"><span class="check__layer">${layer}</span>${CheckPill(check.status)}</div>
    <h3>${icon(ic)}${title}</h3>
    <p>${esc(check.detail)}</p>
    ${body || ''}
  </article>`;
}

function renderResult(d, ctxUsed) {
  const { database: db, keywords: kw, community: cm } = d.checks;
  const v = d.verdict.toLowerCase();

  const dbBody = [
    db.domain ? `<div class="sub">${CheckPill(db.domain.status)}<p style="margin-top:8px">${esc(db.domain.text)}</p></div>` : '',
    db.entity && db.entity.officialSite
      ? `<p><a href="https://${esc(db.entity.officialSite)}" target="_blank" rel="noopener noreferrer">Open official site: ${esc(db.entity.officialSite)} ${icon('external')}</a></p>` : '',
  ].join('');

  const kwBody = kw.matches.length
    ? `<ul>${kw.matches.map((m) => `<li><strong>${esc(m.label)}</strong><q>${esc(m.excerpt)}</q></li>`).join('')}</ul>` : '';

  const cmBody = cm.recent.length
    ? `<ul>${cm.recent.map((r) => `<li>${esc(dateFmt(r.createdAt))} · ${esc(r.status.replace('_', ' '))}${r.isDemo ? ' · demo' : ''}</li>`).join('')}</ul>
       <p><a href="#/community?${new URLSearchParams({ q: d.query })}">See reports ${icon('arrow')}</a></p>`
    : '';

  const C = 2 * Math.PI * 52;
  return `
  <section class="verdict verdict--${v}" aria-labelledby="rtitle">
    <div>
      <div class="verdict__tags"><span class="eyebrow" style="margin:0">${esc(TYPE_LABEL[d.type] || 'Entity')} check</span>${Badge(d.verdict)}</div>
      <h1 id="rtitle">${esc(d.query)}</h1>
      <p class="verdict__headline">${esc(d.headline)}</p>
      <p class="muted">${esc(d.summary)}</p>
      <div class="verdict__actions">
        <a class="btn btn--danger" href="#/report?${new URLSearchParams({ entity: d.query })}">${icon('flag')}Report this entity</a>
        <a class="btn btn--ghost" href="#/">Check another</a>
      </div>
    </div>
    <div class="score">
      <div class="ring" role="img" aria-label="Signal score ${d.score.value} out of 100">
        <svg viewBox="0 0 120 120" width="150" height="150"><circle class="track" cx="60" cy="60" r="52"/><circle class="bar" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-offset="${C * (1 - d.score.value / 100)}"/></svg>
        <div class="ring__num">${d.score.value}</div>
      </div>
      <div class="score__label">Signal score (0–100)</div>
      <details>
        <summary>How is this calculated?</summary>
        <ul>
          <li><span>Starting point</span><span class="mono">${d.score.base}</span></li>
          ${d.score.breakdown.map((b) => `<li><span>${esc(b.label)}</span><span class="${b.delta > 0 ? 'd-pos' : 'd-neg'}">${b.delta > 0 ? '+' : ''}${b.delta}</span></li>`).join('')}
        </ul>
        <p class="note">A simple summary of the three checks below. It is not an accuracy rate or the probability that something is a scam.</p>
      </details>
    </div>
  </section>

  <section class="grid grid-3" style="margin-top:20px" aria-label="The three checks">
    ${Check({ layer: 'Layer 1', ic: 'database', title: 'Database match', check: db, body: dbBody })}
    ${Check({ layer: 'Layer 2', ic: 'scan', title: 'Scam keywords', check: kw, body: kwBody })}
    ${Check({ layer: 'Layer 3', ic: 'users', title: 'Community feedback', check: cm, body: cmBody })}
  </section>

  <section class="card" style="margin-top:20px">
    <h3>Why this result?</h3>
    <ul class="reasons">
      ${d.reasons.map((r) => `<li><span class="dot dot--${r.tone}">${icon(r.tone === 'good' ? 'check' : r.tone === 'bad' ? 'x' : r.tone === 'warn' ? 'alert' : 'minus')}</span><span>${esc(r.text)}</span></li>`).join('')}
    </ul>
  </section>

  <div style="margin-top:20px">${Disclaimer(`<strong>Always confirm independently.</strong> Visit the organisation's official website or contact them through the details listed there, not the ones in the offer. Community reports are allegations submitted by users and are not independently verified facts.${ctxUsed ? '' : ' Tip: paste the offer text in a new check to run the scam-phrase analysis on it.'}`)}</div>`;
}

export function results(root, params) {
  const q = (params.get('q') || '').trim();
  const type = ['internship', 'company', 'certificate'].includes(params.get('type')) ? params.get('type') : 'company';
  const context = params.get('ctx') === '1' ? sessionStorage.getItem('tc:ctx') || '' : '';

  root.innerHTML = `
  <div class="container page-head">
    ${SearchForm({ q, type, context, idPrefix: 'r' })}
    <div id="out" style="margin-top:24px" aria-live="polite"></div>
  </div>`;

  bindSearchForm(root, ({ q: nq, type: nt, context: nc }) => {
    sessionStorage.setItem('tc:ctx', nc);
    const next = '/results?' + new URLSearchParams({ q: nq, type: nt, ...(nc ? { ctx: '1' } : {}) });
    if (location.hash === '#' + next) run(); else location.hash = next;
  });

  const out = root.querySelector('#out');
  let alive = true;

  async function run() {
    if (q.length < 2) {
      out.innerHTML = EmptyState({ ic: 'search', title: 'Nothing to check yet', text: 'Enter a company, internship or certificate name above and press Verify Now.' });
      return;
    }
    out.innerHTML = LoadingView(q);
    try {
      const [data] = await Promise.all([api.verify({ query: q, type, context }), sleep(900)]);
      if (!alive) return;
      out.innerHTML = renderResult(data, !!context);
      requestAnimationFrame(() => {
        const bar = out.querySelector('.ring .bar');
        if (bar) bar.setAttribute('stroke-dashoffset', bar.dataset.offset);
      });
    } catch (e) {
      if (!alive) return;
      out.innerHTML = ErrorState({ title: 'We could not complete the check', message: e.message });
      out.querySelector('[data-retry]')?.addEventListener('click', run);
    }
  }
  run();
  return () => { alive = false; };
}
