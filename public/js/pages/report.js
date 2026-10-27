import { api } from '../api.js';
import { esc, icon, Alert, toast, Disclaimer } from '../components.js';

const FIELDS = ['entityName', 'offerType', 'category', 'website', 'description', 'evidenceUrl'];

function validate(v) {
  const e = {};
  if (v.entityName.trim().length < 2) e.entityName = 'Enter the company or institution name (at least 2 characters).';
  if (!v.offerType) e.offerType = 'Choose the type of offer or certificate.';
  if (!v.category) e.category = 'Choose what went wrong.';
  if (v.description.trim().length < 30) e.description = 'Describe what happened in at least 30 characters so others can understand.';
  if (v.evidenceUrl.trim()) {
    try { const u = new URL(v.evidenceUrl.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; }
    catch { e.evidenceUrl = 'Enter a full link starting with http:// or https://'; }
  }
  return e;
}

const options = (map, placeholder) =>
  `<option value="">${placeholder}</option>` + Object.entries(map).map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('');

export async function report(root, params) {
  root.innerHTML = `<div class="container page-head"><div class="card"><p class="muted">Loading form…</p></div></div>`;
  let meta;
  try { meta = await api.meta(); }
  catch (e) {
    root.innerHTML = `<div class="container page-head">${Alert('error', `${esc(e.message)} <button class="btn btn--ghost btn--sm" data-retry>Retry</button>`)}</div>`;
    root.querySelector('[data-retry]').addEventListener('click', () => report(root, params));
    return;
  }

  const prefill = (params.get('entity') || '').slice(0, 120);

  const fieldWrap = (name, label, input, { required = false, hint = '' } = {}) => `
    <div class="field" data-field="${name}">
      <label for="f-${name}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="muted">(optional)</span>'}</label>
      ${input}
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      <p class="field-error" id="e-${name}" hidden></p>
    </div>`;

  root.innerHTML = `
  <div class="container page-head">
    <div class="section__head">
      <p class="eyebrow">Community</p>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem)">Report a scam</h1>
      <p class="muted">Tell other students what happened. Reports are shown publicly (without your name) and are labelled as unverified allegations until reviewed.</p>
    </div>

    <div id="result"></div>

    <form class="card" id="form" novalidate style="max-width:760px">
      ${fieldWrap('entityName', 'Company or institution name', `<input class="input" id="f-entityName" name="entityName" maxlength="120" value="${esc(prefill)}" aria-describedby="e-entityName" autocomplete="off">`, { required: true })}
      <div class="grid grid-2">
        ${fieldWrap('offerType', 'Offer or certificate type', `<div class="select"><select id="f-offerType" name="offerType" aria-describedby="e-offerType">${options(meta.offerTypes, 'Select a type')}</select></div>`, { required: true })}
        ${fieldWrap('category', 'What went wrong?', `<div class="select"><select id="f-category" name="category" aria-describedby="e-category">${options(meta.categories, 'Select a reason')}</select></div>`, { required: true })}
      </div>
      ${fieldWrap('website', 'Website or contact details', `<input class="input" id="f-website" name="website" maxlength="200" placeholder="Website, email or phone number used by the sender" aria-describedby="e-website">`)}
      ${fieldWrap('description', 'What happened?', `<textarea class="input" id="f-description" name="description" rows="6" maxlength="2000" placeholder="Describe the offer, what they asked for, and when it happened. Stick to facts you experienced." aria-describedby="e-description"></textarea><div class="counter" id="count">0 / 2000</div>`, { required: true })}
      ${fieldWrap('evidenceUrl', 'Evidence link', `<input class="input" id="f-evidenceUrl" name="evidenceUrl" type="url" maxlength="500" placeholder="https://… (screenshot, post or page)" aria-describedby="e-evidenceUrl">`, { hint: 'Upload your screenshot somewhere (like Google Drive) and paste a public link. Remove personal details first.' })}
      <div class="hp" aria-hidden="true"><label>Leave this empty<input name="companySite" tabindex="-1" autocomplete="off"></label></div>

      <div style="margin-bottom:18px">${Disclaimer('Only report what you personally experienced. Do not include your own Aadhaar, bank, OTP or other sensitive details.')}</div>
      <button class="btn btn--danger" type="submit" id="submit">${icon('flag')}<span>Submit report</span></button>
    </form>
  </div>`;

  const form = root.querySelector('#form');
  const resultEl = root.querySelector('#result');
  const submitBtn = root.querySelector('#submit');

  const values = () => Object.fromEntries(FIELDS.map((f) => [f, form[f].value]));
  function showErrors(errors) {
    FIELDS.forEach((f) => {
      const wrap = form.querySelector(`[data-field="${f}"]`);
      const p = wrap.querySelector('.field-error');
      const msg = errors[f];
      wrap.classList.toggle('has-error', !!msg);
      p.hidden = !msg;
      p.textContent = msg || '';
      form[f].setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }

  // Validate a single field when the user leaves it, keeping other fields' messages untouched.
  FIELDS.forEach((f) => form[f].addEventListener('blur', () => {
    const msg = validate(values())[f];
    const wrap = form.querySelector(`[data-field="${f}"]`);
    const p = wrap.querySelector('.field-error');
    wrap.classList.toggle('has-error', !!msg);
    p.hidden = !msg;
    p.textContent = msg || '';
    form[f].setAttribute('aria-invalid', msg ? 'true' : 'false');
  }));
  form.description.addEventListener('input', () => { root.querySelector('#count').textContent = `${form.description.value.length} / 2000`; });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    resultEl.innerHTML = '';
    const errors = validate(values());
    showErrors(errors);
    const firstBad = FIELDS.find((f) => errors[f]);
    if (firstBad) { form[firstBad].focus(); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span><span>Submitting…</span>';
    try {
      await api.submitReport({ ...values(), companySite: form.companySite.value });
      form.reset();
      root.querySelector('#count').textContent = '0 / 2000';
      resultEl.innerHTML = `<div style="max-width:760px;margin-bottom:20px">${Alert('ok', `<strong>Thank you — your report was submitted.</strong> It now appears in <a href="#/community">Community Reports</a> as “Pending review”.`)}</div>`;
      toast('Report submitted');
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      if (e.fields) showErrors(e.fields);
      resultEl.innerHTML = `<div style="max-width:760px;margin-bottom:20px">${Alert('error', `<strong>Report not submitted.</strong> ${esc(e.message)}`)}</div>`;
      toast('Could not submit report', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icon('flag')}<span>Submit report</span>`;
    }
  });
}
