import { api } from '../api.js';
import { icon, FeatureCard, StatCard, Skeleton, ErrorState, SearchForm, bindSearchForm, Badge } from '../components.js';

export function home(root) {
  root.innerHTML = `
  <section class="hero">
    <div class="container hero__inner">
      <div>
        <p class="eyebrow">Internship &amp; certificate verification</p>
        <h1>Verify <span class="grad">Before</span> You Trust.</h1>
        <p class="hero__lead">Got an internship offer or a certificate you are not sure about? Check the company, the offer and the issuer in seconds. TrustCheck combines a verified database, scam-phrase detection and reports from other students.</p>
        ${SearchForm({ idPrefix: 'h' })}
        <div class="examples">
          <span>Try:</span>
          <button class="chip" type="button" data-example="Infosys" data-type="company">Infosys</button>
          <button class="chip" type="button" data-example="Coursera" data-type="certificate">Coursera</button>
          <button class="chip" type="button" data-example="Infosis Technologies" data-type="company">Infosis Technologies</button>
        </div>
        <p class="tagline">// Fake internships? Fake certifications? No more after us.</p>
      </div>
      <div class="stack" aria-hidden="true">
        <div class="stack__layer"><div class="icon-tile">${icon('database')}</div><div><small>Layer 1</small><strong>Verified database</strong></div></div>
        <div class="stack__layer"><div class="icon-tile">${icon('scan')}</div><div><small>Layer 2</small><strong>Scam keyword detection</strong></div></div>
        <div class="stack__layer"><div class="icon-tile">${icon('users')}</div><div><small>Layer 3</small><strong>Community reports</strong></div></div>
      </div>
    </div>
  </section>

  <section class="section section--tight">
    <div class="container grid grid-3">
      ${FeatureCard({ ic: 'database', title: 'Verified Database', text: 'A curated list of real companies, internship platforms and certificate issuers, with their official websites.' })}
      ${FeatureCard({ ic: 'scan', title: 'Scam Keyword Detection', text: 'Paste an offer message and we flag red-flag phrases such as upfront fees, OTP requests and guaranteed-job promises.' })}
      ${FeatureCard({ ic: 'users', title: 'Community Reports', text: 'Students can report suspicious offers. Reports are shown openly and clearly labelled as unverified allegations.' })}
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section__head">
        <p class="eyebrow">How it works</p>
        <h2>Three independent layers, one clear answer.</h2>
        <p class="muted">No single check is perfect, so TrustCheck looks at three different kinds of evidence and shows you each one.</p>
      </div>
      <div class="steps">
        <div class="step"><h3>Verified database</h3><p>We compare the name with organisations we have confirmed, and check that any website or email matches their official domain.</p></div>
        <div class="step"><h3>Scam keyword detection</h3><p>We scan the name and any text you paste for phrases commonly used in fake offers.</p></div>
        <div class="step"><h3>Community feedback</h3><p>We look for reports other users have submitted about the same name.</p>
          <div class="step__verdicts">${Badge('VERIFIED')}${Badge('UNVERIFIED')}${Badge('SUSPICIOUS')}</div></div>
      </div>
      <p style="margin-top:20px"><a href="#/about">Read about the limits of automated checks ${icon('arrow')}</a></p>
    </div>
  </section>

  <section class="section section--tight">
    <div class="container">
      <div class="section__head"><p class="eyebrow">Live numbers</p><h2>What is in TrustCheck right now.</h2></div>
      <div id="stats" class="grid grid-4" aria-live="polite">
        ${[1, 2, 3, 4].map(() => `<div class="card stat">${Skeleton(2, 22)}</div>`).join('')}
      </div>
    </div>
  </section>`;

  bindSearchForm(root, ({ q, type, context }) => {
    sessionStorage.setItem('tc:ctx', context);
    location.hash = '/results?' + new URLSearchParams({ q, type, ...(context ? { ctx: '1' } : {}) });
  });

  const form = root.querySelector('[data-search]');
  root.querySelectorAll('[data-example]').forEach((b) =>
    b.addEventListener('click', () => {
      form.q.value = b.dataset.example;
      form.type.value = b.dataset.type;
      form.requestSubmit();
    }));

  const statsEl = root.querySelector('#stats');
  async function loadStats() {
    statsEl.innerHTML = [1, 2, 3, 4].map(() => `<div class="card stat">${Skeleton(2, 22)}</div>`).join('');
    try {
      const s = await api.stats();
      statsEl.innerHTML = [
        StatCard({ value: s.entities.total, label: 'Verified entities', sub: `${s.entities.company} companies · ${s.entities.internship} internship sources · ${s.entities.certificate} certificate issuers` }),
        StatCard({ value: s.reports.total, label: 'Community reports', sub: s.reports.total ? 'Submitted by users' : 'None submitted yet' }),
        StatCard({ value: s.reports.pending + s.reports.underReview, label: 'Awaiting review', sub: 'Pending or under review' }),
        StatCard({ value: s.reports.reviewed, label: 'Reports reviewed', sub: 'Still allegations, not proven facts' }),
      ].join('');
    } catch (e) {
      statsEl.innerHTML = `<div style="grid-column:1/-1">${ErrorState({ title: 'Could not load statistics', message: e.message })}</div>`;
      statsEl.querySelector('[data-retry]')?.addEventListener('click', loadStats);
    }
  }
  loadStats();
}
