import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const homeModulePath = new URL('../src/lib/dataservice/accountPlan/home.js', import.meta.url);
const overviewPagePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);
const teamMembersPagePath = new URL('../src/pages/TeamMembers/index.jsx', import.meta.url);
const teamMemberModalPath = new URL('../src/pages/TeamMembers/TeamMemberEditModal.jsx', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__userLookupQueryCalls = [];
  globalThis.__teamMemberCreateCalls = [];
  globalThis.__teamMemberUpdateCalls = [];
  globalThis.__userLookupRows = [
    { Id: '0058C00000UserAAA', Name: 'PRIYA KUMAR' },
    { Id: '0058C00000UserBBB', Name: 'James Chen' },
  ];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__userLookupQueryCalls.push(params);
      return Promise.resolve(globalThis.__userLookupRows);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__teamMemberCreateCalls.push({ object, fields });
      return Promise.resolve({ data: { id: 'new-team-member-id' } });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__teamMemberUpdateCalls.push({ object, id, fields });
      return Promise.resolve({ data: { id } });
    };
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule('export const normalizeCrmBoolean = (value) => Boolean(value);');

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return {
    mod,
    calls: globalThis.__userLookupQueryCalls,
    creates: globalThis.__teamMemberCreateCalls,
    updates: globalThis.__teamMemberUpdateCalls,
  };
};

