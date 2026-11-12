# Kite MyInsights v2 (scaffold)

React + Vite rewrite of the [Kite Account Planning MyInsights](../kite_myinsights_accountplan)
project. **Only the Home page is implemented** — every other route is a
"Coming soon" placeholder. Use this as the foundation, then port one page
at a time.

The structure follows the pattern used in
[`site_crm_v1`](../site_crm_v1) (a Veeva MyInsights project written in
Vue): a thin Veeva data-service layer, a mock adapter for local
development, and small per-card components.

## Run it

```bash
cd C:\Users\hg47681\Desktop\kite_myinsights_v2
npm install
npm run dev
```

The dev server prints a `localhost:5173` URL. Since `window.ds` doesn't
exist outside of Veeva, the data layer transparently falls back to the
mock adapter and the Home page renders with fixture data.

## Build for Veeva CRM

```bash
npm run build
```

Outputs to `dist/`. The build uses `base: './'` so every asset path is
relative — required because Veeva MyInsights serves the zip from an
unknown CDN URL. Zip `dist/` and upload it as the MyInsights HTML
content the same way you ship the legacy app.

## Folder structure

```
kite_myinsights_v2/
├── index.html                       # loads q.js + MyInsightsLibrary.js, then mounts React
├── package.json
├── vite.config.js
├── public/static/
│   ├── q.js                         # Veeva's Q promise lib (copied from site_crm_v1)
│   └── MyInsightsLibrary.js         # Veeva's data service bridge
└── src/
    ├── main.jsx                     # React entry — createRoot + <App />
    ├── App.jsx                      # shell: sidebar + main, loads overview on mount
    ├── components/
    │   └── Sidebar.jsx              # nav rail + sidebar account card
    ├── pages/
    │   └── Overview/                # one folder per route
    │       ├── index.jsx            # composes the 6 cards below
    │       ├── AccountStrip.jsx     # ATC cohort / segment / KLT / KAD / Referral / MM
    │       ├── ServiceLineGoals.jsx
    │       ├── KiteStrategy.jsx     # DLBCL + MM pill lists
    │       ├── BarriersDriversSummary.jsx
    │       ├── UrgentActivities.jsx
    │       └── PodUsers.jsx
    ├── lib/
    │   ├── dataservice/
    │   │   ├── client.js            # grabs window.Q + window.ds (or mockAdapter in dev)
    │   │   ├── query.js             # thin wrappers: runQuery, viewRecord, etc.
    │   │   └── accountPlan.js       # composer: one loadOverview() call returns everything
    │   ├── helper/
    │   │   └── utils.js             # formatDate, daysFromNow, truncate, ...
    │   └── mockData/
    │       ├── mockAdapter.js       # implements the same surface as window.ds
    │       └── fixtures.js          # VOD-shaped canned rows
    └── styles/
        └── main.css                 # pared-down stylesheet; iterate from here
```

## How the data layer works

`src/lib/dataservice/client.js` is the only place that touches Veeva globals:

```js
const hasVeeva = typeof window !== 'undefined' && !!window.ds;
export const ds = hasVeeva ? window.ds : mockAdapter;
```

Everything else imports `{ ds, $q, isOnline }` from there. To swap in a
fake Veeva (e.g. for a Storybook demo), point that single line at
something else.

The Overview page's data needs are expressed in **one** call:

```js
import { loadOverview } from '@/lib/dataservice/accountPlan';

const { plan, account, profile, barriers, drivers, criticalActivities } =
  await loadOverview();
```

That composer fans out to 5 Veeva queries in parallel, unwraps the VOD
`{ value: x }` cells, and returns flat objects.

## Adding the next page

1. Create `src/pages/Foo/index.jsx` and any child cards.
2. Add a composer in `src/lib/dataservice/` (e.g. `barriers.js`) that
   returns the shapes the page wants.
3. Add `Foo` to the `PAGES` array in `App.jsx` with `implemented: true`
   and route to it in the `activeKey !== 'overview'` branch.
4. Extend `mockAdapter.js` / `fixtures.js` with rows for the new
   object(s) so the page works on localhost.

## Field references (where the Veeva schema came from)

Field lists in `accountPlan.js` were lifted from the legacy
`scripts/entity-specs.js` in the source project. If a field looks wrong,
that's the file to cross-check against.
