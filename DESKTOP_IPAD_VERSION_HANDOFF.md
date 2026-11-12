# Desktop vs iPad Code Handoff

Repo:

```text
C:\Users\sl46620\Desktop\New folder\Kite_Code\react_V1
```

Purpose of this handoff:

This codebase now has two runtime behaviors in the same React app:

- Desktop version: shows an Account Plan list view first. User selects an Account Plan, then enters the normal Account Plan shell. Desktop also shows a `Legacy Account Plan` button in the sidebar after a plan is selected.
- iPad version: does not show the Account Plan list view and does not show the `Legacy Account Plan` button. It loads the normal MyInsights Account Plan shell directly from Veeva/iPad context.

This handoff is specifically for that code split. Do not add the list view or the Legacy button to iPad.

## Current Git Caveat

The desktop/iPad split is present in this local workspace as code changes. At the time this handoff was created, some of these files were still uncommitted/untracked. If another model starts from a fresh pull of `origin/react_v1`, it may not see this desktop/iPad split unless these local files are committed or copied.

Run this first:

```powershell
git status --short --branch
```

Do not reset or revert unrelated local work unless explicitly asked.

## Feature Summary

Desktop-only behavior:

1. Detect desktop runtime.
2. Show a desktop Account Plan list view.
3. Let the user open one Account Plan from that list.
4. Store that selected Account Plan ID as the app context.
5. Load the normal shell/pages for that selected plan.
6. Show a `Legacy Account Plan` sidebar button that links to the Salesforce CRM record.

iPad behavior:

1. Detect iPad/tablet runtime.
2. Skip the desktop Account Plan list view.
3. Load the normal shell/pages immediately using Veeva context.
4. Do not render the `Legacy Account Plan` sidebar button.

## Runtime Detection

File:

```text
src/lib/runtime/viewMode.js
```

Key rules:

```js
export const MOBILE_VIEW_MAX_WIDTH = 720;
export const IPAD_VIEW_MAX_WIDTH = 1400;
```

`detectRuntimeViewMode()` returns:

- `desktop`
- `ipad`
- `mobile`

Important contract:

- Width greater than `1400` becomes desktop unless iPad device signals force iPad.
- Width from `721` through `1400` becomes iPad/tablet behavior.
- Real iPad device signals also force iPad behavior:
  - UA/platform contains `iPad`
  - iPadOS desktop-style platform such as `MacIntel` with `maxTouchPoints > 1`
- If detection fails in `App.jsx`, fallback is iPad:

```js
return { viewMode: 'ipad', layoutMode: 'unknown' };
```

This fallback is deliberate so Veeva/iPad is not blocked behind the desktop list.

## Desktop List View Entry Point

Main integration file:

```text
src/App.jsx
```

Relevant imports:

```js
import AccountPlanLauncher from '@/components/AccountPlanLauncher';
import { setCurrentAccountPlanIdOverride } from '@/lib/dataservice/accountPlan/shared';
import { detectRuntimeViewMode } from '@/lib/runtime/viewMode';
```

Important state and derived values:

```js
const [runtimeViewSnapshot, setRuntimeViewSnapshot] = useState(initialRuntimeModeRef.current.snapshot);
const [isDesktopPlanSelected, setIsDesktopPlanSelected] = useState(initialRuntimeModeRef.current.shouldLoadPages);

const isDesktopView = runtimeViewSnapshot?.viewMode === 'desktop';
const shouldShowAccountPlanLauncher = isDesktopView && !isDesktopPlanSelected;
const shouldLoadAccountPlanPages = !shouldShowAccountPlanLauncher;
```

Initial load logic:

- Desktop starts with `shouldLoadPages: false`.
- iPad/mobile starts with `shouldLoadPages: true`.

The desktop list view is rendered here:

```jsx
if (shouldShowAccountPlanLauncher) {
  return (
    <div className="account-plan-launcher-frame">
      <AccountPlanLauncher onSelectPlan={handleSelectLauncherPlan} />
    </div>
  );
}
```

This means the normal shell and all page loaders are bypassed until a desktop user selects a plan.

## Desktop Plan Selection

File:

```text
src/App.jsx
```

Selection handler:

```js
const handleSelectLauncherPlan = (plan) => {
  if (!plan?.id) return;
  setCurrentAccountPlanIdOverride(plan.id);
  resetAccountPlanWorkspace();
  setPageStatus({ overview: 'loading' });
  setIsDesktopPlanSelected(true);
};
```

