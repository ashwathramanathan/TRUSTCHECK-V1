import { api } from '../api.js';
import { esc, icon, Alert, Skeleton, ErrorState } from '../components.js';

export function about(root) {
  root.innerHTML = `
  <div class="container page-head">
    <div class="section__head">
      <p class="eyebrow">About</p>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem)">How TrustCheck works</h1>
      <p class="muted">TrustCheck gives you three separate pieces of evidence about an internship offer, company or certificate, so you can make a better decision. It does not replace your own checking.</p>
    </div>

    <div class="grid" style="max-width:860px">
      <article class="card layer-card">
        <div class="icon-tile">${icon('database')}</div>
        <div>
          <h3>Layer 1 · Verified database</h3>
          <p>We compare the name with a curated list of real companies, internship platforms and certificate issuers. If you also paste a website or email, we check that its domain matches the official one on record.</p>
          <p><strong>Catches:</strong> lookalike names (such as a misspelt company), emails from free providers pretending to be a company, and websites on the wrong domain.</p>
        </div>
      </article>
      <article class="card layer-card">
        <div class="icon-tile">${icon('scan')}</div>
        <div>
          <h3>Layer 2 · Scam keyword detection</h3>
          <p>We scan the name and any offer text you paste for phrases common in fake offers: registration fees, security deposits, OTP or bank-detail requests, guaranteed placement, no interview, urgency and similar.</p>
          <p><strong>Catches:</strong> the wording of typical scams, even for companies we have never heard of.</p>
        </div>
      </article>
      <article class="card layer-card">
        <div class="icon-tile">${icon('users')}</div>
        <div>
          <h3>Layer 3 · Community feedback</h3>
          <p>We look for reports submitted by other users about the same name. Reports are shown openly with their review status.</p>
          <p><strong>Catches:</strong> new scams that are not in any database yet, if someone has already reported them.</p>
        </div>
      </article>
    </div>
  </div>

  <section class="section section--tight">
    <div class="container grid grid-2" style="align-items:start">
      <div class="card">
        <h3>${icon('alert')} Limits of automated checks</h3>
        <ul class="prose" style="margin:12px 0 0">
          <li>The verified database is small. Missing from it does <strong>not</strong> mean fake.</li>
          <li>Being in it confirms the organisation exists, not that a specific offer or certificate is real. Scammers copy real names.</li>
          <li>Keyword detection only knows common phrases. A careful scammer can avoid them, and a genuine email can occasionally contain one.</li>
          <li>Community reports are unverified allegations. They can be mistaken, outdated or even malicious.</li>
          <li>The signal score summarises the three checks. It is not an accuracy rate or a probability.</li>
        </ul>
      </div>
      <div class="card">
        <h3>${icon('shield')} Before you accept any offer</h3>
        <ul class="checklist" style="margin-top:14px">
          <li><span class="dot dot--good">${icon('check')}</span><span>Open the company's <strong>official website</strong> yourself (do not use links from the offer) and find the careers page.</span></li>
          <li><span class="dot dot--good">${icon('check')}</span><span>Contact them through the <strong>official phone or email</strong> listed there to confirm the offer.</span></li>
          <li><span class="dot dot--good">${icon('check')}</span><span>Genuine internships do not ask for <strong>registration fees, deposits or OTPs</strong>.</span></li>
          <li><span class="dot dot--good">${icon('check')}</span><span>For certificates, use the issuer's own <strong>verification page</strong> or ask your college placement cell.</span></li>
          <li><span class="dot dot--good">${icon('check')}</span><span>Never share Aadhaar, bank details or OTPs before you have verified the sender.</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section section--tight">
    <div class="container">
      <details class="card" id="db">
        <summary>What is in the verified database?</summary>
        <div id="dbBody" style="margin-top:16px"><p class="muted">Open to load.</p></div>
      </details>
    </div>
  </section>`;

  const details = root.querySelector('#db');
  const body = root.querySelector('#dbBody');
  let loaded = false;
  async function load() {
    body.innerHTML = Skeleton(4, 16);
    try {
      const { items } = await api.entities();
      loaded = true;
      body.innerHTML = `<p class="muted">Curated by the project team. Each entry points to the organisation's official domain. Please suggest corrections if you spot a mistake.</p>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Covers</th><th>Official domain</th></tr></thead><tbody>
      ${items.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.kinds.join(', '))}</td><td class="mono">${esc((e.domains || []).join(', '))}</td></tr>`).join('')}
      </tbody></table></div>`;
    } catch (e) {
      body.innerHTML = ErrorState({ title: 'Could not load the database list', message: e.message });
      body.querySelector('[data-retry]').addEventListener('click', load);
    }
  }
  details.addEventListener('toggle', () => { if (details.open && !loaded) load(); });
}
