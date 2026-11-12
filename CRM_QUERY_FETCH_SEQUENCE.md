# CRM Query Fetch Sequence

Source branch/checkout: `react_v2` in `react_V1`.

This document traces the CRM read path used by the React MyInsights app. It is
focused on fetch/query operations, not create/update/delete save calls.

Primary source files:

- `src/App.jsx`
- `src/components/AccountPlanLauncher.jsx`
- `src/lib/dataservice/client.js`
- `src/lib/dataservice/query.js`
- `src/lib/dataservice/accountPlan/accountPlanLauncher.js`
- `src/lib/dataservice/accountPlan/shared.js`
- `src/lib/dataservice/accountPlan/home.js`
- `src/lib/dataservice/accountPlan/barriersDrivers.js`
- `src/lib/dataservice/accountPlan/criticalActivities.js`
- `src/lib/dataservice/accountPlan/crossFunctionalPlan.js`
- `src/lib/dataservice/accountPlan/accountProfile.js`
- `src/lib/dataservice/accountPlan/stakeholders.js`
- `src/lib/dataservice/accountPlan/teamMembers.js`
- `src/lib/export/accountPlanPpt.js`

## Read Primitives

All CRM reads ultimately go through `src/lib/dataservice/query.js`.

| Wrapper | Veeva primitive | Await behavior in wrapper | Notes |
| --- | --- | --- | --- |
| `runQuery(params)` | `ds.runQuery(params)` | Not declared `async`; returns a Promise from `.then(...)` | Main VQL/SOQL-style read. In-flight identical requests are coalesced. No settled cache is kept. Dotted fields are stripped unless `allowDottedFields: true`. |
| `getDataForCurrentObject(object, field)` | `ds.getDataForCurrentObject(object, field)` | Not declared `async`; returns a Promise from `.then(...)` | Used to get current Account Plan, current Account, and current User context. In-flight identical requests are coalesced. |
| `getPicklistValueLabels(object, field)` | `ds.getPicklistValueLabels(object, field)` | Not declared `async`; returns a Promise from `.then(...)` | Used for dropdown metadata. In-flight identical requests are coalesced. Failed metadata reads return `{}`. |
| `getObjectMetadata(object)` | `ds.getObjectMetadata({ object })` | Not declared `async`; returns a Promise from `.then(...)` | Used for dependent picklist metadata. In-flight identical requests are coalesced. Failed/unavailable metadata returns `null`. |

Important optimization note: the in-flight maps dedupe only overlapping
requests. Once a request resolves, the key is deleted. Later navigation or
background export preparation can re-query the same data.

## Runtime Split

`App.jsx` calls `detectRuntimeViewMode()` on startup.

| Runtime | First screen | First CRM read path |
| --- | --- | --- |
| Desktop hosted/local web | Desktop Account Plan launcher | `AccountPlanLauncher -> fetchCurrentUserAccountPlans()` |
| iPad/offline tablet path | Shell starts directly on Home | `loadPage('overview') -> loadHome()` |
| Mobile | Same as non-desktop shell path | `loadPage('overview') -> loadHome()` |

Desktop after selecting a plan uses `setCurrentAccountPlanIdOverride(plan.id)`.
That means later `requireCurrentAccountPlanId()` returns the selected plan id
from the override instead of calling `getDataForCurrentObject('Account_Plan_vod__c', 'Id')`.

iPad does not use the desktop launcher. Unless an override exists,
`requireCurrentAccountPlanId()` resolves the current Account Plan from the Veeva
context each time a loader starts. Concurrent loaders share the same in-flight
resolution, but later loaders can resolve it again.

## Current Account Plan Resolution

Used by every page loader through `requireCurrentAccountPlanId()`.

| Order | Operation | CRM call? | Await style | Query/API details |
| --- | --- | --- | --- | --- |
| 1 | Read override `window.__KAM_ACCOUNT_PLAN_ID__` / module override | No | Sync | Desktop launcher selection sets this. |
| 2 | Current Account Plan id | Yes | `await getDataForCurrentObject(...)` | `getDataForCurrentObject('Account_Plan_vod__c', 'Id')` |
| 3 | `HTMLConfig.currentObjectID` / parent / top | No | Sync | iPad fallback when DS context is missing. |
| 4 | URL/referrer scrape | No | Sync | Looks for `id`, `recordId`, `cpId`, `accountPlanId`. |
| 5 | Current Account id | Yes | `await getDataForCurrentObject(...)` | `getDataForCurrentObject('Account', 'Id')` |
| 6 | Most recent Account Plan for Account | Yes | `await runQuery(...)` | Object `Account_Plan_vod__c`; fields `['Id']`; where `Account_vod__c = <current Account Id variants>`; sort `LastModifiedDate DESC`; limit `1`. |

