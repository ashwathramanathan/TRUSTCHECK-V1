'use strict';
// Adds clearly-labelled FICTIONAL demo reports so the community screens aren't empty during a demo.
//   npm run demo-data          add demo reports
//   npm run demo-data:clear    remove them again
const crypto = require('crypto');
const store = require('../lib/store');
store.init();

const clear = process.argv.includes('--clear');
const kept = store.getReports().filter((r) => !r.isDemo);

(async () => {
  if (clear) {
    await store.replaceReports(kept);
    console.log(`Removed demo reports. ${kept.length} real report(s) kept.`);
    return;
  }
  const day = 86400000;
  const demo = [
    ['Example Interns Pvt Ltd (demo)', 'internship', 'upfront_fee', 'example-interns.invalid', 'DEMO: Fictional example. Offer email asked for a registration fee before sharing the offer letter.', 'pending', 1],
    ['Example Interns Pvt Ltd (demo)', 'internship', 'upfront_fee', '', 'DEMO: Fictional example. A second fictional report about the same fake company to show how reports add up.', 'under_review', 2],
    ['Sample Cert Academy (demo)', 'certificate', 'fake_certificate', 'sample-cert.invalid', 'DEMO: Fictional example. The certificate could not be verified on any official portal.', 'reviewed', 4],
    ['Demo Careers Hub (demo)', 'job', 'impersonation', '', 'DEMO: Fictional example. Recruiter used a free email address while claiming to represent a large company.', 'pending', 6],
    ['Demo Careers Hub (demo)', 'job', 'data_theft', '', 'DEMO: Fictional example. Asked for bank details before any interview was held.', 'pending', 7],
    ['Demo Careers Hub (demo)', 'job', 'no_offer', '', 'DEMO: Fictional example. Money was paid for a kit and no work or offer followed.', 'under_review', 9],
  ].map(([entityName, offerType, category, website, description, status, ago]) => ({
    id: crypto.randomUUID(), entityName, offerType, category, website, description, evidenceUrl: '',
    status, createdAt: new Date(Date.now() - ago * day).toISOString(), isDemo: true,
  }));
  await store.replaceReports([...demo, ...kept]);
  console.log(`Added ${demo.length} demo reports (all marked "Demo data").`);
})();
