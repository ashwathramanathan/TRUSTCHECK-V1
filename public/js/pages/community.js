import { api } from '../api.js';
import { esc, icon, dateFmt, StatusPill, Skeleton, EmptyState, ErrorState, Disclaimer } from '../components.js';

const Report = (r, meta) => `
  <article class="card report">
    <div class="report__top">
      <h3>${esc(r.entityName)}</h3>
      ${StatusPill(r.status, meta.statuses[r.status] || r.status)}
    </div>
    <div class="report__meta">
      <span class="pill">${esc(meta.categories[r.category] || r.category)}</span>
      <span>${esc(meta.offerTypes[r.offerType] || r.offerType)}</span>
      <span>·</span>
      <span>${icon('clock')} ${esc(dateFmt(r.createdAt))}</span>
      ${r.isDemo ? '<span class="pill pill--demo">Demo data</span>' : ''}
    </div>
    <p class="report__reason">${esc(r.description)}</p>
    <div class="report__links">
      ${r.website ? `<span class="muted">Contact/site given: ${esc(r.website)}</span>` : ''}
      ${r.evidenceUrl ? `<a href="${esc(r.evidenceUrl)}" target="_blank" rel="noopener noreferrer nofollow ugc">Evidence link ${icon('external')}</a>` : ''}
      <a href="#/results?${new URLSearchParams({ q: r.entityName, type: 'company' })}">Check this name</a>
    </div>
  </article>`;

export async function community(root, params) {
  root.innerHTML = `<div class="container page-head"><div class="card"><p class="muted">Loading…</p></div></div>`;
  let meta;
  try { meta = await api.meta(); }
  catch (e) {
    root.innerHTML = `<div class="container page-head">${ErrorState({ message: e.message })}</div>`;
    root.querySelector('[data-retry]').addEventListener('click', () => community(root, params));
    return;
  }
  const opts = (map, all, skip = []) => `<option value="">${all}</option>` + Object.entries(map).filter(([k]) => !skip.includes(k)).map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('');

  root.innerHTML = `
  <div class="container page-head">
    <div class="section__head" style="max-width:none;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-end">
      <div style="max-width:620px">
        <p class="eyebrow">Layer 3</p>
        <h1 style="font-size:clamp(2rem,4.5vw,3rem)">Community reports</h1>
        <p class="muted" style="margin:0">Search what other students have reported.</p>
      </div>
      <a class="btn btn--danger" href="#/report">${icon('flag')}Report a scam</a>
    </div>
    <div style="margin-bottom:20px">${Disclaimer('<strong>These are allegations, not verified facts.</strong> Anyone can submit a report. A report does not prove that a company or certificate is fraudulent, and a “Reviewed” status only means a moderator looked at it.')}</div>

    <div class="toolbar" role="search">
      <div><label class="sr-only" for="q">Search reports</label><input class="input" id="q" type="search" placeholder="Search by name, website or description" value="${esc(params.get('q') || '')}"></div>
      <div class="select"><label class="sr-only" for="cat">Category</label><select id="cat">${opts(meta.categories, 'All categories')}</select></div>
      <div class="select"><label class="sr-only" for="st">Status</label><select id="st">${opts(meta.statuses, 'All statuses', ['dismissed'])}</select></div>
      <div class="select"><label class="sr-only" for="so">Sort</label><select id="so"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
    </div>

    <div id="list" class="list" aria-live="polite"></div>
    <div id="foot" class="list-foot"></div>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const state = { page: 1, items: [], total: 0, pages: 1 };
  let timer = null;
  let seq = 0;
  let alive = true;

  const query = (page) => ({
    q: $('#q').value.trim(), category: $('#cat').value, status: $('#st').value, sort: $('#so').value, page, limit: 8,
  });
  const filtered = () => !!(query(1).q || $('#cat').value || $('#st').value);

  async function load(page = 1) {
    const mine = ++seq;
    if (page === 1) $('#list').innerHTML = [1, 2, 3].map(() => `<div class="card">${Skeleton(3, 16)}</div>`).join('');
    $('#foot').innerHTML = '';
    try {
      const data = await api.reports(query(page));
      if (!alive || mine !== seq) return;
      state.items = page === 1 ? data.items : state.items.concat(data.items);
      Object.assign(state, { page: data.page, total: data.total, pages: data.pages });
      draw();
    } catch (e) {
      if (!alive || mine !== seq) return;
      $('#list').innerHTML = ErrorState({ title: 'Could not load reports', message: e.message });
      $('#list').querySelector('[data-retry]').addEventListener('click', () => load(1));
    }
  }

  function draw() {
    if (!state.items.length) {
      $('#list').innerHTML = filtered()
        ? EmptyState({ ic: 'search', title: 'No reports match your filters', text: 'Try a different search term or clear the filters.', action: '<button class="btn btn--ghost" id="clear">Clear filters</button>' })
        : EmptyState({ ic: 'inbox', title: 'No reports yet', text: 'Nobody has submitted a report. If you have come across a suspicious offer, be the first to warn others.', action: '<a class="btn btn--danger" href="#/report">Report a scam</a>' });
      $('#clear')?.addEventListener('click', () => { $('#q').value = ''; $('#cat').value = ''; $('#st').value = ''; load(1); });
      return;
    }
    $('#list').innerHTML = state.items.map((r) => Report(r, meta)).join('');
    $('#foot').innerHTML = `<span>Showing ${state.items.length} of ${state.total} report${state.total === 1 ? '' : 's'}</span>${state.page < state.pages ? '<button class="btn btn--ghost" id="more">Load more</button>' : ''}`;
    $('#more')?.addEventListener('click', () => load(state.page + 1));
  }

  $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(1), 250); });
  ['#cat', '#st', '#so'].forEach((s) => $(s).addEventListener('change', () => load(1)));
  load(1);
  return () => { alive = false; clearTimeout(timer); };
}
