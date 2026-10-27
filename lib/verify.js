'use strict';
/**
 * TrustCheck verification engine.
 *
 * Layer 1  Verified database  -> matchEntity() + analyzeDomains()
 * Layer 2  Scam keywords      -> analyzeKeywords()
 * Layer 3  Community reports  -> analyzeCommunity()
 *
 * verify() combines the three layers into a verdict and a transparent
 * "signal score". The score is a heuristic summary of these checks. It is
 * NOT an accuracy figure or a probability that something is a scam.
 */

/* ---------- text helpers ---------- */

const LEGAL_WORDS = new Set([
  'pvt', 'ltd', 'private', 'limited', 'inc', 'llc', 'llp', 'corp', 'corporation', 'co', 'company', 'plc',
]);

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !LEGAL_WORDS.has(w))
    .join(' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a, b) {
  const L = Math.max(a.length, b.length);
  return L ? 1 - levenshtein(a, b) / L : 1;
}

/* ---------- Layer 1: verified database ---------- */

/**
 * kind: 'exact'     name (or alias) is identical to a verified entity
 *       'lookalike' name is almost identical (possible typo or impersonation)
 *       'partial'   name contains a verified entity's name but is not identical
 *       'none'      nothing found
 */
function matchEntity(query, entities) {
  const q = normalize(query);
  if (!q) return { kind: 'none' };
  const qWords = q.split(' ');

  const named = entities.map((e) => ({
    e,
    names: [e.name, ...(e.aliases || [])].map(normalize).filter(Boolean),
  }));

  for (const { e, names } of named) {
    if (names.includes(q)) return { kind: 'exact', entity: e };
  }

  let partial = null;
  let look = null;
  for (const { e, names } of named) {
    for (const n of names) {
      const k = n.split(' ').length;
      for (let i = 0; i + k <= qWords.length; i++) {
        const w = qWords.slice(i, i + k).join(' ');
        if (w === n) {
          if (!partial || n.length > partial.len) partial = { kind: 'partial', entity: e, len: n.length };
        } else if (n.length >= 5 && w.length >= 5) {
          const s = similarity(w, n);
          if (s >= 0.8 && (!look || s > look.sim)) look = { kind: 'lookalike', entity: e, sim: s };
        }
      }
    }
  }
  return look || partial || { kind: 'none' };
}

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'outlook.com',
  'hotmail.com', 'live.com', 'rediffmail.com', 'icloud.com', 'proton.me', 'protonmail.com', 'aol.com',
]);
const KNOWN_TLDS = new Set([
  'com', 'in', 'org', 'net', 'co', 'io', 'edu', 'gov', 'ac', 'info', 'biz', 'xyz', 'top', 'online', 'site',
  'click', 'work', 'shop', 'club', 'app', 'dev', 'ai', 'us', 'uk', 'buzz', 'live', 'me', 'tech',
]);
const UNUSUAL_TLDS = new Set(['xyz', 'top', 'click', 'work', 'site', 'online', 'shop', 'club', 'buzz']);

function analyzeDomains(text) {
  const emailDomains = [];
  const rest = String(text || '').replace(/[A-Z0-9._%+-]+@([A-Z0-9-]+(?:\.[A-Z0-9-]+)+)/gi, (m, d) => {
    emailDomains.push(d.toLowerCase());
    return ' ';
  });
  const hosts = new Set();
  const re = /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#][^\s]*)?/gi;
  for (const m of rest.matchAll(re)) {
    const host = m[1].toLowerCase();
    const tld = host.split('.').pop();
    if (/^https?:/i.test(m[0]) || /^www\./i.test(m[0]) || KNOWN_TLDS.has(tld)) hosts.add(host);
  }
  return { emailDomains: [...new Set(emailDomains)], hosts: [...hosts] };
}

const hostMatches = (host, domain) => host === domain || host.endsWith('.' + domain);

function evaluateDomains(found, entity) {
  const all = [...new Set([...found.hosts, ...found.emailDomains])];
  const out = { found: all, officialMatch: false, mismatch: false, freeMailClaim: false, unusualTld: false };
  if (!all.length) return out;
  out.unusualTld = all.some((d) => UNUSUAL_TLDS.has(d.split('.').pop()));
  if (!entity) return out;
  const official = entity.domains || [];
  const nonFree = all.filter((d) => !FREE_MAIL.has(d));
  out.officialMatch = nonFree.some((d) => official.some((o) => hostMatches(d, o)));
  const freeUsed = found.emailDomains.some((d) => FREE_MAIL.has(d));
  if (!out.officialMatch) {
    out.freeMailClaim = freeUsed;
    out.mismatch = nonFree.length > 0;
  }
  return out;
}