What it does:

- Requires `plan.id`.
- Stores the selected Account Plan ID using `setCurrentAccountPlanIdOverride`.
- Clears prior loaded page/cache state.
- Starts loading Overview.
- Switches from launcher to normal shell.

Do not remove `resetAccountPlanWorkspace()` here. Without it, switching desktop plans can reuse stale page data.

## Guarding Page Loads

File:

```text
src/App.jsx
```

Key rule:

Page loading and refresh effects must respect:

```js
shouldLoadAccountPlanPages
```

Examples:

```js
if (!shouldLoadAccountPlanPages) return;
```

This prevents desktop from silently loading whatever Veeva/mock context exists before the user chooses a plan from the list.

Do not remove these guards.

## iPad Bypass Behavior

File:

```text
src/App.jsx
```

Resize/orientation effect:

```js
if (nextSnapshot.viewMode !== 'desktop') {
  setIsDesktopPlanSelected(true);
  setPageStatus((current) => (
    Object.keys(current).length ? current : { overview: 'loading' }
  ));
}
```

Meaning:

- If runtime becomes iPad/mobile, the desktop launcher is skipped.
- The app proceeds into the normal MyInsights shell.
- This is why iPad does not see the list view.

Do not change this to show launcher on tablet/iPad.

## Desktop Account Plan List Component

UI file:

```text
src/components/AccountPlanLauncher.jsx
```

Data file:

```text
src/lib/dataservice/accountPlan/accountPlanLauncher.js
```

The component renders:

- `main.account-plan-launcher`
- search input
- refresh button
- table-like list of Account Plans
- `Open` button per row

Visible columns:

- Account Plan
- Owner
- ATC Certified
- Modified By
- Status
- Cycle Time
- Action

Each row button calls:

```jsx
onClick={() => onSelectPlan?.(plan)}
```

That selected plan is then used by `App.jsx` as the current Account Plan context.

## Desktop List Data Query

File:

```text
src/lib/dataservice/accountPlan/accountPlanLauncher.js
```

Object:

```js
const ACCOUNT_PLAN_OBJECT = 'Account_Plan_vod__c';
```

It gets the current user:

```js
const ownerId = await getDataForCurrentObject('User', 'Id');
```

Then queries Account Plans owned by that user:

```js
where: buildIdMatchWhere('OwnerId', ownerId)
```

Desktop list fields include relationship fields:

```js
'Owner.Name'
'LastModifiedBy.Name'
```

That query intentionally passes:

```js
allowDottedFields: true
```

If relationship fields fail, it retries without dotted fields and queries `User` once to resolve owner/modified-by names.

Do not use this relationship-field approach in shared iPad page loaders.

## Query Boundary for Desktop vs iPad

File:

```text
src/lib/dataservice/query.js
```

Default behavior:

- Dotted/cross-object fields are stripped by default.
- This protects iPad/offline VQL.

Explicit desktop opt-in:

```js
allowDottedFields: true
```

Only the desktop Account Plan launcher should normally use this opt-in.

Test file:

```text
test/queryAllowDottedFields.test.mjs
```

This test verifies:

- default `runQuery` strips dotted fields
- explicit desktop `allowDottedFields: true` preserves dotted fields

## Selected Account Plan Override

File:

```text
src/lib/dataservice/accountPlan/shared.js
```

Helper:

```js
export const setCurrentAccountPlanIdOverride = (planId) => {
  const nextPlanId = isLikelySalesforceId(planId) ? String(planId).trim() : null;
  currentAccountPlanIdOverride = nextPlanId;
  if (typeof window !== 'undefined') {
    if (nextPlanId) {
      window.__KAM_ACCOUNT_PLAN_ID__ = nextPlanId;
    } else {
      delete window.__KAM_ACCOUNT_PLAN_ID__;
    }
  }
  clearAccountPlanContextCache();
  return nextPlanId;
};
```

Why it matters:

- Desktop list selection has to override the Account Plan context.
- The override is checked first by `getCurrentAccountPlanId()`.
- Cache clearing prevents one selected desktop plan from leaking into the next.

Plan resolution order:

1. `window.__KAM_ACCOUNT_PLAN_ID__` override
2. Veeva DS current `Account_Plan_vod__c` ID
3. `window.HTMLConfig.currentObjectID`
4. URL/referrer ID
5. Current Account -> latest Account Plan

Desktop uses step 1. iPad usually uses step 2 or 3.

## Desktop-Only Legacy Account Plan Button

