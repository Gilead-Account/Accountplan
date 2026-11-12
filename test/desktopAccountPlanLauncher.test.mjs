import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const launcherModulePath = new URL('../src/lib/dataservice/accountPlan/accountPlanLauncher.js', import.meta.url);
const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const appPath = new URL('../src/App.jsx', import.meta.url);
const sidebarPath = new URL('../src/components/Sidebar.jsx', import.meta.url);
const sidebarStylePath = new URL('../src/components/Sidebar.css', import.meta.url);
const launcherComponentPath = new URL('../src/components/AccountPlanLauncher.jsx', import.meta.url);
const mainStylePath = new URL('../src/styles/main.css', import.meta.url);
const fixturesModulePath = new URL('../src/lib/mockData/fixtures.js', import.meta.url);

const loadLauncherModule = async ({
  failRelationshipQuery = false,
  deferSupportingQueries = false,
} = {}) => {
  globalThis.__accountPlanLauncherCalls = [];
  globalThis.__accountPlanLauncherFailRelationshipQuery = failRelationshipQuery;
  globalThis.__accountPlanLauncherDeferSupportingQueries = deferSupportingQueries;
  globalThis.__accountPlanLauncherSupportingResolvers = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__accountPlanLauncherCalls.push(params);
      if (params.object === 'Account_Plan_vod__c') {
        if (params.allowDottedFields && globalThis.__accountPlanLauncherFailRelationshipQuery) {
          return Promise.reject(new Error('relationship query unsupported'));
        }
        return Promise.resolve([
          {
            Id: 'a0C6T000012cTbNUAU',
            Name: 'UC SAN FRANCISCO - BENIOFF Account Plan',
            OwnerId: '00541000003OwnerA',
            Owner: { Name: 'Plan Owner', FirstName: 'Plan', LastName: 'Owner' },
            'Owner.Name': 'Plan Owner',
            'Owner.FirstName': 'Plan',
            'Owner.LastName': 'Owner',
            Account_vod__c: '0018C00000MAccountA',
            KPH_ATC_EID__c: '40282237',
            KPH_ATC_Certified_Date__c: '2022-06-24',
            KPH_Plan_status__c: 'Active',
            KPH_Territory__c: 'CT1005',
            KPH_Territory_Description__c: 'Upstate NY',
            KPH_Last_MPD_Review_Date__c: '2026-07-07',
            KPH_Submitted_Dates__c: null,
            KPH_Approval_Status__c: 'Submitted for Approval',
            KPH_Comments__c: 'Ready for manager approval.',
            KPH_Approval_Due_Date__c: '2026-07-15',
            KPH_Last_Account_Insight_Update__c: '2026-07-08',
            KPH_Last_Critical_Acitivity_Update__c: '2026-07-09',
            KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c: '2026-07-10',
            KPH_Last_Internal_POD_Meeting_Update__c: '2026-07-11',
            KPH_Manager_s_Email__c: 'eappelt@kitepharma.com.invalid',
          },
          {
            Id: 'a0C6T000012cOwnUAU',
            Name: 'Owner Only Account Plan',
            OwnerId: '00541000003ISO0AAO',
            Owner: { Name: 'Current User Owner', FirstName: 'Current', LastName: 'User Owner' },
            'Owner.Name': 'Current User Owner',
            'Owner.FirstName': 'Current',
            'Owner.LastName': 'User Owner',
            Account_vod__c: '0018C00000MAccountB',
            KPH_ATC_EID__c: '40282238',
            KPH_ATC_Certified_Date__c: '2023-01-15',
            KPH_Plan_status__c: 'Potential ATC',
            KPH_Territory__c: 'CT1006',
            KPH_Territory_Description__c: 'Downstate NY',
            KPH_Last_MPD_Review_Date__c: null,
            KPH_Submitted_Dates__c: '2026-07-03',
            KPH_Approval_Status__c: 'Draft',
            KPH_Comments__c: 'Work in progress.',
            KPH_Approval_Due_Date__c: null,
            KPH_Last_Account_Insight_Update__c: '2026-07-01',
            KPH_Last_Critical_Acitivity_Update__c: '2026-07-02',
            KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c: null,
            KPH_Last_Internal_POD_Meeting_Update__c: '2026-07-03',
            KPH_Manager_s_Email__c: 'eappelt@kitepharma.com',
          },
        ]);
      }
      if (
        globalThis.__accountPlanLauncherDeferSupportingQueries &&
        ['User', 'Account', 'KPH_Ecosystem_Plan__c'].includes(params.object)
      ) {
        return new Promise((resolve) => {
          globalThis.__accountPlanLauncherSupportingResolvers.push(() => {
            globalThis.__accountPlanLauncherDeferSupportingQueries = false;
            resolve(runQuery(params));
          });
        });
      }
      if (params.object === 'Account') {
        return Promise.resolve([
          {
            Id: '0018C00000MAccountA',
            KPH_MM_ATC_Priority__c: 'P2',
            KPH_Market_Access_Prioritized_Account__c: 'No',
          },
          {
            Id: '0018C00000MAccountB',
            KPH_MM_ATC_Priority__c: 'P1',
            KPH_Market_Access_Prioritized_Account__c: 'Yes',
          },
        ]);
      }
      if (params.object === 'KPH_Ecosystem_Plan__c') {
        return Promise.resolve([
          {
            Id: 'profile-older',
            KPH_Account_Plan__c: 'a0C6T000012cTbNUAU',
            KPH_ATC_Cohort__c: 'Older Cohort',
            LastModifiedDate: '2026-06-01T12:00:00Z',
          },
          {
            Id: 'profile-newer',
            KPH_Account_Plan__c: 'a0C6T000012cTbNUAU',
            KPH_ATC_Cohort__c: 'DLBCL Cohort 2',
            LastModifiedDate: '2026-07-01T12:00:00Z',
          },
          {
            Id: 'profile-owner',
            KPH_Account_Plan__c: 'a0C6T000012cOwnUAU',
            KPH_ATC_Cohort__c: 'DLBCL Cohort 1',
            LastModifiedDate: '2026-07-02T12:00:00Z',
          },
        ]);
      }
      if (params.object === 'Account_Team_Member_vod__c') {
        return Promise.resolve([
          {
            Id: 'team-member-1',
            Account_Plan_vod__c: 'a0C6T000012cTbNUAU',
            Team_Member_vod__c: '00541000003ISO0AAO',
          },
        ]);
      }
      if (params.object === 'User') {
        return Promise.resolve([
          { Id: '00541000003OwnerA', Name: 'Plan Owner' },
          { Id: '005VI00000YlgEjYAJ', Name: 'Jordan Myint' },
        ]);
      }
      return Promise.resolve([]);
    };
    export const getDataForCurrentObject = (object, field) =>
      object === 'User' && field === 'Id'
        ? Promise.resolve('00541000003ISO0AAO')
        : Promise.resolve(null);
    export const unwrap = (row) => row || null;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const inClause = (values) => '(' + (values || []).map((value) => "'" + value + "'").join(',') + ')';
  `);

  const source = (await readFile(launcherModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__accountPlanLauncherCalls };
};

const loadSharedModule = async () => {
  globalThis.__desktopContextCalls = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__desktopContextCalls.push(params);
      if (params.object === 'Account_Plan_vod__c') {
        const selected = String(params.where || '').includes('a0C6T000012cTbNUAU')
          ? 'a0C6T000012cTbNUAU'
          : 'a0CSu00004IpVE7MAN';
        return Promise.resolve([
          {
            Id: selected,
            Name: selected === 'a0C6T000012cTbNUAU'
              ? 'UC SAN FRANCISCO - BENIOFF Account Plan'
              : 'ACT Plan 009',
            OwnerId: '00541000003ISO0AAO',
            LastModifiedDate: '2026-06-12T12:00:00Z',
            Account_vod__c: '0018C00000MAccount',
          },
        ]);
      }
      if (params.object === 'Account') {
        return Promise.resolve([{ Id: '0018C00000MAccount', Name: 'Mock Account' }]);
      }
      return Promise.resolve([]);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => row || null;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({ data: { id: 'new-record-id' } });
    export const updateRecord = () => Promise.resolve({ data: { id: 'record-id' } });
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule('export const normalizeCrmBoolean = (value) => Boolean(value);');

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__desktopContextCalls };
};

test('fetchCurrentUserAccountPlans lists all valid ATC Account Plans', async () => {
  const { mod, calls } = await loadLauncherModule();

  const rows = await mod.fetchCurrentUserAccountPlans();

  assert.equal(calls[0].object, 'Account_Plan_vod__c');
  assert.match(calls[0].where, /Account_vod__r\.Hospital_Type__c = 'Authorized Treatment Center'/);
  assert.match(calls[0].where, /Account_vod__r\.Customer_Master_Status_vod__c = 'Valid_vod'/);
  assert.equal(calls[0].limit, undefined);
  assert.ok(calls[0].fields.includes('Owner.Name'));
  assert.ok(calls[0].fields.includes('Owner.FirstName'));
  assert.ok(calls[0].fields.includes('Owner.LastName'));
  assert.ok(calls[0].fields.includes('Account_vod__c'));
  assert.ok(calls[0].fields.includes('KPH_Territory__c'));
  assert.ok(calls[0].fields.includes('KPH_Territory_Description__c'));
  assert.ok(calls[0].fields.includes('KPH_Last_MPD_Review_Date__c'));
  assert.ok(calls[0].fields.includes('KPH_Submitted_Dates__c'));
  assert.ok(calls[0].fields.includes('KPH_Approval_Status__c'));
  assert.ok(calls[0].fields.includes('KPH_Comments__c'));
  assert.ok(calls[0].fields.includes('KPH_Approval_Due_Date__c'));
  assert.ok(calls[0].fields.includes('KPH_Last_Account_Insight_Update__c'));
  assert.ok(calls[0].fields.includes('KPH_Last_Critical_Acitivity_Update__c'));
  assert.ok(calls[0].fields.includes('KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c'));
  assert.ok(calls[0].fields.includes('KPH_Last_Internal_POD_Meeting_Update__c'));
  assert.ok(calls[0].fields.includes('KPH_Manager_s_Email__c'));
  assert.equal(new Set(calls[0].fields).size, calls[0].fields.length);
  assert.equal(calls.filter((call) => call.object === 'Account_Plan_vod__c').length, 1);
  assert.ok(!calls[0].fields.includes('LastModifiedBy.Name'));
  assert.equal(calls[0].allowDottedFields, true);
  assert.equal(calls[0].limit, undefined);
  const accountQuery = calls.find((call) => call.object === 'Account');
  const profileQuery = calls.find((call) => call.object === 'KPH_Ecosystem_Plan__c');
  assert.deepEqual(accountQuery.fields, [
    'Id',
    'KPH_MM_ATC_Priority__c',
    'KPH_Market_Access_Prioritized_Account__c',
  ]);
  assert.match(accountQuery.where, /0018C00000MAccountA/);
  assert.match(accountQuery.where, /0018C00000MAccountB/);
  assert.deepEqual(profileQuery.fields, [
    'Id',
    'KPH_Account_Plan__c',
    'KPH_ATC_Cohort__c',
    'LastModifiedDate',
  ]);
  assert.match(profileQuery.where, /a0C6T000012cTbNUAU/);
  assert.match(profileQuery.where, /a0C6T000012cOwnUAU/);
  assert.equal(calls.some((call) => call.object === 'Account_Team_Member_vod__c'), false);
  assert.deepEqual(rows, [
    {
      id: 'a0C6T000012cOwnUAU',
      name: 'Owner Only Account Plan',
      eid: '40282238',
      ownerName: 'Current User Owner',
      ownerFirstName: 'Current',
      ownerLastName: 'User Owner',
      marketAccessPrioritizedAccount: 'Yes',
      mmAtcPriorityAccount: 'P1',
      atcCohortDlbcl: 'DLBCL Cohort 1',
      atcCertifiedDate: '2023-01-15',
      planStatus: 'Potential ATC',
      territory: 'CT1006',
      territoryDescription: 'Downstate NY',
      lastMpdReviewDate: null,
      submittedDate: '2026-07-03',
      approvalStatus: 'Draft',
      comments: 'Work in progress.',
      approvalDueDate: null,
      lastAccountInsightUpdate: '2026-07-01',
      lastAdditionalCriticalActivityUpdate: '2026-07-02',
      lastBarrierTacticalActionUpdate: null,
      lastInternalPodMeetingUpdate: '2026-07-03',
      managerEmail: 'eappelt@kitepharma.com',
    },
    {
      id: 'a0C6T000012cTbNUAU',
      name: 'UC SAN FRANCISCO - BENIOFF Account Plan',
      eid: '40282237',
      ownerName: 'Plan Owner',
      ownerFirstName: 'Plan',
      ownerLastName: 'Owner',
      marketAccessPrioritizedAccount: 'No',
      mmAtcPriorityAccount: 'P2',
      atcCohortDlbcl: 'DLBCL Cohort 2',
      atcCertifiedDate: '2022-06-24',
      planStatus: 'Active',
      territory: 'CT1005',
      territoryDescription: 'Upstate NY',
      lastMpdReviewDate: '2026-07-07',
      submittedDate: null,
      approvalStatus: 'Submitted for Approval',
      comments: 'Ready for manager approval.',
      approvalDueDate: '2026-07-15',
      lastAccountInsightUpdate: '2026-07-08',
      lastAdditionalCriticalActivityUpdate: '2026-07-09',
      lastBarrierTacticalActionUpdate: '2026-07-10',
      lastInternalPodMeetingUpdate: '2026-07-11',
      managerEmail: 'eappelt@kitepharma.com.invalid',
    },
  ]);
});

test('fetchCurrentUserAccountPlans falls back to one User query when relationship fields fail', async () => {
  const { mod, calls } = await loadLauncherModule({ failRelationshipQuery: true });

  const originalWarn = console.warn;
  console.warn = () => {};
  let rows;
  try {
    rows = await mod.fetchCurrentUserAccountPlans();
  } finally {
    console.warn = originalWarn;
  }

  const planQueries = calls.filter((call) => call.object === 'Account_Plan_vod__c');
  const userQuery = calls.find((call) => call.object === 'User');
  assert.equal(planQueries.length, 2);
  assert.ok(planQueries[0].fields.includes('Owner.Name'));
  assert.ok(!planQueries[1].fields.some((field) => field.includes('.')));
  assert.match(planQueries[0].where, /Account_vod__r\.Hospital_Type__c = 'Authorized Treatment Center'/);
  assert.match(planQueries[0].where, /Account_vod__r\.Customer_Master_Status_vod__c = 'Valid_vod'/);
  assert.match(planQueries[1].where, /Account_vod__r\.Hospital_Type__c = 'Authorized Treatment Center'/);
  assert.match(planQueries[1].where, /Account_vod__r\.Customer_Master_Status_vod__c = 'Valid_vod'/);
  assert.equal(calls.some((call) => call.object === 'Account_Team_Member_vod__c'), false);
  assert.ok(userQuery);
  assert.match(userQuery.where, /00541000003OwnerA/);
  assert.match(userQuery.where, /00541000003ISO0AAO/);
  const teamMemberPlan = rows.find((row) => row.id === 'a0C6T000012cTbNUAU');
  const ownerPlan = rows.find((row) => row.id === 'a0C6T000012cOwnUAU');
  assert.equal(teamMemberPlan?.ownerLastName, 'Owner');
  assert.equal(teamMemberPlan?.ownerFirstName, 'Plan');
  assert.equal(teamMemberPlan?.ownerName, 'Plan Owner');
  assert.equal(ownerPlan?.ownerLastName, 'User Owner');
});

test('fetchCurrentUserAccountPlans starts independent supporting queries concurrently', async () => {
  const { mod, calls } = await loadLauncherModule({
    failRelationshipQuery: true,
    deferSupportingQueries: true,
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const rowsPromise = mod.fetchCurrentUserAccountPlans();
    await new Promise((resolve) => setImmediate(resolve));

    const startedObjects = calls.map((call) => call.object);
    assert.ok(startedObjects.includes('User'));
    assert.ok(startedObjects.includes('Account'));
    assert.ok(startedObjects.includes('KPH_Ecosystem_Plan__c'));

    const resolvers = [...globalThis.__accountPlanLauncherSupportingResolvers];
    resolvers.forEach((resolve) => resolve());
    const rows = await rowsPromise;
    assert.equal(rows.length, 2);
  } finally {
    console.warn = originalWarn;
  }
});

test('selected desktop account plan override drives direct shell context fetches', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  const { mod, calls } = await loadSharedModule();

  try {
    mod.setCurrentAccountPlanIdOverride('a0C6T000012cTbNUAU');
    const first = await mod.resolveShellContext();
    const second = await mod.resolveShellContext();
    assert.equal(first.planId, 'a0C6T000012cTbNUAU');
    assert.equal(second.planId, 'a0C6T000012cTbNUAU');
    assert.equal(calls.filter((call) => call.object === 'Account_Plan_vod__c').length, 2);

    mod.setCurrentAccountPlanIdOverride('a0CSu00004IpVE7MAN');
    const switched = await mod.resolveShellContext();
    assert.equal(switched.planId, 'a0CSu00004IpVE7MAN');
    assert.equal(calls.filter((call) => call.object === 'Account_Plan_vod__c').length, 3);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('App has a desktop account-plan launcher and Sidebar exposes Legacy Account Plan', async () => {
  const appSource = await readFile(appPath, 'utf8');
  const sidebarSource = await readFile(sidebarPath, 'utf8');
  const sidebarCssSource = await readFile(sidebarStylePath, 'utf8');
  const legacyButtonRule = sidebarCssSource.match(/\.shell-sidebar \.sidebar-legacy-account-plan\s*\{[^}]+\}/)?.[0] || '';

  assert.match(appSource, /AccountPlanLauncher/);
  assert.match(appSource, /detectRuntimeViewMode/);
  assert.match(appSource, /setCurrentAccountPlanIdOverride/);
  assert.match(appSource, /legacyAccountPlanId=\{isDesktopView \? shellPlanId : null\}/);
  assert.match(sidebarSource, /Legacy Account Plan/);
  assert.match(sidebarSource, /salesforceRecordBaseUrl\('Account_Plan_vod__c', undefined, currentUserUsername\)/);
  assert.match(sidebarSource, /legacyAccountPlanRecordUrl\(legacyAccountPlanId, currentUserUsername\)/);
  assert.match(sidebarSource, /href=\{legacyAccountPlanUrl\}/);
  assert.match(sidebarSource, /target="_top"/);
  assert.match(legacyButtonRule, /justify-self:\s*stretch/);
  assert.match(legacyButtonRule, /width:\s*100%/);
  assert.match(legacyButtonRule, /height:\s*30px/);
  assert.match(legacyButtonRule, /min-height:\s*30px/);
  assert.match(legacyButtonRule, /white-space:\s*nowrap/);
});

test('desktop account-plan launcher owns vertical scroll inside the hidden shell body', async () => {
  const cssSource = await readFile(mainStylePath, 'utf8');
  const launcherFrameRule = cssSource.match(/\.account-plan-launcher-frame\s*\{[^}]+\}/)?.[0] || '';

  assert.match(launcherFrameRule, /height:\s*calc\(100vh - 24px\)/);
  assert.match(launcherFrameRule, /overflow-y:\s*auto/);
  assert.match(launcherFrameRule, /overflow-x:\s*hidden/);
});

test('desktop account-plan launcher stretches dynamically across the available frame width', async () => {
  const cssSource = await readFile(mainStylePath, 'utf8');
  const launcherRule = cssSource.match(/\.account-plan-launcher\s*\{[^}]+\}/)?.[0] || '';
  const panelRule = cssSource.match(/\.account-plan-launcher-panel\s*\{[^}]+\}/)?.[0] || '';
  const tableRule = cssSource.match(/\.account-plan-launcher-table\s*\{[^}]+\}/)?.[0] || '';

  assert.match(launcherRule, /width:\s*100%/);
  assert.match(launcherRule, /max-width:\s*none/);
  assert.match(launcherRule, /margin:\s*0/);
  assert.doesNotMatch(launcherRule, /min\(1540px,\s*100%\)/);
  assert.match(panelRule, /width:\s*100%/);
  assert.match(tableRule, /width:\s*100%/);
});

test('desktop account-plan launcher columns shrink instead of creating horizontal scroll', async () => {
  const cssSource = await readFile(mainStylePath, 'utf8');
  const tableRule = cssSource.match(/\.account-plan-launcher-table\s*\{[^}]+\}/)?.[0] || '';
  const rowRule = cssSource.match(/\.account-plan-launcher-row\s*\{[^}]+\}/)?.[0] || '';

  assert.match(tableRule, /overflow-x:\s*hidden/);
  assert.match(rowRule, /min-width:\s*0/);
  assert.doesNotMatch(rowRule, /min-width:\s*960px/);
  assert.match(
    rowRule,
    /grid-template-columns:[\s\S]*?minmax\(0,\s*1\.5fr\)[\s\S]*?minmax\(0,\s*0\.68fr\)[\s\S]*?minmax\(0,\s*1\.18fr\)[\s\S]*?68px/
  );
});

test('desktop account-plan launcher uses compact table toolbar instead of duplicate hero', async () => {
  const componentSource = await readFile(launcherComponentPath, 'utf8');
  const cssSource = await readFile(mainStylePath, 'utf8');

  assert.doesNotMatch(componentSource, /account-plan-launcher-hero/);
  assert.match(componentSource, /account-plan-launcher-panel-title/);
  assert.match(componentSource, /account-plan-launcher-search/);
  assert.match(componentSource, /key:\s*'territory'[\s\S]*?label:\s*'Territory'/);
  assert.match(componentSource, /key:\s*'submittedDate'[\s\S]*?label:\s*'Submitted Date'/);
  assert.match(componentSource, /data-label=\{column\.label\}/);
  assert.doesNotMatch(cssSource, /\.account-plan-launcher-hero/);
  assert.match(cssSource, /\.account-plan-launcher-count/);
  assert.match(cssSource, /\.account-plan-launcher-status\.is-active/);
  assert.match(cssSource, /\.account-plan-launcher-row:not\(\.is-head\):hover/);
});

test('desktop launcher exposes manager-only account-plan and pending-approval tabs', async () => {
  const appSource = await readFile(appPath, 'utf8');
  const componentSource = await readFile(launcherComponentPath, 'utf8');
  const sharedSource = await readFile(sharedModulePath, 'utf8');
  const cssSource = await readFile(mainStylePath, 'utf8');

  assert.match(appSource, /isCtamManagerProfile\(currentUserProfileName\)/);
  assert.match(appSource, /isCtamManager=\{isCtamManager\}/);
  assert.match(componentSource, /isCtamManager\s*&&\s*\(/);
  assert.match(componentSource, /role="tablist"/);
  assert.match(componentSource, /Account Plan List/);
  assert.match(componentSource, /Pending My Approval/);
  assert.match(componentSource, /isAccountPlanPendingManagerApproval\(row, currentUserEmail\)/);
  assert.match(componentSource, /getCurrentUserEmail\(\)/);
  assert.match(sharedSource, /getDataForCurrentObject\('User', 'Email'\)/);
  assert.ok(
    componentSource.indexOf('account-plan-launcher-tabs') <
      componentSource.indexOf('className="account-plan-launcher-panel"')
  );
  assert.doesNotMatch(componentSource, /Current shared plan view/);
  assert.doesNotMatch(componentSource, /Submitted and assigned to me/);
  assert.doesNotMatch(componentSource, /account-plan-launcher-tab-mark/);
  assert.doesNotMatch(componentSource, /account-plan-launcher-tab-copy/);
  assert.match(componentSource, /role=\{isCtamManager \? 'tabpanel' : undefined\}/);
  assert.match(cssSource, /\.account-plan-launcher-tabs/);
  assert.match(cssSource, /\.account-plan-launcher-tabs button\.is-active/);
  assert.match(cssSource, /account-plan-launcher-tabs\s*\{[\s\S]*?justify-self:\s*start/);
  assert.match(cssSource, /account-plan-launcher-tab-count/);
  assert.match(cssSource, /account-plan-launcher-tabs\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(cssSource, /account-plan-launcher-tabs button\s*\{[\s\S]*?min-height:\s*40px/);
  assert.match(cssSource, /account-plan-launcher-tabs button::after\s*\{[\s\S]*?height:\s*3px/);
  assert.match(cssSource, /prefers-reduced-motion:\s*reduce/);
});

test('desktop launcher initially opens pending approvals when at least one is assigned', async () => {
  const componentSource = await readFile(launcherComponentPath, 'utf8');

  assert.match(
    componentSource,
    /status !== 'ready' \|\| !\['ready', 'error'\]\.includes\(approvalEmailStatus\)/
  );
  assert.match(
    componentSource,
    /setActiveTab\(approvalRows\.length > 0 \? PENDING_APPROVAL_TAB : ACCOUNT_PLAN_LIST_TAB\)/
  );
});

test('pending approval view omits the Internal POD update and keeps Account Plan navigation', async () => {
  const componentSource = await readFile(launcherComponentPath, 'utf8');
  const cssSource = await readFile(mainStylePath, 'utf8');
  const columnsBlock = componentSource.match(/const PENDING_APPROVAL_COLUMNS = \[([\s\S]*?)\];/)?.[1] || '';
  const keys = [...columnsBlock.matchAll(/key:\s*'([^']+)'/g)].map((match) => match[1]);
  const labels = [...columnsBlock.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(keys, [
    'name',
    'approvalStatus',
    'comments',
    'submittedDate',
    'approvalDueDate',
    'lastMpdReviewDate',
    'lastAccountInsightUpdate',
    'lastAdditionalCriticalActivityUpdate',
    'lastBarrierTacticalActionUpdate',
  ]);
  assert.deepEqual(labels, [
    'Account Plan Name',
    'Approval Status',
    'Comments',
    'Submitted Date',
    'Approval Due Date',
    'Last MPD Review Date',
    'Last Account Insight Update',
    'Last Additional Critical Activity Update',
    'Last Barrier & Tactical Action Update',
  ]);
  assert.doesNotMatch(columnsBlock, /Internal POD/i);
  assert.match(componentSource, /visibleColumns = isApprovalTab \? PENDING_APPROVAL_COLUMNS : ACCOUNT_PLAN_LAUNCHER_COLUMNS/);
  assert.match(componentSource, /\{visibleColumns\.map\(\(column\) =>/);
  assert.match(componentSource, /<span role="columnheader">Action<\/span>/);
  assert.match(componentSource, /aria-label=\{`Open \$\{plan\.name\}`\}/);
  assert.match(componentSource, /account-plan-launcher-table\$\{isApprovalTab \? ' is-approval' : ''\}/);
  assert.match(cssSource, /account-plan-launcher-table\.is-approval \.account-plan-launcher-row\s*\{[\s\S]*?grid-template-columns:/);
});

test('desktop account-plan launcher combines owner name and exposes all sortable list columns', async () => {
  const componentSource = await readFile(launcherComponentPath, 'utf8');
  const cssSource = await readFile(mainStylePath, 'utf8');
  const columnsBlock = componentSource.match(/const ACCOUNT_PLAN_LAUNCHER_COLUMNS = \[([\s\S]*?)\];/)?.[1] || '';

  assert.doesNotMatch(componentSource, /import TableSortButton/);
  assert.match(componentSource, /function LauncherSortButton/);
  assert.match(componentSource, /stableSortRows/);
  assert.match(componentSource, /nextTableSort/);
  assert.match(componentSource, /toDateSortValue/);
  assert.match(columnsBlock, /key:\s*'name'[\s\S]*?label:\s*'Account Plan Name'/);
  assert.match(columnsBlock, /key:\s*'ownerName'[\s\S]*?label:\s*'Owner Name'/);
  assert.doesNotMatch(columnsBlock, /Owner Last Name|Owner First Name/);
  assert.match(columnsBlock, /key:\s*'marketAccessPrioritizedAccount'[\s\S]*?label:\s*'Market Access Prioritized Account'/);
  assert.match(columnsBlock, /key:\s*'mmAtcPriorityAccount'[\s\S]*?label:\s*'MM ATC Priority Account'/);
  assert.match(columnsBlock, /key:\s*'atcCohortDlbcl'[\s\S]*?label:\s*'ATC Cohort DLBCL'/);
  assert.match(columnsBlock, /key:\s*'planStatus'/);
  assert.match(columnsBlock, /key:\s*'territory'/);
  assert.match(columnsBlock, /key:\s*'territoryDescription'/);
  assert.match(columnsBlock, /key:\s*'atcCertifiedDate'[\s\S]*?type:\s*'date'/);
  assert.match(columnsBlock, /key:\s*'lastMpdReviewDate'[\s\S]*?type:\s*'date'/);
  assert.match(columnsBlock, /key:\s*'submittedDate'[\s\S]*?type:\s*'date'/);
  assert.match(componentSource, /formatDate\(plan\[column\.key\], '-'\)/);
  assert.match(componentSource, /return plan\[column\.key\] \|\| '-'/);
  assert.match(componentSource, /\{visibleColumns\.map\(\(column\) =>/);
  assert.match(componentSource, /<LauncherSortButton column=\{column\} sort=\{sort\} onSort=\{handleSort\}/);
  assert.match(componentSource, /account-plan-launcher-sort-label/);
  assert.match(componentSource, /account-plan-launcher-sort-slot/);
  assert.match(componentSource, /data-label=\{column\.label\}/);
  assert.match(componentSource, /<small>\{plan\.eid \|\| '-'\}<\/small>/);
  assert.match(
    cssSource,
    /account-plan-launcher-row\s*\{[\s\S]*?grid-template-columns:[\s\S]*?minmax\(0,\s*1\.5fr\)[\s\S]*?minmax\(0,\s*0\.68fr\)[\s\S]*?minmax\(0,\s*1\.18fr\)[\s\S]*?68px/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-row > span:last-child\s*\{[\s\S]*?padding-left:\s*6px[\s\S]*?padding-right:\s*6px[\s\S]*?text-align:\s*center/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-open\s*\{[\s\S]*?height:\s*32px[\s\S]*?min-width:\s*52px[\s\S]*?font-size:\s*12px/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-row > \.account-plan-launcher-plan-name\s*\{[\s\S]*?overflow:\s*visible[\s\S]*?text-overflow:\s*clip[\s\S]*?white-space:\s*normal/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-plan-name strong\s*\{[\s\S]*?font-size:\s*12px[\s\S]*?line-height:\s*1\.18[\s\S]*?overflow-wrap:\s*anywhere[\s\S]*?text-overflow:\s*clip[\s\S]*?white-space:\s*normal/
  );
  assert.match(cssSource, /account-plan-launcher-sort-button/);
  assert.match(
    cssSource,
    /account-plan-launcher-sort-button\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*16px[\s\S]*?column-gap:\s*5px[\s\S]*?width:\s*100%[\s\S]*?overflow:\s*hidden/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-sort-label\s*\{[\s\S]*?overflow:\s*hidden[\s\S]*?white-space:\s*normal[\s\S]*?hyphens:\s*none[\s\S]*?word-break:\s*normal/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-sort-slot\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*14px/
  );
  assert.match(
    cssSource,
    /account-plan-launcher-row\.is-head > span\s*\{[\s\S]*?font-size:\s*9px/
  );
});

test('mock filter supports Account Plan launcher access OR clauses', async () => {
  const { filterByWhere } = await import(`${fixturesModulePath.href}?${Date.now()}`);
  const rows = [
    { Id: { value: 'plan-1' }, OwnerId: { value: 'user-a' }, KPH_Is_Deleted__c: { value: false } },
    { Id: { value: 'plan-2' }, OwnerId: { value: 'user-b' }, KPH_Is_Deleted__c: { value: false } },
    { Id: { value: 'plan-3' }, OwnerId: { value: 'user-c' }, KPH_Is_Deleted__c: { value: false } },
  ];

  assert.deepEqual(
    filterByWhere(rows, "Id IN ('plan-2')").map((row) => row.Id.value),
    ['plan-2']
  );
  assert.deepEqual(
    filterByWhere(rows, "Id IN {'plan-1'}").map((row) => row.Id.value),
    ['plan-1']
  );
  assert.deepEqual(
    filterByWhere(rows, "(Id IN ('plan-2') OR OwnerId = 'user-a')").map((row) => row.Id.value),
    ['plan-1', 'plan-2']
  );
});