## Shared Shell Context

Most page loaders call `resolveShellContextForPlanId(planId)`.

This gives sidebar/header data and runs as:

| Order | Operation | Await style | Query details |
| --- | --- | --- | --- |
| S1 | Fetch Account Plan row | `await fetchPlan(...)` | Object `Account_Plan_vod__c`; fields `PLAN_FIELDS`; where `Id = <plan id variants>`; limit `1`. |
| S2 | Fetch parent Account | `await fetchAccount(...)` after S1 | Internally uses `await Promise.all(...)` for Account base fields and MM ATC priority field. |
| S2a | Account base fields | Inside `await Promise.all(...)` | Object `Account`; fields `ACCOUNT_FIELDS`; where `Id = <Account_vod__c variants>`; limit `1`. |
| S2b | Account MM ATC priority | Inside `await Promise.all(...)` | Object `Account`; fields `['Id', 'KPH_MM_ATC_Priority__c']`; where `Id = <Account_vod__c variants>`; limit `1`; failure is swallowed and returns `null`. |

`resolveShellContextForPlanId()` has an in-flight cache keyed by plan id and
field list. During concurrent page preloads, loaders that use the same default
`PLAN_FIELDS` can share one shell request. The Cross Functional Plan page uses
`POA_CONTEXT_FIELDS`, so that is a separate shell-context query.

## Desktop Startup Sequence

Desktop does not load Home immediately. It renders `AccountPlanLauncher`.

Component code uses `.then(...)` in `loadRows()`; inside the data service,
`fetchCurrentUserAccountPlans()` is an `async` function with sequential awaits.

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| D1 | Current User id | `await getDataForCurrentObject(...)` | `getDataForCurrentObject('User', 'Id')` |
| D2 | Account Plans where user is a team member | `await runQuery(...)` | Object `Account_Team_Member_vod__c`; fields `TEAM_MEMBER_PLAN_FIELDS`; where `Team_Member_vod__c = <User Id variants> AND (KPH_Is_Deleted__c = false OR KPH_Is_Deleted__c = null)`; sort `Name ASC`. |
| D3 | Accessible Account Plans | `await fetchAccessibleAccountPlans(...)` | Object `Account_Plan_vod__c`; fields `ACCOUNT_PLAN_LAUNCHER_RELATIONSHIP_FIELDS`; where `(Id IN <team-member plan ids> OR OwnerId = <User Id variants>)`; sort `Name ASC`; `allowDottedFields: true`. |
| D3 fallback | Accessible Account Plans without relationship fields | Conditional `await` if D3 fails | Object `Account_Plan_vod__c`; fields `ACCOUNT_PLAN_LAUNCHER_FALLBACK_FIELDS`; same where/sort; no dotted fields. |
| D4 | Owner/LastModifiedBy user-name lookup | Conditional `await runQuery(...)` | Object `User`; fields `['Id', 'Name']`; where `Id IN <OwnerId + LastModifiedById>`; limit = number of ids. Runs only when fallback was used or relationship names are missing. |

After the user clicks a plan:

1. `setCurrentAccountPlanIdOverride(plan.id)` stores the selected plan id.
2. `resetAccountPlanWorkspace()` clears page caches.
3. `pageStatus.overview = 'loading'`.
4. `isDesktopPlanSelected = true`.
5. The app follows the same shell/page loading sequence as the iPad Home path,
   except current plan id comes from the override instead of DS context.

## iPad Startup Sequence

iPad skips the launcher and starts directly on Home.

Top-level call:

`App.jsx -> loadPage('overview') -> loadHome()`