const loadHomeModule = async () => {
  globalThis.__homePicklistCalls = [];
  globalThis.__homeAggregateCalls = [];
  globalThis.__homeStrategyDependency = {
    MM: ['Wrong Metadata Strategy'],
  };
  globalThis.__homePicklistLabels = {
    KPH_Barriers_and_Tactical_Actions__c: {
      KPH_Indication__c: {
        DLBCL: 'DLBCL',
        MM: 'MM',
        Portfolio: 'Portfolio',
        aALL: 'aALL',
      },
      KPH_Strategy__c: {
        'DLBCL Strategy | DLBCL,Portfolio': 'DLBCL Strategy',
        'DLBCL Only Strategy | DLBCL,Portfolio': 'DLBCL Only Strategy',
        'MM Pre-Launch Readiness | MM': 'MM Pre-Launch Readiness',
      },
      KPH_MM_Strategy__c: {
        'Expand Class Share': 'Expand Class Share',
        'Lead/Grow Brand Share': 'Lead/Grow Brand Share',
      },
      KPH_Barrier_Type__c: {
        'DLBCL Barrier Category | DLBCL,Portfolio': 'DLBCL Barrier Category | DLBCL,Portfolio',
      },
      KPH_Driver_Type__c: {
        'DLBCL Driver Category | DLBCL,Portfolio': 'DLBCL Driver Category',
        'MM Driver Category': 'MM Driver Category',
      },
    },
    KPH_Strategy__c: {
      KPH_Strategy__c: {
        'DLBCL Strategy': 'DLBCL Strategy',
        'MM Strategy': 'MM Strategy',
        Shared: 'Shared',
      },
    },
    Account_Team_Member_vod__c: {
      KPH_Participation__c: {
        Core: 'Core',
        Lead: 'Lead',
      },
    },
    Account: {
      KPH_Market_Access_Prioritized_Account__c: {
        Yes: 'Yes',
        No: 'No',
      },
    },
  };

  const sharedStubUrl = dataModule(`
    export const aggregateStrategies = (rows, strategyLabels) => {
      globalThis.__homeAggregateCalls.push({ rows, strategyLabels });
      return { dlbcl: [], mm: [] };
    };
    export const BARRIER_DRIVER_OBJECT = 'KPH_Barriers_and_Tactical_Actions__c';
    export const BARRIER_DRIVER_STATUS_ORDER = ['Open', 'In Progress', 'Closed'];
    export const BARRIER_DRIVER_CATEGORY_FIELDS = {
      barrier: 'KPH_Barrier_Type__c',
      driver: 'KPH_Driver_Type__c',
    };
    export const BARRIER_DRIVER_MM_STRATEGY_FIELD = 'KPH_MM_Strategy__c';
    export const BARRIER_DRIVER_INDICATION_FIELD = 'KPH_Indication__c';
    export const BARRIER_DRIVER_STRATEGY_FIELD = 'KPH_Strategy__c';
    export const buildOpenActivityCountByBarrier = () => ({});
    export const createSalesforceIdLookup = (records = []) => {
      const lookup = new Map();
      for (const record of records || []) {
        lookup.set(record.id, record);
        lookup.set(String(record.id || '').slice(0, 15), record);
      }
      return lookup;
    };
    export const CRITICAL_ACTIVITY_OBJECT = 'KPH_Additional_Critical_Activities__c';
    export const createBarrierDriver = () => Promise.resolve({});
    export const createCriticalActivity = () => Promise.resolve({});
    export const deleteCriticalActivity = () => Promise.resolve({});
    export const deleteTeamMember = () => Promise.resolve({});
    export const fetchAccount = () => Promise.resolve({
      id: 'account-001',
      marketAccessPrioritizedAccount: 'Yes',
    });
    export const fetchBarriersAndDrivers = () => Promise.resolve({
      rows: [
        { id: 'bd-001', type: 'Barrier', indication: 'Legacy Indication', status: 'Open' },
      ],
      access: {},
    });
    export const fetchCriticalActivities = () => Promise.resolve([
      { id: 'act-001', indication: 'Activity Legacy Indication', status: 'Planned' },
    ]);
    export const fetchHeaderFields = () => Promise.resolve({ ecosystemPlanId: 'eco-001', header: {} });
    export const fetchPlan = () => Promise.resolve({ Id: 'plan-001', Account_vod__c: 'account-001' });
    export const fetchPlanStrategies = () => Promise.resolve([]);
    export const fetchPodUsers = () => Promise.resolve([
      { id: 'pod-001', name: 'Priya Kumar', userId: '0058C00000UserAAA', participation: 'Extended' },
    ]);
    export const fetchReferralAccounts = () => Promise.resolve([
      { id: 'ref-001', referralCount: 7, treatedPatients: 3 },
      { id: 'ref-002', referralCount: '5', treatedPatients: '3' },
    ]);
    export const fetchTeamMembersByPlan = () => Promise.resolve([
      { id: 'tm-001', name: 'James Chen', participation: 'Core' },
    ]);
    export const getSalesforceIdLookupEntry = (lookup, id) =>
      lookup.get(id) || lookup.get(String(id || '').slice(0, 15)) || null;
    export const requireCurrentAccountPlanId = () => Promise.resolve('plan-001');
    export const resolveShellContextForPlanId = () => Promise.resolve({
      planId: 'plan-001',
      planRow: { Id: 'plan-001', Account_vod__c: 'account-001' },
      plan: { id: 'plan-001', accountId: 'account-001' },
      account: { id: 'account-001', marketAccessPrioritizedAccount: 'Yes' },
    });
    export const isVisibleBarrierDriverIndication = () => true;
    export const normalizeBarrierDriverStatusForDisplay = (value) => value === 'Close' ? 'Closed' : value;
    export const planStrategyMapById = () => new Map();
    const normalize = (value) => String(value || '').trim().toUpperCase();
    const parseStrategyValue = (value, indications = []) => {
      const text = String(value || '').trim();
      const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return { label: text, indications: [] };
      const suffixValues = parts[parts.length - 1].split(',').map((part) => part.trim()).filter(Boolean);
      const valid = new Set((indications || []).map(normalize));
      if (!valid.size || !suffixValues.length || !suffixValues.every((part) => valid.has(normalize(part)))) {
        return { label: text, indications: [] };
      }
      return { label: parts.slice(0, -1).join(' | '), indications: suffixValues };
    };
    export const buildBarrierDriverStrategyPicklistInfo = (values = [], labels = {}, indications = []) => {
      const validByKey = new Map((indications || []).map((value) => [normalize(value), value]));
      const optionsByIndication = Object.fromEntries((indications || []).map((value) => [value, []]));
      const strategyLabels = {};
      let hasIndicationFilters = false;
      for (const value of values || []) {
        const parsed = parseStrategyValue(value, indications);
        strategyLabels[value] = parsed.indications.length ? parsed.label : (labels[value] || parsed.label || value);
        if (!parsed.indications.length) continue;
        hasIndicationFilters = true;
        for (const indication of parsed.indications) {
          const key = validByKey.get(normalize(indication)) || indication;
          if (!optionsByIndication[key]) optionsByIndication[key] = [];
          if (!optionsByIndication[key].includes(value)) optionsByIndication[key].push(value);
        }
      }
      return { strategyLabels, strategyOptionsByIndication: hasIndicationFilters ? optionsByIndication : {}, hasIndicationFilters };
    };
    export const buildBarrierDriverCategoryPicklistInfo = (values = [], labels = {}, indications = []) => {
      const validByKey = new Map((indications || []).map((value) => [normalize(value), value]));
      const optionsByIndication = Object.fromEntries((indications || []).map((value) => [value, []]));
      const categoryLabels = {};
      let hasIndicationFilters = false;
      for (const value of values || []) {
        const parsed = parseStrategyValue(value, indications);
        categoryLabels[value] = parsed.indications.length ? parsed.label : (labels[value] || parsed.label || value);
        if (!parsed.indications.length) continue;
        hasIndicationFilters = true;
        for (const indication of parsed.indications) {
          const key = validByKey.get(normalize(indication)) || indication;
          if (!optionsByIndication[key]) optionsByIndication[key] = [];
          if (!optionsByIndication[key].includes(value)) optionsByIndication[key].push(value);
        }
      }
      return { categoryLabels, categoryOptionsByIndication: hasIndicationFilters ? optionsByIndication : {}, hasIndicationFilters };
    };
    export const PLAN_STRATEGY_OBJECT = 'KPH_Strategy__c';
    export const searchUsers = () => Promise.resolve([]);
    export const sortTeamMembersByParticipation = (members) => members || [];
    export const summarizeReferralActivityMetrics = (rows) => ({
      referralVolume: String((rows || []).reduce((sum, row) => sum + (Number(row.referralCount) || 0), 0)),
      secondLinePlusVolume: String((rows || []).reduce((sum, row) => sum + (Number(row.treatedPatients) || 0), 0)),
    });
    export const toBarrierDriver = (row) => row;
    export const toCustomerGoals = () => '';
    export const toPlanShape = () => ({ id: 'plan-001', accountId: 'account-001' });
    export const updateBarrierDriver = () => Promise.resolve({});
    export const updateBarrierDriverStatus = () => Promise.resolve({});
    export const updateCriticalActivity = () => Promise.resolve({});
    export const updateCustomerGoals = () => Promise.resolve({});
  `);

  const queryStubUrl = dataModule(`
    export const getPicklistValueLabels = (object, field) => {
      globalThis.__homePicklistCalls.push({ object, field });
      return Promise.resolve(
        (globalThis.__homePicklistLabels[object] &&
          globalThis.__homePicklistLabels[object][field]) ||
        {}
      );
    };
  `);
  const dependentPicklistsStubUrl = dataModule(`
    const normalize = (value) => String(value || '').trim().toUpperCase();
    export const fetchDependencyOptionsFromObjectMetadata = () =>
      Promise.resolve(globalThis.__homeStrategyDependency || {});
    export const optionsForControllerValue = (optionsByController = {}, controllerValue) => {
      if (optionsByController[controllerValue]) return optionsByController[controllerValue];
      const key = Object.keys(optionsByController || {}).find((candidate) => normalize(candidate) === normalize(controllerValue));
      return key ? optionsByController[key] : null;
    };
  `);

  const source = (await readFile(homeModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/shared['"]/g, `from '${sharedStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/dependentPicklists['"]/g, `from '${dependentPicklistsStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__homePicklistCalls, aggregateCalls: globalThis.__homeAggregateCalls };
};

test('searchUsers queries User records with blank default and case-insensitive name matching', async () => {
  const { mod, calls } = await loadSharedModule();

  const defaultRows = await mod.searchUsers('', 60);
  const searchedRows = await mod.searchUsers('priya', 60);

  assert.equal(calls[0].object, 'User');
  assert.deepEqual(calls[0].fields, ['Id', 'Name']);
  assert.equal(calls[0].where, undefined);
  assert.equal(calls[0].limit, 60);
  assert.equal(calls[1].object, 'User');
  assert.match(calls[1].where, /Name LIKE '%priya%'/);
  assert.match(calls[1].where, /Name LIKE '%PRIYA%'/);
  assert.deepEqual(defaultRows.map((row) => row.name), ['PRIYA KUMAR', 'James Chen']);
  assert.deepEqual(searchedRows.map((row) => row.name), ['PRIYA KUMAR']);
});

test('searchUsers excludes already-added team member user ids from query and results', async () => {
  const { mod, calls } = await loadSharedModule();

  const rows = await mod.searchUsers('', 60, ['0058C00000UserAAA']);

  assert.equal(calls[0].object, 'User');
  assert.match(calls[0].where, /Id != '0058C00000UserAAA'/);
  assert.deepEqual(rows.map((row) => row.name), ['James Chen']);
});

test('loadHome includes dynamic POD participation picklist options', async () => {
  const { mod, calls, aggregateCalls } = await loadHomeModule();

  const data = await mod.loadHome();

  assert.equal(data.header.referralVolume, '12');
  assert.equal(data.header.secondLinePlusVolume, '6');
  assert.equal(data.header.marketAccessPrioritizedAccount, 'Yes');
  assert.ok(calls.some((call) =>
    call.object === 'Account_Team_Member_vod__c' && call.field === 'KPH_Participation__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'Account' && call.field === 'KPH_Market_Access_Prioritized_Account__c'
  ));
  assert.deepEqual(data.picklists.marketAccessPrioritizedOptions, ['Yes', 'No']);
  // Strictly CRM metadata — 'Extended' only lives on a POD record, so it's
  // no longer unioned into the participation picklist.
  assert.deepEqual(data.picklists.participationOptions, ['Core', 'Lead']);
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Barriers_and_Tactical_Actions__c' && call.field === 'KPH_Indication__c'
  ));
  assert.deepEqual(data.picklists.barrierDriverIndications, ['DLBCL', 'MM', 'Portfolio', 'aALL']);
  assert.deepEqual(data.picklists.dlbclStrategies, [
    'DLBCL Strategy | DLBCL,Portfolio',
    'DLBCL Only Strategy | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.portfolioStrategies, [
    'DLBCL Strategy | DLBCL,Portfolio',
    'DLBCL Only Strategy | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.mmStrategies, ['MM Pre-Launch Readiness | MM']);
  assert.deepEqual(data.picklists.strategyOptionsByIndication.MM, ['MM Pre-Launch Readiness | MM']);
  assert.equal(data.picklists.strategyLabels['DLBCL Strategy | DLBCL,Portfolio'], 'DLBCL Strategy');
  assert.equal(aggregateCalls[0].strategyLabels['DLBCL Strategy | DLBCL,Portfolio'], 'DLBCL Strategy');
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Barriers_and_Tactical_Actions__c' && call.field === 'KPH_Strategy__c'
  ));
  assert.ok(!calls.some((call) =>
    call.object === 'KPH_Barriers_and_Tactical_Actions__c' && call.field === 'KPH_MM_Strategy__c'
  ));
  assert.deepEqual(data.picklists.dlbclBarrierCategories, ['DLBCL Barrier Category | DLBCL,Portfolio']);
  assert.deepEqual(data.picklists.dlbclDriverCategories, [
    'DLBCL Driver Category | DLBCL,Portfolio',
    'MM Driver Category',
  ]);
  assert.ok(!Object.hasOwn(data.picklists, 'mmBarrierCategories'));
  assert.ok(!Object.hasOwn(data.picklists, 'mmDriverCategories'));
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.DLBCL, [
    'DLBCL Driver Category | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.Portfolio, [
    'DLBCL Driver Category | DLBCL,Portfolio',
  ]);
  assert.equal(data.picklists.categoryLabels['DLBCL Driver Category | DLBCL,Portfolio'], 'DLBCL Driver Category');
  assert.equal(
    data.picklists.categoryLabels['DLBCL Barrier Category | DLBCL,Portfolio'],
    'DLBCL Barrier Category | DLBCL,Portfolio'
  );
  assert.ok(calls.every((call) =>
    call.field !== 'KPH_MM_Barrier_Type__c' && call.field !== 'KPH_MM_Driver_Type__c'
  ));
});

test('Home POD user popup passes participation and User lookup wiring into TeamMemberEditModal', async () => {
  const overviewSource = await readFile(overviewPagePath, 'utf8');
  const modalSource = await readFile(teamMemberModalPath, 'utf8');

  assert.match(overviewSource, /participationOptions=\{picklists\.participationOptions \|\| \[\]\}/);
  assert.match(overviewSource, /searchUsers=\{searchAvailableTeamUsers\}/);
  assert.match(modalSource, /AccountLookupField/);
  assert.match(modalSource, /userId: member\?\.userId \|\| ''/);
  assert.match(modalSource, /onQueryChange=\{updateUserQuery\}/);
});

test('Team member popups exclude existing users and reject duplicate user ids before save', async () => {
  const overviewSource = await readFile(overviewPagePath, 'utf8');
  const teamMembersSource = await readFile(teamMembersPagePath, 'utf8');

  assert.match(overviewSource, /searchAvailableTeamUsers/);
  assert.match(overviewSource, /searchTeamUsers\(query,\s*limit,\s*excludedLookupUserRawIds\)/);
  assert.match(overviewSource, /hasDuplicateTeamMemberUser\(teamMembers,\s*form\.userId,\s*id\)/);
  assert.match(overviewSource, /DUPLICATE_TEAM_MEMBER_MESSAGE/);
  assert.match(overviewSource, /searchUsers=\{searchAvailableTeamUsers\}/);

  assert.match(teamMembersSource, /searchAvailableTeamUsers/);
  assert.match(teamMembersSource, /searchTeamUsers\(query,\s*limit,\s*excludedLookupUserRawIds\)/);
  assert.match(teamMembersSource, /hasDuplicateTeamMemberUser\(rows,\s*form\.userId,\s*id \|\| null\)/);
  assert.match(teamMembersSource, /DUPLICATE_TEAM_MEMBER_MESSAGE/);
  assert.match(teamMembersSource, /searchUsers=\{searchAvailableTeamUsers\}/);
});

test('team member create and update omit read-only role and status fields', async () => {
  const { mod, creates, updates } = await loadSharedModule();

  await mod.createTeamMember('plan-001', {
    userId: '0058C00000UserAAA',
    name: 'Priya Kumar',
    role: 'KAD',
    status: 'Active',
    participation: 'Extended',
  });
  await mod.updateTeamMember('atm-001', {
    userId: '0058C00000UserAAA',
    name: 'Priya Kumar',
    role: 'KAD',
    status: 'Inactive',
    participation: 'Lead',
  });

  assert.equal(creates[0].object, 'Account_Team_Member_vod__c');
  assert.equal(creates[0].fields.Account_Plan_vod__c, 'plan-001');
  assert.equal(creates[0].fields.Team_Member_vod__c, '0058C00000UserAAA');
  assert.equal(creates[0].fields.Team_Member_Name_vod__c, 'Priya Kumar');
  assert.equal(creates[0].fields.KPH_Participation__c, 'Extended');
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_Role__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'Account_Team_Member_Active__c'));

  assert.equal(updates[0].object, 'Account_Team_Member_vod__c');
  assert.equal(updates[0].fields.Team_Member_vod__c, '0058C00000UserAAA');
  assert.equal(updates[0].fields.Team_Member_Name_vod__c, 'Priya Kumar');
  assert.equal(updates[0].fields.KPH_Participation__c, 'Lead');
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_Role__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'Account_Team_Member_Active__c'));
});

test('Team member popup keeps role and status read-only in Add mode', async () => {
  const modalSource = await readFile(teamMemberModalPath, 'utf8');

  assert.match(modalSource, /\{ label: 'Role', key: 'role', readOnly: true/);
  assert.match(modalSource, /\{ label: 'Status', key: 'status', readOnly: true/);
  assert.doesNotMatch(modalSource, /field\.readOnly && !isNew/);
});

test('Team member popup exposes field-level helper guidance', async () => {
  const modalSource = await readFile(teamMemberModalPath, 'utf8');

  assert.match(modalSource, /FieldHelpButton/);
  assert.match(modalSource, /TEAM_MEMBER_FIELD_HELP/);
  assert.match(modalSource, /Select the internal user who may access and contribute to the account plan/);
  assert.match(modalSource, /Identifies the team member's title/);
  assert.match(modalSource, /Defines how the team member contributes to the account plan/);
  assert.match(modalSource, /help=\{TEAM_MEMBER_FIELD_HELP\.name\}/);
});