/* ---------- Layer 2: scam keyword detection ---------- */

const KEYWORD_RULES = [
  { id: 'upfront-fee', weight: 5, label: 'Asks for money (fee or deposit)',
    re: /\b(registration|processing|joining|training|admission|verification|onboarding|security|refundable)\s+(fees?|deposit|charges?|amount)\b|\bpay\s+(rs\.?|₹|inr)?\s?\d|\b(deposit|fee)\s+(of\s+)?(rs\.?|₹|inr)\s?\d/i },
  { id: 'pay-to-confirm', weight: 5, label: 'Payment required to confirm or receive the offer',
    re: /\bpay(ment)?\b[^.\n]{0,40}\b(to\s+(confirm|secure|reserve|book|activate|receive|get)|before\s+(joining|starting))\b/i },
  { id: 'paid-certificate', weight: 4, label: 'Charges for a certificate, ID card, kit or laptop',
    re: /\b(certificate|id\s?card|kit|laptop|uniform)\b[^.\n]{0,30}\b(fees?|charges?|payment|cost)\b|\bpay\b[^.\n]{0,40}\b(certificate|id\s?card|kit|laptop)\b/i },
  { id: 'offer-after-payment', weight: 4, label: 'Offer letter promised only after payment',
    re: /\boffer\s+letter\b[^.\n]{0,30}\b(after|upon)\s+(payment|fee|deposit)/i },
  { id: 'sensitive-info', weight: 4, label: 'Asks for sensitive personal or banking details',
    re: /\b(send|share|provide|submit|give)\b[^.\n]{0,40}\b(aadhaar|aadhar|pan\b|bank\s+(account|details)|passport|password)/i },
  { id: 'otp-cvv', weight: 4, label: 'Mentions OTP, CVV or ATM PIN',
    re: /\b(otp|cvv|atm\s+pin)\b/i },
  { id: 'guaranteed', weight: 4, label: 'Promises a guaranteed job, placement or selection',
    re: /\bguaranteed\s+(job|placement|internship|selection|stipend)\b|\b100\s?%\s+(placement|job|selection|guarantee)/i },
  { id: 'easy-money', weight: 4, label: 'Promises easy or daily earnings',
    re: /\bearn\s+(up\s+to\s+)?(rs\.?|₹|inr)?\s?[\d,]+\s*(\/|per|a)?\s*(day|daily|week|weekly)\b|\beasy\s+money\b|\bdaily\s+payout\b/i },
  { id: 'no-interview', weight: 3, label: 'No interview or test before selection',
    re: /\b(no|without)\s+(any\s+)?(interview|test|screening)\b|\bdirect\s+(selection|joining)\b/i },
  { id: 'untraceable-pay', weight: 3, label: 'Payment through gift cards, crypto or UPI transfer',
    re: /\b(gift\s?card|crypto(currency)?|bitcoin|usdt)\b|\b(gpay|google\s?pay|phonepe|paytm|upi)\b[^.\n]{0,40}\b(pay|send|transfer)\b|\b(pay|send|transfer)\b[^.\n]{0,40}\b(gpay|google\s?pay|phonepe|paytm|upi)\b/i },
  { id: 'messaging-app', weight: 2, label: 'Recruits through WhatsApp or Telegram',
    re: /\b(whatsapp|telegram)\b/i },
  { id: 'urgency', weight: 2, label: 'Pressure or urgency language',
    re: /\b(limited\s+seats?|hurry|act\s+now|last\s+chance|offer\s+(expires?|valid)|within\s+(24|48)\s+hours|only\s+\d+\s+(seats|slots)|urgent(ly)?\s+(joining|hiring))\b/i },
];

function analyzeKeywords(text) {
  const t = String(text || '');
  const matches = [];
  let points = 0;
  for (const r of KEYWORD_RULES) {
    const m = r.re.exec(t);
    if (!m) continue;
    points += r.weight;
    // Quote only the line the phrase appears on, trimmed around the match.
    const lineStart = t.lastIndexOf('\n', m.index) + 1;
    let lineEnd = t.indexOf('\n', m.index);
    if (lineEnd < 0) lineEnd = t.length;
    const from = Math.max(lineStart, m.index - 40);
    const to = Math.min(lineEnd, m.index + m[0].length + 40);
    const excerpt = (from > lineStart ? '…' : '') + t.slice(from, to).replace(/\s+/g, ' ').trim() + (to < lineEnd ? '…' : '');
    matches.push({ id: r.id, label: r.label, weight: r.weight, excerpt });
  }
  const level = points === 0 ? 'none' : points <= 2 ? 'low' : points <= 4 ? 'medium' : 'high';
  return { points, level, matches };
}