### iPad/Home Strict Order

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| I1 | Resolve current plan id | `await requireCurrentAccountPlanId()` | Uses the current-plan resolution chain above. |
| I2 | Start shell context | Promise created, not awaited yet | `const shellContextPromise = resolveShellContextForPlanId(planId)` starts S1/S2. |
| I3 | Fan out Home batch | `await Promise.all([...])` | The seven entries below run concurrently after plan id is known. |
| I3a | Shell context | Member of `Promise.all` | See Shared Shell Context. |
| I3b | Header strip | Member of `Promise.all` | Object `KPH_Ecosystem_Plan__c`; fields `ECOSYSTEM_PLAN_FIELDS`; where `KPH_Account_Plan__c = <plan id variants>`; sort `LastModifiedDate DESC`; limit `1`. |
| I3c | Barriers/Drivers | Member of `Promise.all` | Object `KPH_Barriers_and_Tactical_Actions__c`; fields `BARRIER_DRIVER_FIELDS`; where `KPH_Account_Plan__c = <plan id variants>`; sort `Name ASC`; optional retry without inaccessible optional fields. |
| I3d | Critical Activities | Member of `Promise.all` | Object `KPH_Additional_Critical_Activities__c`; fields `ACTIVITY_FIELDS`; where `KPH_Account_Plans__c = <plan id variants> AND soft-delete-active`; sort `LastModifiedDate DESC`; then conditionally queries `User` for `CreatedById` names. |
| I3e | Team Members by plan | Member of `Promise.all` | Object `Account_Team_Member_vod__c`; fields `TEAM_MEMBER_BY_PLAN_FIELDS`; where `Account_Plan_vod__c = <plan id variants> AND soft-delete-active`; sort `Name ASC`. |
| I3f | Plan Strategies | Member of `Promise.all` | Object `KPH_Strategy__c`; fields `PLAN_STRATEGY_FIELDS`; where `KPH_Account_Plan__c = <plan id variants>`; sort `Name ASC`. |
| I3g | Home picklist metadata | Member of `Promise.all` | Runs 13 `getPicklistValueLabels(...)` calls in parallel, then awaits `getObjectMetadata('KPH_Barriers_and_Tactical_Actions__c')` for dependent strategy picklist metadata. |
| I4 | Fetch referral accounts and POD users after header returns | `await Promise.all([...])` | These depend on `headerResult.ecosystemPlanId`. |
| I4a | Referral Account rows | Member of `Promise.all` | Object `KPH_Ecosystem_Map_Dynamics__c`; fields `REFERRAL_ACCOUNT_FIELDS`; where `Account_Plan_vod__c = <plan id variants> AND KPH_Account_Profile__c = <ecosystem profile id variants> AND soft-delete-active`; sort `Name ASC`; then Account name lookup for site ids. |
| I4b | POD Users by ecosystem plan | Member of `Promise.all` | Object `Account_Team_Member_vod__c`; fields `POD_USER_FIELDS`; where `KPH_Ecosystem_Plan__c = <ecosystem profile id variants> AND soft-delete-active`. |

Home picklist metadata (`I3g`) calls:

| Object | Field |
| --- | --- |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_Status__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_Indication__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_Strategy__c` |
| `KPH_Strategy__c` | `KPH_Strategy_Rank__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_Barrier_Type__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_Driver_Type__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_MM_Barrier_Type__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_MM_Driver_Type__c` |
| `KPH_Barriers_and_Tactical_Actions__c` | `KPH_Rank_1__c` |
| `KPH_Additional_Critical_Activities__c` | `KPH_Status__c` |
| `KPH_Additional_Critical_Activities__c` | `KPH_Indication__c` |
| `KPH_Additional_Critical_Activities__c` | `KPH_Accountable_POD_Members__c` |
| `Account_Team_Member_vod__c` | `KPH_Participation__c` |

## Startup Priority Preload Order

After account-plan pages are allowed to load, `App.jsx` starts the active page
first. It then schedules only the Stakeholders and Team Members loaders with
`STARTUP_PRELOAD_DELAY_MS` set to `0`.

This means the Stakeholders and Team Members CRM requests start while the
Account Plan/Home load is underway, not after Home reaches `ready`.

The startup priority preload list is:

1. Stakeholders
2. Team Members

If a user clicks Stakeholders or Team Members while its startup preload is
already in flight, the active page effect reuses that same request instead of
forcing a second loader.

The startup preloader calls `loadPage(page.key, { background: true })` for each
target. The actual CRM queries from different page loaders overlap, and
identical in-flight low-level reads still coalesce through `query.js` and the
shared shell-context in-flight map.

## After Home Is Ready: Remaining Background Preload Order

After Home reaches `ready`, `App.jsx` still waits
`NAVIGATION_PRELOAD_DELAY_MS` (120 ms) and starts remaining page preloads for
implemented pages that are not already loaded or in flight.

The remaining preload target list is created from `PAGES` order:

1. Barriers & Drivers
2. Critical Activities
3. Cross functional Plan of Action
4. Account Profile
5. Stakeholders
6. Team Members

`Account Insights` is not loaded as a separate data request because it shares
the Account Profile loader/data key (`dataKey: 'kpi'`).

Important: the code then runs:

```js
await Promise.all(preloadTargets.map((page) =>
  loadPage(page.key, { background: true })
))
```

So page loaders are started in that array order, but the actual CRM queries
from different page loaders overlap. Barriers & Drivers, Critical Activities,
Cross Functional POA, and Account Profile keep the same post-Home preload timing
as before. Stakeholders and Team Members are skipped here if the startup pass
already loaded them or has them in flight.

## Page Loader Query Details

### Barriers & Drivers

Top-level call: `loadBarriersDrivers()`

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| BD1 | Resolve plan id | `await requireCurrentAccountPlanId()` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| BD2 | Fan out page batch | `await Promise.all([...])` | Six members run concurrently after plan id is known. |
| BD2a | Shell context | Member of `Promise.all` | Default shell context. |
| BD2b | Barriers/Drivers | Member of `Promise.all` | Same as Home I3c. |
| BD2c | Critical Activities | Member of `Promise.all` | Same as Home I3d. |
| BD2d | Plan Strategies | Member of `Promise.all` | Same as Home I3f. |
| BD2e | Barrier/Driver picklists | Member of `Promise.all` | Nine `getPicklistValueLabels(...)` calls, then `getObjectMetadata(...)` for strategy dependency metadata. |
| BD2f | Critical Activity picklists | Member of `Promise.all` | Three `getPicklistValueLabels(...)` calls. |

Barrier/Driver picklist metadata:

- `KPH_Barriers_and_Tactical_Actions__c.KPH_Status__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_Indication__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_Strategy__c`
- `KPH_Strategy__c.KPH_Strategy_Rank__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_Barrier_Type__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_Driver_Type__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_MM_Barrier_Type__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_MM_Driver_Type__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_Rank_1__c`
- after those resolve: `getObjectMetadata('KPH_Barriers_and_Tactical_Actions__c')`

Critical Activity picklist metadata:

- `KPH_Additional_Critical_Activities__c.KPH_Status__c`
- `KPH_Additional_Critical_Activities__c.KPH_Indication__c`
- `KPH_Additional_Critical_Activities__c.KPH_Accountable_POD_Members__c`

### Critical Activities

Top-level call: `loadCriticalActivities()`

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| CA1 | Resolve plan id | `await requireCurrentAccountPlanId()` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| CA2 | Fan out page batch | `await Promise.all([...])` | Four members run concurrently. |
| CA2a | Shell context | Member of `Promise.all` | Default shell context. |
| CA2b | Critical Activities | Member of `Promise.all` | Same as Home I3d. |
| CA2c | Barriers/Drivers | Member of `Promise.all` | Same as Home I3c. |
| CA2d | Critical Activity picklists | Member of `Promise.all` | Four `getPicklistValueLabels(...)` calls. |

Critical Activity picklist metadata:

- `KPH_Additional_Critical_Activities__c.KPH_Status__c`
- `KPH_Additional_Critical_Activities__c.KPH_Indication__c`
- `KPH_Additional_Critical_Activities__c.KPH_Accountable_POD_Members__c`
- `KPH_Barriers_and_Tactical_Actions__c.KPH_Status__c`

### Cross Functional Plan of Action

Top-level call: `loadCrossFunctionalPlan()`

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| POA1 | Resolve plan id | `await requireCurrentAccountPlanId()` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| POA2 | Fan out page batch | `await Promise.all([...])` | Shell context and current-user context run concurrently. |
| POA2a | Shell context with POA fields | Member of `Promise.all` | Object `Account_Plan_vod__c`; fields `POA_CONTEXT_FIELDS`; where `Id = <plan id variants>`; limit `1`; then Account lookup. This is a separate shell-context key from default `PLAN_FIELDS`. |
| POA2b | Current POA user | Member of `Promise.all` | See POA2b nested steps. |
| POA2b.1 | Current User id | Inside `await Promise.all(...)` | `getDataForCurrentObject('User', 'Id')` |
| POA2b.2 | Current User profile name | Inside `await Promise.all(...)` | Sequentially tries `getDataForCurrentObject('User', 'Profile_Name_vod_c')`; if empty, then `getDataForCurrentObject('User', 'Profile_Name_vod__c')`. |
| POA2b.3 | Team Members by plan | Conditional `await` after User id | Object `Account_Team_Member_vod__c`; fields `TEAM_MEMBER_BY_PLAN_FIELDS`; where `Account_Plan_vod__c = <plan id variants> AND soft-delete-active`; sort `Name ASC`. |

### Account Profile / Account Insights

Top-level call: `loadAccountProfile()`

Used by both sidebar tabs:

- `Account Profile` (`key: 'kpi'`)
- `Account Insights` (`key: 'account-insights'`, `dataKey: 'kpi'`)

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| AP1 | Resolve plan id | `await requireCurrentAccountPlanId()` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| AP2 | Start shell context | Promise created, not awaited yet | Default shell context. |
| AP3 | Start profile query | Promise created, not awaited yet | Object `KPH_Ecosystem_Plan__c`; fields `ACCOUNT_PROFILE_FIELDS`; where `KPH_Account_Plan__c = <plan id variants>`; sort `LastModifiedDate DESC`; limit `1`. |
| AP4 | Start child records after profile | Promise chain, not awaited yet | `profilePromise.then(profile => fetchAccountProfileChildRecords(...))`. |
| AP5 | Fan out main Account Profile batch | `await Promise.all([...])` | Six members run concurrently where possible. |
| AP5a | Shell context | Member of `Promise.all` | Default shell context. |
| AP5b | Profile row | Member of `Promise.all` | AP3 query. |
| AP5c | Profile question picklists | Member of `Promise.all` | Ten `getPicklistValueLabels('KPH_Ecosystem_Plan__c', <field>)` calls. |
| AP5d | Referral indication picklist | Member of `Promise.all` | `getPicklistValueLabels('KPH_Ecosystem_Map_Dynamics__c', 'Indication__c')` |
| AP5e | Account Insight indication picklist | Member of `Promise.all` | `getPicklistValueLabels('KPH_Monthly_Executive_Summary__c', 'Indication__c')` |
| AP5f | Child records | Member of `Promise.all`; starts after AP3 resolves | See child sequence below. |

Profile question picklist fields on `KPH_Ecosystem_Plan__c`:

- `KPH_Is_capacity_having_an_impact_on_CART__c`
- `KPH_What_of_CART_business_is_done_OP__c`
- `KPH_Financial_and_or_reimbursement__c`
- `KPH_Does_ATC_prefer_CART_administration__c`
- `KPH_If_Yes_to_above_reasons__c`
- `KPH_Bispecifics_for_DLBCL_being_used__c`
- `KPH_Bispecific_use_in_DLBCL_impact_CART__c`
- `KPH_If_ATC_is_using_OP_do_they__c`
- `KPH_Is_there_direct_competition_from__c`
- `KPH_If_yes_in_what_indication__c`

Child records sequence:

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| AP-child1 | Fetch child row groups | `Promise.all([...]).then(...)` | Three row-group queries run concurrently. |
| AP-child1a | Referral rows | Member of `Promise.all` | Object `KPH_Ecosystem_Map_Dynamics__c`; fields `REFERRAL_ACCOUNT_FIELDS`; where plan + profile + soft-delete-active; sort `Name ASC`. |
| AP-child1b | Account Insights | Member of `Promise.all` | Object `KPH_Monthly_Executive_Summary__c`; fields `ACCOUNT_INSIGHT_FIELDS`; where `KPH_Account_Profile__c = <profile id variants> AND soft-delete-active`; sort `LastModifiedDate DESC`, `Name ASC`; then conditionally queries `User` for CreatedBy names. |
| AP-child1c | Healthcare Networks | Member of `Promise.all` | Object `KPH_Other_Healthcare_Networks__c`; fields `HEALTHCARE_NETWORK_FIELDS`; where `KPH_Account_Profile__c = <profile id variants> AND soft-delete-active`; sort `Name ASC`; failures are treated as empty because the object is optional. |
| AP-child2 | Account names for referral/network ids | `.then(...)` after AP-child1 | Object `Account`; fields `['Id', 'Name']`; where `Id = <any referral site or healthcare network account id variants>`; sort `Name ASC`. |

### Stakeholders

Top-level call: `loadStakeholders()`

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| SH1 | Resolve plan id | `await requireCurrentAccountPlanId()` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| SH2 | Fan out page batch | `await Promise.all([...])` | Three members run concurrently. |
| SH2a | Shell context | Member of `Promise.all` | Default shell context. |
| SH2b | Stakeholder rows | Member of `Promise.all` | Object `KPH_Stakeholder_Map__c`; fields `STAKEHOLDER_FIELDS`; where `KPH_Account_Plan__c = <plan id variants> AND soft-delete-active`; sort `Name ASC`; then Account person-name lookup for `KPH_Account__c`. |
| SH2c | Stakeholder picklists | Member of `Promise.all` | Eight `getPicklistValueLabels(...)` calls. |

Stakeholder picklist fields on `KPH_Stakeholder_Map__c`:

- `KPH_DLBCL_Clinical_Influence__c`
- `KPH_DLBCL_Financial_Influence__c`
- `KPH_DLBCL_Operational_Influence__c`
- `KPH_MM_Clinical_Influence__c`
- `KPH_MM_Financial_Influence__c`
- `KPH_MM_Operational_Influence__c`
- `KPH_Priority__c`
- `KPH_Title__c`

Stakeholder person-name lookup:

- Object `Account`
- Fields `['Id', 'Name', 'IsPersonAccount']`
- Where `(Id = <KPH_Account__c variants>) AND IsPersonAccount = true`
- Sort `Name ASC`

### Team Members

Top-level call: `loadTeamMembers()`

| Order | Operation | Await style | Query/API details |
| --- | --- | --- | --- |
| TM1 | Resolve plan id | `await requireCurrentAccountPlanId()` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| TM2 | Fan out page batch | `await Promise.all([...])` | Four members run concurrently. |
| TM2a | Shell context | Member of `Promise.all` | Default shell context. |
| TM2b | Team Members by plan | Member of `Promise.all` | Object `Account_Team_Member_vod__c`; fields `TEAM_MEMBER_BY_PLAN_FIELDS`; where `Account_Plan_vod__c = <plan id variants> AND soft-delete-active`; sort `Name ASC`. |
| TM2c | Participation picklist | Member of `Promise.all` | `getPicklistValueLabels('Account_Team_Member_vod__c', 'KPH_Participation__c')` |
| TM2d | Active status picklist | Member of `Promise.all` | `getPicklistValueLabels('Account_Team_Member_vod__c', 'Account_Team_Member_Active__c')` |

## Approval Status Refresh Query

`App.jsx` calls `refreshApprovalStatus()` in separate effects:

- forced on active page change
- forced on mount/focus/pageshow/visibility resume
- throttled interval every `APPROVAL_STATUS_REFRESH_MS` (3000 ms)

This is not awaited by page loaders. It runs through `.then(...)` and has its
own `inFlight` tracker.

| Operation | Await style | Query/API details |
| --- | --- | --- |
| Resolve plan id if `shellPlanId` is not yet known | `await getCurrentAccountPlanId()` inside `fetchPlanApprovalStatus` | Desktop selected plan uses override; iPad uses current-plan resolution. |
| Fetch approval status | `await runQuery(...)` inside `fetchPlanApprovalStatus` | Object `Account_Plan_vod__c`; fields `['Id', 'KPH_Approval_Status__c', 'KPH_Is_Submitted__c', 'LastModifiedDate']`; where `Id = <plan id variants>`; limit `1`. |

## Background Export Preparation Queries

After any `pageData` exists, `App.jsx` waits `EXPORT_PREPARE_IDLE_DELAY_MS`
(650 ms) and then prepares PPT and PDF in the background.

Both `prepareAccountPlanPpt()` and `prepareAccountPlanPdf()` call
`loadAccountPlanPptData(cachedPageData)`.

`loadAccountPlanPptData()` does:

```js
await Promise.all([
  loadOrUseCached(cachedPageData, 'overview', loadHome),
  loadOrUseCached(cachedPageData, 'barriers-drivers', loadBarriersDrivers),
  loadOrUseCached(cachedPageData, 'critical-activities', loadCriticalActivities),
  loadOrUseCached(cachedPageData, 'linked-opportunities', loadCrossFunctionalPlan),
  cachedAccountProfile ? Promise.resolve(cachedAccountProfile) : loadAccountProfile(),
  loadOrUseCached(cachedPageData, 'stakeholders', loadStakeholders),
  loadOrUseCached(cachedPageData, 'team-members', loadTeamMembers),
])
```

Important optimization note:

- This export path calls loader functions directly, not `App.jsx`'s `loadPage()`.
- Therefore it does not use `pageLoadPromisesRef`.
- It can trigger missing page loader queries even while `App.jsx` is also
  preloading pages.
- The only dedupe available here is the lower-level in-flight coalescing in
  `query.js` and `shared.js`.

## User-Triggered Lookup Queries

These are not part of initial page load, but they fetch CRM data when the user
opens/searches edit modals.

| Function | Trigger | Await style at caller | Query details |
| --- | --- | --- | --- |
| `searchSiteAccounts(searchTerm, limit)` | Referral site lookup, Healthcare Network account lookup, Stakeholder primary site lookup | Called through component promises; no strict page-load await | Object `Account`; fields `ACCOUNT_LOOKUP_FIELDS`; where site record type is one of `01241000000cF0GAAU`, `01241000000mw9YAAQ`, `IsPersonAccount = false`, plus `Name LIKE` variants when search text exists; sort `Name ASC`; limit max `50`. |
| `searchStakeholderAccounts(searchTerm, limit)` | Stakeholder name/person-account lookup | Called through component promises; no strict page-load await | Object `Account`; fields `ACCOUNT_LOOKUP_FIELDS`; where `IsPersonAccount = true`, plus `Name LIKE` variants when search text exists; sort `Name ASC`; limit max `60`. |
| `searchUsers(searchTerm, limit, excludeUserIds)` | Team Member lookup from Home and Team Members page | Called through component promises; no strict page-load await | Object `User`; fields `['Id', 'Name']`; where optional `Name LIKE` variants and optional `Id != <excluded id variants>` clauses; sort `Name ASC`; limit max `60`. |

## Field Lists

### Plan / Account

`PLAN_FIELDS_BASE`:

- `Id`
- `Name`
- `OwnerId`
- `CreatedDate`
- `LastModifiedDate`
- `Account_vod__c`
- `KPH_ATC_Strategic_Opportunities__c`
- `KPH_Last_POD_Meeting__c`
- `KPH_Last_MPD_Review_Date__c`
- `KPH_Territory_Description__c`
- `KPH_Territory__c`
- `KPH_Plan_status__c`
- `KPH_Approval_Status__c`
- `KPH_Is_Submitted__c`

`PLAN_FIELDS` adds `LastActivityDate` only for online hosted CRM.

`ACCOUNT_FIELDS`:

- `Id`
- `Name`
- `EID_GILD__c`
- `Territory_vod__c`

`KPH_MM_ATC_Priority__c` is fetched as a separate safe Account query.

### Desktop Launcher

`ACCOUNT_PLAN_LAUNCHER_RELATIONSHIP_FIELDS`:

- `Id`
- `Name`
- `OwnerId`
- `Owner.Name`
- `KPH_ATC_Certified_Date__c`
- `LastModifiedById`
- `LastModifiedBy.Name`
- `KPH_Plan_status__c`
- `KPH_Improved_cycle_time_performance__c`

`ACCOUNT_PLAN_LAUNCHER_FALLBACK_FIELDS`:

- `Id`
- `Name`
- `OwnerId`
- `KPH_ATC_Certified_Date__c`
- `LastModifiedById`
- `KPH_Plan_status__c`
- `KPH_Improved_cycle_time_performance__c`

`TEAM_MEMBER_PLAN_FIELDS`:

- `Id`
- `Account_Plan_vod__c`
- `Team_Member_vod__c`
- `KPH_Is_Deleted__c`

### Home Header / Barriers / Activities / Team

`ECOSYSTEM_PLAN_FIELDS`:

- `Id`
- `KPH_Account_Plan__c`
- `KPH_ATC_Cohort__c`
- `KPH_ATC_Share_of_Business_R6M_1Q_Lag__c`
- `KPH_KLT_Sprint_Account__c`
- `KPH_KAD_Target_List__c`

`BARRIER_DRIVER_FIELDS`:

- `Id`
- `Name`
- `RecordTypeId`
- `LastModifiedDate`
- `KPH_Account_Plan__c`
- `KPH_Barrier_Title__c`
- `KPH_Driver_Title__c`
- `KPH_Barrier_Type__c`
- `KPH_Driver_Type__c`
- `KPH_MM_Barrier_Type__c`
- `KPH_MM_Driver_Type__c`
- `KPH_Indication__c`
- `KPH_Status__c`
- `KPH_Rank_1__c`
- `KPH_Strategy__c`
- `KPH_Plan_Strategy__c`
- optional: `KPH_Comments__c`

`PLAN_STRATEGY_FIELDS`:

- `Id`
- `Name`
- `KPH_Account_Plan__c`
- `KPH_Strategy__c`
- `KPH_Strategy_Rank__c`

`ACTIVITY_FIELDS`:

- `Id`
- `Name`
- `CreatedById`
- `LastModifiedDate`
- `KPH_Account_Plans__c`
- `Barrier_and_Tactical_Action__c`
- `KPH_Activity_Name__c`
- `KPH_Detail__c`
- `KPH_Status__c`
- `KPH_To_Be_Completed_By__c`
- `KPH_Completion_Date__c`
- `KPH_Accountable_POD_Members__c`
- `KPH_Indication__c`
- optional: `KPH_Comments__c`
- optional: `KPH_Inactive__c`
- optional: `KPH_Is_Deleted__c`

`TEAM_MEMBER_BY_PLAN_FIELDS`:

- `Id`
- `Name`
- `Account_Plan_vod__c`
- `Account_Team_Member_Active__c`
- `KPH_Participation__c`
- `KPH_Role__c`
- `Role_vod__c`
- `Team_Member_Name_vod__c`
- `Team_Member_vod__c`
- `KPH_Is_Deleted__c`

`POD_USER_FIELDS`:

- `Id`
- `Team_Member_vod__c`
- `Team_Member_Name_vod__c`
- `KPH_Ecosystem_Plan__c`
- `KPH_Role__c`
- `KPH_Participation__c`
- `KPH_Is_Deleted__c`

### Cross Functional Plan

`POA_FIELDS`:

- `Id`
- `LastModifiedDate`
- `KPH_Customer_Engagement_DLBCL_POA__c`
- `KPH_Market_Access_DLBCL_POA__c`
- `KPH_Medical_Affairs_DLBCL_POA__c`

`POA_CONTEXT_FIELDS` is `PLAN_FIELDS + POA_FIELDS`.

### Account Profile / Referral / Healthcare / Insights

`ACCOUNT_PROFILE_FIELDS`:

- `Id`
- `KPH_ATC_Cohort__c`
- `KPH_ATC_Share_of_Business_R6M_1Q_Lag__c`
- `KPH_Volume_Trend__c`
- `KPH_KLT_Sprint_Account__c`
- `KPH_aALL_Target__c`
- `KPH_Payer_Mix__c`
- `KPH_Payer_Type__c`
- `KPH_Top_3_Payers_Name__c`
- `KPH_Is_capacity_having_an_impact_on_CART__c`
- `KPH_What_of_CART_business_is_done_OP__c`
- `KPH_Financial_and_or_reimbursement__c`
- `KPH_Does_ATC_prefer_CART_administration__c`
- `KPH_If_Yes_to_above_reasons__c`
- `KPH_Bispecifics_for_DLBCL_being_used__c`
- `KPH_Bispecific_use_in_DLBCL_impact_CART__c`
- `KPH_If_ATC_is_using_OP_do_they__c`
- `KPH_Is_there_direct_competition_from__c`
- `KPH_If_yes_in_what_indication__c`
- `KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c`
- `KPH_Region_Dynamics_to_be_Aware_of_MM__c`

`REFERRAL_ACCOUNT_FIELDS`:

- `Id`
- `Name`
- `Indication__c`
- `KPH_HCO_Classification__c`
- `KPH_of_HCP_Targets_within_a_Site__c`
- `KPH_Referral_Count__c`
- `KPH_Referral_Priority__c`
- `KPH_X2L_DLBCL_Treated_Patients__c`
- `KPH_Comments__c`
- `Name_of_Site__c`

`HEALTHCARE_NETWORK_FIELDS`:

- `Id`
- `Name`
- `KPH_Account_Name__c`
- `KPH_Kite_Accountable__c`

`ACCOUNT_INSIGHT_FIELDS`:

- `Id`
- `Name`
- `CreatedDate`
- `CreatedById`
- `Indication__c`
- `KPH_Best_Practices_Key_Learnings_Insight__c`
- `KPH_Created_Date__c`

### Stakeholders

`STAKEHOLDER_FIELDS`:

- `Id`
- `Name`
- `KPH_Account__c`
- `KPH_First_Name__c`
- `KPH_Last_Name__c`
- `KPH_Title__c`
- `KPH_Other_Title__c`
- `Stakeholder_Account_Class__c`
- `KPH_Name_Of_Site2__c`
- `Stakeholder_EID__c`
- `Stakeholder_NPI__c`
- `KPH_Priority__c`
- `MM_Priority__c`
- `KPH_Current_Target__c`
- `KPH_HCP_Classification__c`
- `KPH_MM_Target__c`
- `KPH_MM_HCP_Classification__c`
- `KPH_DLBCL_Clinical_Influence__c`
- `KPH_DLBCL_Financial_Influence__c`
- `KPH_DLBCL_Operational_Influence__c`
- `KPH_MM_Clinical_Influence__c`
- `KPH_MM_Financial_Influence__c`
- `KPH_MM_Operational_Influence__c`
- `KPH_DLBCL_Barriers__c`
- `KPH_DLBCL_Drivers__c`
- `KPH_MM_Barriers__c`
- `KPH_MM_Drivers__c`

### Account/User Lookup Fields

`ACCOUNT_LOOKUP_FIELDS`:

- `Id`
- `Name`
- `EID_GILD__c`
- `Account_Identifier_vod__c`
- `NET_External_Id__c`
- `AccountNumber`
- `Territory_vod__c`

User lookups use:

- `Id`
- `Name`

## Optimization Hot Spots

These are the most likely places to review first:

1. Home startup does a broad `Promise.all` of shell, header, barriers/drivers,
   activities, team members, plan strategies, and 13 picklist metadata calls.
2. Stakeholders and Team Members now start as startup priority preloads while
   the Account Plan/Home load is underway.
3. After Home is ready, the original remaining implemented page preload pass
   still runs concurrently in `PAGES` order.
4. Background PPT and PDF preparation can independently call all page loaders
   directly, outside `App.jsx` page-load dedupe.
5. `resolveShellContextForPlanId()` and `runQuery()` dedupe in-flight requests
   only; they do not keep settled data cached.
6. On iPad, repeated page loaders can re-run current-object plan id resolution
   unless they overlap in time.
7. Several loaders independently request the same objects:
   - `KPH_Barriers_and_Tactical_Actions__c`
   - `KPH_Additional_Critical_Activities__c`
   - `Account_Team_Member_vod__c`
   - common picklist metadata
8. `loadAccountProfile()` waits for profile id before child records, but it
   already overlaps shell context and picklist metadata with that profile fetch.