Files:

```text
src/App.jsx
src/components/Sidebar.jsx
src/components/Sidebar.css
```

App passes the button ID only on desktop:

```jsx
legacyAccountPlanId={isDesktopView ? shellPlanId : null}
```

This is the key line that keeps the button off iPad.

Sidebar renders the button only when a URL can be built:

```jsx
{legacyAccountPlanUrl && (
  <a
    className="sidebar-legacy-account-plan"
    href={legacyAccountPlanUrl}
    target="_top"
    aria-label="Open Legacy Account Plan record in CRM"
  >
    Legacy Account Plan
  </a>
)}
```

Base URL:

```js
const LEGACY_ACCOUNT_PLAN_RECORD_BASE_URL =
  'https://kitepharma--kitefull.sandbox.lightning.force.com/lightning/r/Account_Plan_vod__c';
```

Styling:

```text
src/components/Sidebar.css
.shell-sidebar .sidebar-legacy-account-plan
```

Do not render this link on iPad. The current code prevents it by passing `null` outside desktop.

## Desktop Launcher Styling

File:

```text
src/styles/main.css
```

Main selectors:

```css
.account-plan-launcher-frame
.account-plan-launcher
.account-plan-launcher-panel
.account-plan-launcher-panel-head
.account-plan-launcher-table
.account-plan-launcher-row
.account-plan-launcher-open
```

Important layout rule:

```css
.account-plan-launcher-frame {
  height: calc(100vh - 24px);
  overflow-y: auto;
  overflow-x: hidden;
}
```

This makes the desktop list own its own vertical scroll.

The launcher is intentionally a compact data table, not a hero page.

## Mock Data Needed for Local Desktop Preview

File:

```text
src/lib/mockData/fixtures.js
```

Account Plan fixture rows currently include multiple plans for the launcher:

- `a0X8C00000Mock1AAB` - `FY26 - Mock Cancer Center Plan`
- `a0X8C00000Mock2AAC` - `ACT Plan 009`
- `a0X8C00000Mock3AAD` - `FOX CHASE TEMPLE UNIVERSITY HOSPITAL BONE MARROW TRANSPLANT PROGRAM`

Rows include fields used by the desktop list:

- `OwnerId`
- `Owner.Name`
- `LastModifiedById`
- `LastModifiedBy.Name`
- `KPH_ATC_Certified_Date__c`
- `KPH_Plan_status__c`
- `KPH_Improved_cycle_time_performance__c`

Do not reduce mock Account Plans back to a single row if local desktop list preview is needed.

## Tests for This Split

Runtime mode:

```text
test/runtimeViewMode.test.mjs
```

Desktop launcher and Legacy button:

```text
test/desktopAccountPlanLauncher.test.mjs
```

Dotted field boundary:

```text
test/queryAllowDottedFields.test.mjs
```

Recommended command:

```powershell
node --test test/runtimeViewMode.test.mjs test/desktopAccountPlanLauncher.test.mjs test/queryAllowDottedFields.test.mjs
```

Build:

```powershell
npm run build
```

Known build note:

Vite/postbuild may print warnings about `static/q.js` and `static/MyInsightsLibrary.js` script tags not being bundled without `type="module"`. The build can still succeed and produce the self-contained Veeva bundle.

## Manual Rendered QA

Start local dev server:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Desktop check:

- Use viewport wider than `1400`, for example `1440x900`.
- App should open to Account Plan list view.
- Open `FY26 - Mock Cancer Center Plan`.
- Normal shell should load.
- Sidebar should show `Legacy Account Plan`.

iPad check:

- Use viewport such as `820x1180` or `1024x768`.
- App should skip Account Plan list view.
- Normal shell should load directly.
- Sidebar should not show `Legacy Account Plan`.

## Things Another Model Should Not Break

- Do not show the desktop list view on iPad/tablet.
- Do not show `Legacy Account Plan` on iPad/tablet.
- Do not remove `shouldLoadAccountPlanPages` guards.
- Do not let desktop load normal Account Plan pages before the user selects a plan.
- Do not remove `setCurrentAccountPlanIdOverride()` or its cache clearing.
- Do not add dotted fields to shared page loaders.
- Do not remove the default dotted-field stripping in `query.js`.
- Do not assume only real iPad hardware maps to iPad mode; the tablet breakpoint also maps to iPad mode.
- Do not turn the desktop launcher into a marketing/hero page. It is a functional list/table view.
- Do not stage unrelated local files accidentally.

