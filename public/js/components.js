// Reusable UI components. Each returns an HTML string. All dynamic text MUST go through esc().

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/><path d="M5 11.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/>',
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M8 12h8"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 010 5.6M18 14.3c1.8.8 3 2.6 3 4.7"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  inbox: '<path d="M4 13l2-8h12l2 8v6H4v-6z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  minus: '<path d="M6 12h12"/>',
};
export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const dateFmt = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/* ---- Badge: VERIFIED / SUSPICIOUS / UNVERIFIED ---- */
const BADGE = { VERIFIED: ['verified', 'check'], SUSPICIOUS: ['suspicious', 'alert'], UNVERIFIED: ['unverified', 'info'] };
export function Badge(verdict) {
  const [cls, ic] = BADGE[verdict] || BADGE.UNVERIFIED;
  return `<span class="badge badge--${cls}">${icon(ic)}${esc(verdict)}</span>`;
}

/* ---- Pill: status for a check (pass/warn/fail/neutral) ---- */
const PILL = { pass: 'Passed', warn: 'Caution', fail: 'Alert', neutral: 'No data' };
export const CheckPill = (status) => `<span class="pill pill--${status === 'neutral' ? 'neutral' : status}">${PILL[status] || ''}</span>`;

/* ---- Pill: report status ---- */
export const StatusPill = (status, label) =>
  `<span class="pill ${status === 'reviewed' ? 'pill--pass' : status === 'under_review' ? 'pill--warn' : ''}">${esc(label)}</span>`;

/* ---- Card helpers ---- */
export const FeatureCard = ({ ic, title, text }) =>
  `<article class="card feature"><div class="icon-tile">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`;

export const StatCard = ({ value, label, sub }) =>
  `<div class="card stat"><div class="stat__num">${esc(value)}</div><div class="stat__label">${esc(label)}</div>${sub ? `<div class="stat__sub">${esc(sub)}</div>` : ''}</div>`;

/* ---- States ---- */
export const Skeleton = (n = 3, h = 18) =>
  Array.from({ length: n }, (_, i) => `<div class="skeleton" style="height:${h}px;width:${i === n - 1 ? 60 : 100}%;margin-bottom:10px"></div>`).join('');

export const EmptyState = ({ ic = 'inbox', title, text, action = '' }) =>
  `<div class="state"><div class="icon-tile">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;

export const ErrorState = ({ title = 'Something went wrong', message, retry = true }) =>
  `<div class="state state--error" role="alert"><div class="icon-tile">${icon('alert')}</div><h3>${esc(title)}</h3><p>${esc(message)}</p>${retry ? `<button class="btn btn--ghost" data-retry>${icon('refresh')}Try again</button>` : ''}</div>`;

export const Alert = (kind, html) =>
  `<div class="alert alert--${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${icon(kind === 'ok' ? 'check' : kind === 'error' ? 'alert' : 'info')}<div>${html}</div></div>`;

export const Disclaimer = (text) => Alert('info', text);

/* ---- Toast ---- */
export function toast(message, kind = 'ok') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : 'alert')}<span>${esc(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

/* ---- Search form (used on Home and Results) ---- */
const TYPES = [['internship', 'Internship'], ['company', 'Company'], ['certificate', 'Certificate']];

export function SearchForm({ q = '', type = 'internship', context = '', idPrefix = 's' } = {}) {
  return `
  <form class="search" data-search novalidate>
    <div class="search__row">
      <div class="search__input">
        ${icon('search')}
        <label class="sr-only" for="${idPrefix}q">Name to verify</label>
        <input class="input" id="${idPrefix}q" name="q" type="text" maxlength="150" autocomplete="off"
          placeholder="Company, offer or certificate name" value="${esc(q)}" aria-describedby="${idPrefix}err">
      </div>
      <div class="select">
        <label class="sr-only" for="${idPrefix}t">What are you checking?</label>
        <select id="${idPrefix}t" name="type">
          ${TYPES.map(([v, l]) => `<option value="${v}"${v === type ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn--primary" type="submit">Verify Now ${icon('arrow')}</button>
    </div>
    <p class="field-error" id="${idPrefix}err" data-error hidden></p>
    <details class="search__more"${context ? ' open' : ''}>
      <summary>Add offer text, website or email for a deeper check <span class="muted">(optional)</span></summary>
      <label class="sr-only" for="${idPrefix}c">Offer text, website or email</label>
      <textarea class="input" id="${idPrefix}c" name="context" rows="4" maxlength="3000"
        placeholder="Paste the offer message, the company website and the recruiter's email. Example: “Pay ₹999 registration fee to confirm your seat. Contact hr@company-careers.xyz”">${esc(context)}</textarea>
      <p class="hint">Sent to this server only to run the check. It is not saved.</p>
    </details>
  </form>`;
}

export function bindSearchForm(root, onSubmit) {
  const form = root.querySelector('[data-search]');
  if (!form) return;
  const err = form.querySelector('[data-error]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.q.value.trim();
    if (q.length < 2) {
      err.textContent = 'Enter at least 2 characters, for example a company or certificate name.';
      err.hidden = false;
      form.q.focus();
      return;
    }
    err.hidden = true;
    onSubmit({ q, type: form.type.value, context: form.context.value.trim() });
  });
  form.q.addEventListener('input', () => { err.hidden = true; });
  return form;
}