/* ---------- Layer 3: community reports ---------- */

function analyzeCommunity(targets, reports) {
  const wanted = targets.map(normalize).filter(Boolean);
  const hits = reports.filter((r) => {
    if (r.status === 'dismissed') return false;
    const n = normalize(r.entityName);
    return wanted.some((t) => n === t || (n.length >= 5 && t.length >= 5 && similarity(n, t) >= 0.85));
  });
  hits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    count: hits.length,
    level: hits.length === 0 ? 'none' : hits.length < 3 ? 'some' : 'many',
    recent: hits.slice(0, 3).map((r) => ({
      id: r.id, category: r.category, status: r.status, createdAt: r.createdAt, isDemo: !!r.isDemo,
    })),
  };
}

/* ---------- Combine ---------- */

const KIND_LABEL = { company: 'company', internship: 'internship programme', certificate: 'certificate issuer' };

function verify({ query, type, context }, entities, reports) {
  const ctx = String(context || '');
  const match = matchEntity(query, entities);
  const entity = match.entity || null;

  const domainFound = analyzeDomains(ctx);
  const dom = evaluateDomains(domainFound, entity);
  const kw = analyzeKeywords(`${query}\n${ctx}`);

  const targets = [query];
  if (match.kind === 'exact') targets.push(entity.name, ...(entity.aliases || []));
  const community = analyzeCommunity(targets, reports);

  const reasons = [];
  const breakdown = [];
  let score = 50;
  const add = (label, delta) => { if (delta) { score += delta; breakdown.push({ label, delta }); } };

  /* Layer 1 */
  const db = { kind: match.kind, entity: null, status: 'warn', detail: '', domain: null };
  if (entity) {
    db.entity = {
      id: entity.id, name: entity.name, kinds: entity.kinds, note: entity.note, officialSite: (entity.domains || [])[0] || null,
    };
  }
  if (match.kind === 'exact') {
    db.status = 'pass';
    db.detail = `“${entity.name}” is in the TrustCheck verified database as a ${entity.kinds.map((k) => KIND_LABEL[k]).join(' / ')}.`;
    reasons.push({ tone: 'good', text: `The name matches “${entity.name}” in the verified database.` });
    add('Name found in verified database', 35);
  } else if (match.kind === 'lookalike') {
    db.status = 'warn';
    db.detail = `No exact match, but the name is very close to “${entity.name}”. It could be a typo or someone imitating them.`;
    reasons.push({ tone: 'warn', text: `The name looks very similar to “${entity.name}” but is not the same. Double-check the spelling.` });
    add('Name resembles a verified entity', -20);
  } else if (match.kind === 'partial') {
    db.status = 'warn';
    db.detail = `The name contains “${entity.name}” but is not identical to it. Confirm it is genuinely run by ${entity.name}.`;
    reasons.push({ tone: 'warn', text: `The name mentions “${entity.name}”. Scammers often add words around a real name.` });
    add('Name only partly matches a verified entity', -5);
  } else {
    db.status = 'warn';
    db.detail = 'No match in the verified database. That does not mean it is fake: the database is small and curated.';
    reasons.push({ tone: 'neutral', text: 'Not found in the verified database, so we cannot confirm it exists.' });
  }

  if (entity && dom.found.length) {
    if (dom.officialMatch) {
      db.domain = { status: 'pass', text: `The website or email domain matches ${entity.name}'s official domain (${entity.domains[0]}).` };
      reasons.push({ tone: 'good', text: 'The website or email domain matches the official domain on record.' });
      add('Official domain match', 15);
    } else if (dom.mismatch) {
      db.status = 'fail';
      db.domain = { status: 'fail', text: `The domain you gave (${dom.found.join(', ')}) does not match ${entity.name}'s official domain (${entity.domains.join(', ')}).` };
      reasons.push({ tone: 'bad', text: `The domain ${dom.found.join(', ')} is not an official ${entity.name} domain.` });
      add('Domain does not match official domain', -30);
    } else if (dom.freeMailClaim) {
      db.status = 'fail';
      db.domain = { status: 'fail', text: `Contact is a free email address (${dom.found.join(', ')}). ${entity.name} recruiters use their own company domain.` };
      reasons.push({ tone: 'bad', text: `A free email address was used while claiming to be ${entity.name}.` });
      add('Free email address used', -20);
    }
  } else if (entity && match.kind === 'exact') {
    db.domain = { status: 'neutral', text: 'Add the website or email from the offer to also check the domain.' };
  }
  if (!entity && dom.found.length && dom.unusualTld) {
    reasons.push({ tone: 'warn', text: `The domain extension used (${dom.found.join(', ')}) is often seen on throwaway sites.` });
    add('Unusual domain extension', -5);
  }

  /* Layer 2 */
  const kwCheck = { level: kw.level, points: kw.points, matches: kw.matches, analyzedContext: ctx.trim().length > 0, status: 'pass', detail: '' };
  if (kw.level === 'none') {
    if (kwCheck.analyzedContext) {
      kwCheck.status = 'pass';
      kwCheck.detail = 'No known scam phrases were found in the text you pasted. Scammers can still word things cleverly.';
      reasons.push({ tone: 'good', text: 'No known scam phrases were found in the text you provided.' });
    } else {
      kwCheck.status = 'neutral';
      kwCheck.detail = 'Only the name was analysed. Paste the offer message or website text for a deeper check.';
    }
  } else if (kw.level === 'low' || kw.level === 'medium') {
    kwCheck.status = 'warn';
    kwCheck.detail = `${kw.matches.length} warning phrase${kw.matches.length > 1 ? 's' : ''} found. Read the offer carefully.`;
    reasons.push({ tone: 'warn', text: `Warning phrases found: ${kw.matches.map((m) => m.label.toLowerCase()).join('; ')}.` });
  } else {
    kwCheck.status = 'fail';
    kwCheck.detail = `${kw.matches.length} red-flag phrases found, including requests for money or sensitive details.`;
    reasons.push({ tone: 'bad', text: `Strong red flags: ${kw.matches.map((m) => m.label.toLowerCase()).join('; ')}.` });
  }
  add('Scam phrases detected', -Math.min(50, kw.points * 8));

  /* Layer 3 */
  const comm = { ...community, status: 'neutral', detail: '' };
  if (community.count === 0) {
    comm.detail = 'No community reports found for this name yet. This is not proof of safety.';
    reasons.push({ tone: 'neutral', text: 'No community reports exist for this name yet.' });
  } else if (community.level === 'some') {
    comm.status = 'warn';
    comm.detail = `${community.count} user-submitted report${community.count > 1 ? 's mention' : ' mentions'} this name. These are allegations, not confirmed facts.`;
    reasons.push({ tone: 'warn', text: `${community.count} community report${community.count > 1 ? 's mention' : ' mentions'} this name (unverified allegations).` });
  } else {
    comm.status = 'fail';
    comm.detail = `${community.count} user-submitted reports mention this name. These are allegations, not confirmed facts.`;
    reasons.push({ tone: 'bad', text: `${community.count} community reports mention this name (unverified allegations).` });
  }
  add('Community reports', -Math.min(30, community.count * 10));

  /* Verdict */
  const suspicious =
    kw.level === 'high' ||
    (entity && (dom.mismatch || dom.freeMailClaim)) ||
    (match.kind === 'lookalike' && kw.points >= 3) ||
    (community.level === 'many' && match.kind !== 'exact');

  let verdict;
  if (suspicious) verdict = 'SUSPICIOUS';
  else if (match.kind === 'exact') verdict = 'VERIFIED';
  else verdict = 'UNVERIFIED';

  const headline = {
    VERIFIED: `${entity ? entity.name : 'This organisation'} is in our verified database.`,
    SUSPICIOUS: 'Several warning signs were detected. Do not pay or share personal details.',
    UNVERIFIED: 'We could not verify this. Treat it with caution until you confirm it yourself.',
  }[verdict];

  const summary = {
    VERIFIED: 'This confirms the organisation exists in our curated list. It does not prove that this specific offer or certificate is genuine, so confirm it on the official website.',
    SUSPICIOUS: 'Automated checks can be wrong, but these signals match common scam patterns. Confirm through the official website before taking any step.',
    UNVERIFIED: 'Not being in our database does not mean something is fake. It means we have no evidence either way.',
  }[verdict];

  if (verdict === 'VERIFIED' && community.count >= 3) {
    reasons.push({ tone: 'warn', text: 'Several reports mention this name. Fake offers often misuse real company names, so check the offer itself.' });
  }

  const value = Math.max(0, Math.min(100, Math.round(score)));

  return {
    query, type, verdict, headline, summary, reasons,
    checks: { database: db, keywords: kwCheck, community: comm },
    score: { value, base: 50, breakdown },
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  verify, matchEntity, analyzeKeywords, analyzeDomains, evaluateDomains, analyzeCommunity, normalize, similarity,
};
