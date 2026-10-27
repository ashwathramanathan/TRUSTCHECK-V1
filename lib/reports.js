'use strict';

const OFFER_TYPES = {
  internship: 'Internship offer',
  job: 'Job offer',
  certificate: 'Certificate or course',
  company: 'Company or website',
  other: 'Other',
};

const CATEGORIES = {
  upfront_fee: 'Asked for money upfront',
  fake_certificate: 'Fake or unverifiable certificate',
  impersonation: 'Pretending to be another company',
  no_offer: 'Took money, no offer or work given',
  data_theft: 'Asked for sensitive personal details',
  other: 'Other',
};

const STATUSES = {
  pending: 'Pending review',
  under_review: 'Under review',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
};

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

/** Returns { errors } or { value }. Never trusts the client. */
function validateReport(body) {
  const b = body && typeof body === 'object' ? body : {};
  const v = {
    entityName: clean(b.entityName, 120),
    offerType: clean(b.offerType, 30),
    category: clean(b.category, 30),
    website: clean(b.website, 200),
    description: clean(b.description, 2000),
    evidenceUrl: clean(b.evidenceUrl, 500),
  };
  const errors = {};
  if (v.entityName.length < 2) errors.entityName = 'Enter the company or institution name (at least 2 characters).';
  if (!OFFER_TYPES[v.offerType]) errors.offerType = 'Choose the type of offer or certificate.';
  if (!CATEGORIES[v.category]) errors.category = 'Choose what went wrong.';
  if (v.description.length < 30) errors.description = 'Describe what happened in at least 30 characters so others can understand.';
  if (v.evidenceUrl && !isHttpUrl(v.evidenceUrl)) errors.evidenceUrl = 'Enter a full link starting with http:// or https://';
  return Object.keys(errors).length ? { errors } : { value: v };
}

module.exports = { OFFER_TYPES, CATEGORIES, STATUSES, validateReport };
