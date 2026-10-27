import { home } from './pages/home.js';
import { results } from './pages/results.js';
import { report } from './pages/report.js';
import { community } from './pages/community.js';
import { about } from './pages/about.js';
import { EmptyState, icon } from './components.js';

const main = document.getElementById('main');
const navLinks = document.getElementById('navLinks');
const navToggle = document.getElementById('navToggle');

const routes = {
  '/': { page: home, title: 'Verify before you trust' },
  '/results': { page: results, title: 'Verification result' },
  '/report': { page: report, title: 'Report a scam' },
  '/community': { page: community, title: 'Community reports' },
  '/about': { page: about, title: 'How it works' },
};

let cleanup = null;
let token = 0;

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const i = raw.indexOf('?');
  return { path: i < 0 ? raw : raw.slice(0, i), params: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)) };
}

async function render() {
  const mine = ++token;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  const { path, params } = parseHash();
  const route = routes[path];

  navLinks.querySelectorAll('a[data-route]').forEach((a) => {
    if (a.dataset.route === path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  navLinks.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');

  main.innerHTML = '';
  if (!route) {
    document.title = 'Page not found — TrustCheck';
    main.innerHTML = `<div class="container section">${EmptyState({
      ic: 'search', title: 'Page not found', text: 'That page does not exist.',
      action: `<a class="btn btn--primary" href="#/">Go home</a>`,
    })}</div>`;
    return;
  }
  document.title = `${route.title} — TrustCheck`;
  const result = await route.page(main, params);
  if (mine !== token) { if (typeof result === 'function') result(); return; }
  if (typeof result === 'function') cleanup = result;
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

window.addEventListener('hashchange', render);
render();
