# TrustCheck

> Fake internships? Fake certifications? No more after us.

TrustCheck helps students check whether an internship offer, company or certificate looks legitimate. It combines three independent checks and shows the evidence behind every result.

| Layer | What it does |
|---|---|
| 1. Verified database | Matches the name against a curated list of real organisations, spots lookalike names, and checks that a pasted website/email uses the official domain. |
| 2. Scam keyword detection | Scans the name and any pasted offer text for red-flag phrases (upfront fees, OTP requests, guaranteed placement, etc.). |
| 3. Community reports | Looks up reports other users submitted about the same name. Reports are labelled as unverified allegations. |

## Run it (2 minutes)

You only need **Node.js 18 or newer**. There is nothing to install: the server uses only Node's built-in modules.

```bash
git clone <your-repo-url>
cd trustcheck
npm start
```

Open **http://localhost:3000**.

Useful commands:

```bash
npm run dev               # auto-restart on file changes
npm test                  # run the automated tests
npm run demo-data         # add clearly-labelled FICTIONAL reports for a demo
npm run demo-data:clear   # remove them again
PORT=8080 npm start       # use another port (Windows PowerShell: $env:PORT=8080; npm start)
```

## Project structure

```
server.js            HTTP server + JSON API + static hosting
lib/verify.js        The three-layer verification engine (the "brain")
lib/reports.js       Report validation, categories and statuses
lib/store.js         Reads/writes data files (swap this for MySQL later)
data/entities.json   Layer 1 verified database (edit this to grow it)
data/reports.json    Created at runtime; community reports (git-ignored)
public/              The website (plain HTML/CSS/JS, no build step)
  js/components.js   Reusable UI components (Badge, Cards, States, SearchForm…)
  js/pages/          One file per screen
scripts/demo-data.js Demo report generator
test/                Automated tests
```

## Screens

Home · Verification results · Report a scam · Community reports · How it works. Every screen has loading, empty, error and success states, and the layout works on laptops, tablets and phones.

## How the result is decided

- **VERIFIED**: exact name/alias match in the database and no warning signs.
- **SUSPICIOUS**: strong scam phrases, a wrong domain or free email claiming to be a verified company, a lookalike name plus scam phrases, or 3+ community reports on an unverified name.
- **UNVERIFIED**: everything else. *Not being in the database does not mean something is fake.*

The **signal score (0–100)** is calculated from the checks, and the "How is this calculated?" panel on the results page lists every point added or removed. It is a heuristic summary and is **not** an accuracy rate or a scam probability. The app never shows an accuracy percentage.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/verify` | `{ query, type, context? }` → verdict, three checks, score |
| GET | `/api/reports` | `?q=&category=&status=&sort=&page=&limit=` |
| POST | `/api/reports` | Submit a report (validated server-side, rate-limited) |
| GET | `/api/stats` | Real counts used on the home page |
| GET | `/api/entities` | The verified database list |
| PATCH | `/api/reports/:id` | Moderation: change status (needs `ADMIN_TOKEN`) |

### Moderating reports

New reports start as **Pending review**. To change a status, set `ADMIN_TOKEN` (see `.env.example`, 8+ characters) and call:

```bash
curl -X PATCH http://localhost:3000/api/reports/<report-id> \
  -H "x-admin-token: YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"reviewed"}'
```

Statuses: `pending`, `under_review`, `reviewed`, `dismissed` (dismissed reports are hidden and ignored by the checks).

## Growing the verified database

Add entries to `data/entities.json` (`name`, `aliases`, `kinds`, `domains`, `note`). **Confirm each organisation's official domain on its own website first.** The seed list is small on purpose: please review it before presenting it as a real dataset.

## Deploying

Any host that runs Node works (Render, Railway, Fly.io, a VPS). Start command: `npm start`. Set `TRUST_PROXY=1` behind a proxy so rate limiting sees real client IPs. Reports are stored in `data/reports.json`, so use a persistent disk (or move `lib/store.js` to a database) on hosts with ephemeral storage.

## Safety and privacy notes

- Offer text pasted into the checker is analysed in memory and is **not stored**.
- Reports contain no reporter identity. The form warns users not to include their own sensitive details.
- All user content is HTML-escaped on display; evidence links must be http(s); the server sets a Content-Security-Policy; report submissions have a honeypot field and a rate limit.
- Automated checks can be wrong. The app tells users to confirm offers on official websites.

## Relationship to the project slides

The slides describe a Java/JavaFX/MySQL desktop design with an MVC structure. This version is a web app so it can run in a browser, but it keeps the same ideas: the same three layers, `lib/verify.js` plays the Model/Controller role, and `public/` is the View. The logic in `lib/verify.js` is simple enough to port to Java if the team wants a JavaFX client later.

The slides also mention "95%+ accuracy" and a "70% of students" statistic. Those figures are not measured or sourced anywhere in this project, so the app does not display them. Measure accuracy on a labelled test set, or cite a real source, before using such numbers in a presentation.
