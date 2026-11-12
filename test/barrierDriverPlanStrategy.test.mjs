import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const barriersDriversModulePath = new URL('../src/lib/dataservice/accountPlan/barriersDrivers.js', import.meta.url);
const barrierDriverModalPath = new URL('../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx', import.meta.url);
const barriersDriversPagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const barriersDriversCssPath = new URL('../src/pages/BarriersDrivers/BarriersDrivers.css', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const strategyPicklistInfoStub = `
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
`;

const loadSharedModule = async () => {
  globalThis.__barrierDriverStrategyMutationCalls = [];
  globalThis.__barrierDriverStrategyQueryCalls = [];
  globalThis.__barrierDriverStrategyRows = [];
  globalThis.__barrierDriverStrategyActivityRows = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__barrierDriverStrategyQueryCalls.push(params);
      if (params.object === 'KPH_Strategy__c') {
        return Promise.resolve(globalThis.__barrierDriverStrategyRows);
      }
      if (params.object === 'KPH_Additional_Critical_Activities__c') {
        return Promise.resolve(globalThis.__barrierDriverStrategyActivityRows);
      }
      return Promise.resolve([]);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__barrierDriverStrategyMutationCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ data: { id: object === 'KPH_Strategy__c' ? 'plan-strategy-001' : 'new-bd-001' } });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__barrierDriverStrategyMutationCalls.push({ type: 'update', object, id, fields });
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
    calls: globalThis.__barrierDriverStrategyMutationCalls,
    queries: globalThis.__barrierDriverStrategyQueryCalls,
  };
};

const loadBarriersDriversModule = async () => {
  globalThis.__barrierDriverPicklistCalls = [];
  globalThis.__barrierDriverStrategyDependency = {
    MM: ['Wrong Metadata Strategy'],
  };
  globalThis.__barrierDriverPicklistLabels = {
    KPH_Barriers_and_Tactical_Actions__c: {
      KPH_Status__c: { Open: 'Open', Closed: 'Closed' },
      KPH_Indication__c: { DLBCL: 'DLBCL', MM: 'MM', Portfolio: 'Portfolio', aALL: 'aALL' },
      KPH_Strategy__c: {
        'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio': 'Grow Class | Shift Patients Earlier to CAR-T',
        'Grow Class | Expand Referral Networks | DLBCL,Portfolio': 'Grow Class | Expand Referral Networks',
        'Grow Class | Improve Patient Identification | DLBCL,Portfolio': 'Grow Class | Improve Patient Identification',
        'Win Brand | Establish YESCARTA as Preferred Choice | DLBCL,Portfolio': 'Win Brand | Establish YESCARTA as Preferred Choice',
        'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio': 'Win Brand | Build Confidence in Safety/ AE',
        'Win Brand | Scale Outpatient Treatment Adoption | DLBCL,Portfolio': 'Win Brand | Scale Outpatient Treatment Adoption',
        'MM Pre-Launch Readiness | MM': 'MM Pre-Launch Readiness',
      },
      KPH_MM_Strategy__c: {
        'Expand Class Share': 'Expand Class Share',
        'Lead/Grow Brand Share': 'Lead/Grow Brand Share',
      },
      KPH_Barrier_Type__c: {
        'Operational | DLBCL,Portfolio': 'Operational | DLBCL,Portfolio',
      },
      KPH_Driver_Type__c: {
        'Reimbursement | DLBCL,Portfolio': 'Reimbursement',
        'Clinical | DLBCL,Portfolio': 'Clinical',
        'Clinical | MM': 'Clinical',
      },
    },
    KPH_Strategy__c: {
      KPH_Strategy__c: {
        'Lead/Grow Brand Share': 'Lead/Grow Brand Share',
        'Expand Class Share': 'Expand Class Share',
      },
      KPH_Strategy_Rank__c: {
        1: '1',
        2: '2',
        3: '3',
      },
    },
  };

  const sharedStubUrl = dataModule(`
    export const BARRIER_DRIVER_OBJECT = 'KPH_Barriers_and_Tactical_Actions__c';
    export const BARRIER_DRIVER_STATUS_ORDER = ['Identified - Not Started', 'In Progress', 'Near Outcome', 'Closed'];
    export const BARRIER_DRIVER_CATEGORY_FIELDS = {
      barrier: 'KPH_Barrier_Type__c',
      driver: 'KPH_Driver_Type__c',
    };
    export const BARRIER_DRIVER_MM_STRATEGY_FIELD = 'KPH_MM_Strategy__c';
    export const BARRIER_DRIVER_INDICATION_FIELD = 'KPH_Indication__c';
    export const BARRIER_DRIVER_STRATEGY_FIELD = 'KPH_Strategy__c';
    export const PLAN_STRATEGY_OBJECT = 'KPH_Strategy__c';
    export const CRITICAL_ACTIVITY_OBJECT = 'KPH_Additional_Critical_Activities__c';
    export const buildOpenActivityCountByBarrier = () => ({});
    export const categoryPrefix = (value) => value && String(value).includes('-') ? String(value).split('-')[0].trim() : value;
    export const createSalesforceIdLookup = (records = []) => {
      const lookup = new Map();
      for (const record of records || []) {
        lookup.set(record.id, record);
        lookup.set(String(record.id || '').slice(0, 15), record);
      }
      return lookup;
    };
    export const createBarrierDriver = () => Promise.resolve({});
    export const createCriticalActivity = () => Promise.resolve({});
    export const deleteCriticalActivity = () => Promise.resolve({});
    export const fetchBarriersAndDrivers = () => Promise.resolve({
      rows: [
        { id: 'bd-001', type: 'Barrier', indication: 'Legacy Indication', strategy: 'Defend Market Share', status: 'Open', category: 'Operational' },
        { id: 'bd-002', type: 'Driver', indication: 'MM', strategy: 'MM Only Strategy', status: 'Open' },
      ],
      access: {},
    });
    export const fetchCriticalActivities = () => Promise.resolve([]);
    export const fetchPlanStrategies = () => Promise.resolve([]);
    export const fetchTeamMembersByPlan = () => Promise.resolve([]);
    export const isOpenBarrierDriverStatus = (value) => value !== 'Closed' && value !== 'Close';
    export const isVisibleBarrierDriverIndication = () => true;
    export const getSalesforceIdLookupEntry = (lookup, id) =>
      lookup.get(id) || lookup.get(String(id || '').slice(0, 15)) || null;
    export const normalizeBarrierDriverStatusForDisplay = (value) => value === 'Close' ? 'Closed' : (value || 'Open');
    export const planStrategyMapById = () => new Map();
    ${strategyPicklistInfoStub}
    export const requireCurrentAccountPlanId = () => Promise.resolve('plan-001');
    export const resolveShellContextForPlanId = () => Promise.resolve({ planId: 'plan-001', plan: {}, account: {} });
    export const resolveShellContext = resolveShellContextForPlanId;
    export const toBarrierDriver = (row) => row;
    export const updateBarrierDriver = () => Promise.resolve({});
    export const updateBarrierDriverStatus = () => Promise.resolve({});
    export const updateCriticalActivity = () => Promise.resolve({});
  `);

  const queryStubUrl = dataModule(`
    export const getPicklistValueLabels = (object, field) => {
      globalThis.__barrierDriverPicklistCalls.push({ object, field });
      return Promise.resolve(
        (globalThis.__barrierDriverPicklistLabels[object] &&
          globalThis.__barrierDriverPicklistLabels[object][field]) ||
        {}
      );
    };
  `);
  const dependentPicklistsStubUrl = dataModule(`
    const normalize = (value) => String(value || '').trim().toUpperCase();
    export const fetchDependencyOptionsFromObjectMetadata = () =>
      Promise.resolve(globalThis.__barrierDriverStrategyDependency || {});
    export const optionsForControllerValue = (optionsByController = {}, controllerValue) => {
      if (optionsByController[controllerValue]) return optionsByController[controllerValue];
      const key = Object.keys(optionsByController || {}).find((candidate) => normalize(candidate) === normalize(controllerValue));
      return key ? optionsByController[key] : null;
    };
  `);

  const source = (await readFile(barriersDriversModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/shared['"]/g, `from '${sharedStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/dependentPicklists['"]/g, `from '${dependentPicklistsStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__barrierDriverPicklistCalls };
};

test('createBarrierDriver does not create plan strategy records for missing strategy links', async () => {
  const { mod, calls, queries } = await loadSharedModule();

  await mod.createBarrierDriver('plan-001', {
    type: 'Barrier',
    name: 'New barrier',
    status: 'Open',
    indication: 'DLBCL',
    category: 'Clinical',
    businessImpact: 'High',
    strategy: 'Expand Class Share',
    strategyRank: '2',
  });

  assert.ok(queries.length > 0, 'expected plan strategy lookup before barrier create');
  assert.equal(queries[0].object, mod.PLAN_STRATEGY_OBJECT);
  assert.match(queries[0].where, /KPH_Strategy__c = 'Expand Class Share'/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'create');
  assert.equal(calls[0].object, mod.BARRIER_DRIVER_OBJECT);
  assert.equal(calls[0].fields.KPH_Account_Plan__c, 'plan-001');
  assert.equal(calls[0].fields.KPH_Barrier_Type__c, 'Clinical');
  assert.equal(calls[0].fields.KPH_Driver_Type__c, null);
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_MM_Barrier_Type__c'));
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_MM_Driver_Type__c'));
  assert.equal(calls[0].fields.KPH_Strategy__c, 'Expand Class Share');
  assert.ok(!Object.prototype.hasOwnProperty.call(calls[0].fields, 'KPH_MM_Strategy__c'));
  assert.equal(calls[0].fields.KPH_Plan_Strategy__c, null);
  assert.ok(!calls.some((call) => call.object === mod.PLAN_STRATEGY_OBJECT));
});

test('barrier driver category field mapping follows indication and type', async () => {
  const { mod } = await loadSharedModule();

  assert.equal(mod.barrierDriverCategoryFieldFor('Barrier', 'DLBCL'), 'KPH_Barrier_Type__c');
  assert.equal(mod.barrierDriverCategoryFieldFor('Driver', 'DLBCL'), 'KPH_Driver_Type__c');
  assert.equal(mod.barrierDriverCategoryFieldFor('Barrier', 'MM'), 'KPH_Barrier_Type__c');
  assert.equal(mod.barrierDriverCategoryFieldFor('Driver', 'MM'), 'KPH_Driver_Type__c');
});

test('updateBarrierDriver does not create plan strategy records for missing strategy links', async () => {
  const { mod, calls, queries } = await loadSharedModule();

  await mod.updateBarrierDriver('bd-001', {
    accountPlanId: 'plan-001',
    type: 'Driver',
    name: 'Updated driver',
    status: 'Open',
    indication: 'MM',
    category: 'Operational',
    businessImpact: 'Medium',
    strategy: 'Lead/Grow Brand Share',
    strategyRank: '1',
  });

  // MM now uses the same KPH_Strategy__c field. The plan-strategy lookup still
  // resolves by the strategy value but never creates a plan strategy record.
  assert.equal(queries.length, 1, 'MM updates resolve the plan strategy lookup');
  assert.equal(queries[0].object, mod.PLAN_STRATEGY_OBJECT);
  assert.match(queries[0].where, /KPH_Strategy__c = 'Lead\/Grow Brand Share'/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.BARRIER_DRIVER_OBJECT);
  assert.equal(calls[0].id, 'bd-001');
  assert.equal(calls[0].fields.KPH_Barrier_Type__c, null);
  assert.equal(calls[0].fields.KPH_Driver_Type__c, 'Operational');
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_MM_Barrier_Type__c'));
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_MM_Driver_Type__c'));
  assert.equal(calls[0].fields.KPH_Strategy__c, 'Lead/Grow Brand Share');
  assert.ok(!Object.prototype.hasOwnProperty.call(calls[0].fields, 'KPH_MM_Strategy__c'));
  assert.equal(calls[0].fields.KPH_Plan_Strategy__c, null);
  assert.ok(!calls.some((call) => call.object === mod.PLAN_STRATEGY_OBJECT));
});

test('updateBarrierDriver cascades an indication change to mismatched linked activities', async () => {
  const { mod, calls, queries } = await loadSharedModule();
  globalThis.__barrierDriverStrategyActivityRows = [
    { Id: 'act-1', KPH_Indication__c: 'DLBCL' },
    { Id: 'act-2', KPH_Indication__c: 'Portfolio' },
  ];

  await mod.updateBarrierDriver('bd-001', {
    accountPlanId: 'plan-001',
    type: 'Barrier',
    name: 'Reframed barrier',
    status: 'Open',
    indication: 'Portfolio',
    previousIndication: 'DLBCL',
    category: 'Clinical',
    businessImpact: 'High',
    strategy: '',
  });

  const activityQuery = queries.find((q) => q.object === mod.CRITICAL_ACTIVITY_OBJECT);
  assert.ok(activityQuery, 'expected a query for linked critical activities');
  assert.match(activityQuery.where, /Barrier_and_Tactical_Action__c = 'bd-001'/);

  const activityUpdates = calls.filter(
    (c) => c.object === mod.CRITICAL_ACTIVITY_OBJECT && c.type === 'update'
  );
  assert.equal(activityUpdates.length, 1, 'only the mismatched activity is re-stamped');
  assert.equal(activityUpdates[0].id, 'act-1');
  assert.equal(activityUpdates[0].fields.KPH_Indication__c, 'Portfolio');
});

test('updateBarrierDriver does not cascade when indication is unchanged', async () => {
  const { mod, calls, queries } = await loadSharedModule();
  globalThis.__barrierDriverStrategyActivityRows = [{ Id: 'act-1', KPH_Indication__c: 'DLBCL' }];

  await mod.updateBarrierDriver('bd-001', {
    accountPlanId: 'plan-001',
    type: 'Barrier',
    name: 'Same indication',
    status: 'Open',
    indication: 'DLBCL',
    previousIndication: 'DLBCL',
    category: 'Clinical',
    businessImpact: 'High',
    strategy: '',
  });

  assert.ok(!queries.some((q) => q.object === mod.CRITICAL_ACTIVITY_OBJECT));
  assert.ok(!calls.some((c) => c.object === mod.CRITICAL_ACTIVITY_OBJECT));
});

test('barriers drivers page mirrors indication cascade with Salesforce ID variants', async () => {
  const pageSource = await readFile(barriersDriversPagePath, 'utf8');

  assert.match(pageSource, /recordIdMatches\(a\.barrierDriverId,\s*updated\.id\)/);
  assert.doesNotMatch(pageSource, /a\.barrierDriverId\s*===\s*updated\.id/);
});

test('createBarrierDriver links an existing plan strategy for same account plan and strategy value', async () => {
  const { mod, calls, queries } = await loadSharedModule();
  globalThis.__barrierDriverStrategyRows = [
    {
      Id: 'existing-plan-strategy-001',
      KPH_Account_Plan__c: 'plan-001',
      KPH_Strategy__c: 'Expand Class Share',
      KPH_Strategy_Rank__c: '1',
    },
  ];

  await mod.createBarrierDriver('plan-001', {
    type: 'Barrier',
    name: 'New barrier',
    status: 'Open',
    indication: 'DLBCL',
    category: 'Clinical',
    businessImpact: 'High',
    strategy: 'Expand Class Share',
    strategyRank: '2',
  });

  assert.ok(queries.length > 0, 'expected plan strategy lookup before create');
  assert.equal(queries[0].object, mod.PLAN_STRATEGY_OBJECT);
  assert.match(queries[0].where, /KPH_Strategy__c = 'Expand Class Share'/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'create');
  assert.equal(calls[0].object, mod.BARRIER_DRIVER_OBJECT);
  assert.equal(calls[0].fields.KPH_Plan_Strategy__c, 'existing-plan-strategy-001');
  assert.ok(!calls.some((call) => call.object === mod.PLAN_STRATEGY_OBJECT));
});

test('buildBarrierDriverStrategyPicklistInfo derives labels and filters from API-name suffixes', async () => {
  const { mod } = await loadSharedModule();

  const info = mod.buildBarrierDriverStrategyPicklistInfo(
    [
      'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
      'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
      'MM Pre-Launch Readiness | MM',
      'Legacy Strategy | Without CRM Indication Suffix',
    ],
    {
      'Legacy Strategy | Without CRM Indication Suffix': 'Legacy Strategy | Without CRM Indication Suffix',
    },
    ['DLBCL', 'MM', 'Portfolio']
  );

  assert.equal(
    info.strategyLabels['Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio'],
    'Grow Class | Shift Patients Earlier to CAR-T'
  );
  assert.equal(
    info.strategyLabels['Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio'],
    'Win Brand | Build Confidence in Safety/ AE'
  );
  assert.equal(info.strategyLabels['MM Pre-Launch Readiness | MM'], 'MM Pre-Launch Readiness');
  assert.equal(
    info.strategyLabels['Legacy Strategy | Without CRM Indication Suffix'],
    'Legacy Strategy | Without CRM Indication Suffix'
  );
  assert.deepEqual(info.strategyOptionsByIndication.DLBCL, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
  ]);
  assert.deepEqual(info.strategyOptionsByIndication.Portfolio, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
  ]);
  assert.deepEqual(info.strategyOptionsByIndication.MM, ['MM Pre-Launch Readiness | MM']);
});

test('buildBarrierDriverCategoryPicklistInfo derives labels and filters from API-name suffixes', async () => {
  const { mod } = await loadSharedModule();

  const info = mod.buildBarrierDriverCategoryPicklistInfo(
    [
      'Reimbursement | DLBCL,Portfolio',
      'Clinical | DLBCL,Portfolio',
      'Clinical | MM',
      'Legacy Category | Without CRM Indication Suffix',
    ],
    {
      'Legacy Category | Without CRM Indication Suffix': 'Legacy Category | Without CRM Indication Suffix',
    },
    ['DLBCL', 'MM', 'Portfolio']
  );

  assert.equal(info.categoryLabels['Reimbursement | DLBCL,Portfolio'], 'Reimbursement');
  assert.equal(info.categoryLabels['Clinical | DLBCL,Portfolio'], 'Clinical');
  assert.equal(info.categoryLabels['Clinical | MM'], 'Clinical');
  assert.equal(
    info.categoryLabels['Legacy Category | Without CRM Indication Suffix'],
    'Legacy Category | Without CRM Indication Suffix'
  );
  assert.deepEqual(info.categoryOptionsByIndication.DLBCL, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
  ]);
  assert.deepEqual(info.categoryOptionsByIndication.Portfolio, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
  ]);
  assert.deepEqual(info.categoryOptionsByIndication.MM, ['Clinical | MM']);
});

test('loadBarriersDrivers uses barrier-driver strategy picklists as source of truth', async () => {
  const { mod, calls } = await loadBarriersDriversModule();

  const data = await mod.loadBarriersDrivers();

  assert.ok(calls.some((call) =>
    call.object === 'KPH_Strategy__c' && call.field === 'KPH_Strategy_Rank__c'
  ));
  assert.deepEqual(data.picklists.dlbclStrategies, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Grow Class | Expand Referral Networks | DLBCL,Portfolio',
    'Grow Class | Improve Patient Identification | DLBCL,Portfolio',
    'Win Brand | Establish YESCARTA as Preferred Choice | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
    'Win Brand | Scale Outpatient Treatment Adoption | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.portfolioStrategies, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Grow Class | Expand Referral Networks | DLBCL,Portfolio',
    'Grow Class | Improve Patient Identification | DLBCL,Portfolio',
    'Win Brand | Establish YESCARTA as Preferred Choice | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
    'Win Brand | Scale Outpatient Treatment Adoption | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.mmStrategies, ['MM Pre-Launch Readiness | MM']);
  assert.deepEqual(data.picklists.strategyOptionsByIndication.MM, ['MM Pre-Launch Readiness | MM']);
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Barriers_and_Tactical_Actions__c' && call.field === 'KPH_Indication__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Barriers_and_Tactical_Actions__c' && call.field === 'KPH_Strategy__c'
  ));
  assert.ok(!calls.some((call) =>
    call.object === 'KPH_Barriers_and_Tactical_Actions__c' && call.field === 'KPH_MM_Strategy__c'
  ));
  // MM is no longer filtered out of the indication options.
  assert.deepEqual(data.picklists.barrierDriverIndications, ['DLBCL', 'MM', 'Portfolio', 'aALL']);
  assert.deepEqual(data.picklists.strategyRanks, ['1', '2', '3']);
  assert.deepEqual(data.picklists.dlbclBarrierCategories, ['Operational | DLBCL,Portfolio']);
  assert.deepEqual(data.picklists.dlbclDriverCategories, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
    'Clinical | MM',
  ]);
  assert.ok(!Object.hasOwn(data.picklists, 'mmBarrierCategories'));
  assert.ok(!Object.hasOwn(data.picklists, 'mmDriverCategories'));
  assert.deepEqual(data.picklists.barrierCategoryOptionsByIndication, {});
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.DLBCL, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.Portfolio, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.MM, ['Clinical | MM']);
  assert.equal(data.picklists.categoryLabels['Clinical | DLBCL,Portfolio'], 'Clinical');
  assert.equal(data.picklists.categoryLabels['Operational | DLBCL,Portfolio'], 'Operational | DLBCL,Portfolio');
  assert.ok(calls.every((call) =>
    call.field !== 'KPH_MM_Barrier_Type__c' && call.field !== 'KPH_MM_Driver_Type__c'
  ));
  assert.ok(data.picklists.barrierStrategies.includes('Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio'));
  assert.ok(!data.picklists.barrierStrategies.includes('Lead/Grow Brand Share'));
  assert.ok(!calls.some((call) =>
    call.object === 'KPH_Strategy__c' && call.field === 'KPH_Strategy__c'
  ));
});

test('loadBarriersDrivers filters and labels strategies from the appended API name indications', async () => {
  const { mod } = await loadBarriersDriversModule();
  globalThis.__barrierDriverPicklistLabels.KPH_Barriers_and_Tactical_Actions__c.KPH_Strategy__c = {
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio': 'Grow Class | Shift Patients Earlier to CAR-T',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio': 'Win Brand | Build Confidence in Safety/ AE',
    'MM Pre-Launch Readiness | MM': 'MM Pre-Launch Readiness',
  };
  globalThis.__barrierDriverStrategyDependency = {
    DLBCL: ['Wrong Metadata Strategy'],
    MM: ['Wrong Metadata Strategy'],
  };

  const data = await mod.loadBarriersDrivers();

  assert.deepEqual(data.picklists.barrierStrategies, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
    'MM Pre-Launch Readiness | MM',
  ]);
  assert.deepEqual(data.picklists.dlbclStrategies, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.portfolioStrategies, [
    'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    'Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.mmStrategies, ['MM Pre-Launch Readiness | MM']);
  assert.equal(
    data.picklists.strategyLabels['Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio'],
    'Grow Class | Shift Patients Earlier to CAR-T'
  );
  assert.equal(
    data.picklists.strategyLabels['Win Brand | Build Confidence in Safety/ AE | DLBCL,Portfolio'],
    'Win Brand | Build Confidence in Safety/ AE'
  );
  assert.equal(data.picklists.strategyLabels['MM Pre-Launch Readiness | MM'], 'MM Pre-Launch Readiness');
});

test('loadBarriersDrivers filters and labels driver categories from appended API name indications', async () => {
  const { mod } = await loadBarriersDriversModule();
  globalThis.__barrierDriverPicklistLabels.KPH_Barriers_and_Tactical_Actions__c.KPH_Driver_Type__c = {
    'Reimbursement | DLBCL,Portfolio': 'Reimbursement',
    'Clinical | DLBCL,Portfolio': 'Clinical',
    'Network | Portfolio': 'Network',
    'Legacy Driver Category | Without CRM Indication Suffix': 'Legacy Driver Category | Without CRM Indication Suffix',
  };
  globalThis.__barrierDriverPicklistLabels.KPH_Barriers_and_Tactical_Actions__c.KPH_Driver_Type__c['Clinical | MM'] = 'Clinical';

  const data = await mod.loadBarriersDrivers();

  assert.deepEqual(data.picklists.dlbclDriverCategories, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
    'Network | Portfolio',
    'Legacy Driver Category | Without CRM Indication Suffix',
    'Clinical | MM',
  ]);
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.DLBCL, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
  ]);
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.Portfolio, [
    'Reimbursement | DLBCL,Portfolio',
    'Clinical | DLBCL,Portfolio',
    'Network | Portfolio',
  ]);
  assert.deepEqual(data.picklists.driverCategoryOptionsByIndication.MM, ['Clinical | MM']);
  assert.equal(data.picklists.categoryLabels['Reimbursement | DLBCL,Portfolio'], 'Reimbursement');
  assert.equal(data.picklists.categoryLabels['Network | Portfolio'], 'Network');
});

test('toBarrierDriver maps strategy rank from linked plan strategy row', async () => {
  const { mod } = await loadSharedModule();

  const record = mod.toBarrierDriver(
    {
      Id: 'bd-001',
      KPH_Account_Plan__c: 'plan-001',
      KPH_Plan_Strategy__c: 'plan-strategy-001',
      KPH_Barrier_Title__c: 'Existing barrier',
      KPH_Indication__c: 'DLBCL',
      KPH_Status__c: 'Open',
      KPH_Strategy__c: 'Expand Class Share',
    },
    undefined,
    new Map([
      ['plan-strategy-001', { id: 'plan-strategy-001', strategyRank: '2' }],
    ])
  );

  assert.equal(record.planStrategyId, 'plan-strategy-001');
  assert.equal(record.strategyRank, '2');
});

test('toBarrierDriver preserves the strategy API value and exposes the display label', async () => {
  const { mod } = await loadSharedModule();

  const record = mod.toBarrierDriver(
    {
      Id: 'bd-001',
      KPH_Account_Plan__c: 'plan-001',
      KPH_Barrier_Title__c: 'Existing barrier',
      KPH_Indication__c: 'DLBCL',
      KPH_Status__c: 'Open',
      KPH_Strategy__c: 'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
    },
    undefined,
    new Map(),
    {
      strategyLabels: {
        'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio': 'Grow Class | Shift Patients Earlier to CAR-T',
      },
    }
  );

  assert.equal(record.strategy, 'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio');
  assert.equal(record.strategyLabel, 'Grow Class | Shift Patients Earlier to CAR-T');
});

test('aggregateStrategies displays strategy labels while grouping by indication', async () => {
  const { mod } = await loadSharedModule();

  const strategies = mod.aggregateStrategies(
    [
      {
        Id: 'bd-001',
        KPH_Indication__c: 'DLBCL',
        KPH_Status__c: 'Open',
        KPH_Strategy__c: 'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio',
      },
      {
        Id: 'bd-002',
        KPH_Indication__c: 'MM',
        KPH_Status__c: 'Open',
        KPH_Strategy__c: 'MM Pre-Launch Readiness | MM',
      },
    ],
    {
      'Grow Class | Shift Patients Earlier to CAR-T | DLBCL,Portfolio': 'Grow Class | Shift Patients Earlier to CAR-T',
      'MM Pre-Launch Readiness | MM': 'MM Pre-Launch Readiness',
    }
  );

  assert.deepEqual(strategies.dlbcl, ['Grow Class | Shift Patients Earlier to CAR-T']);
  assert.deepEqual(strategies.mm, ['MM Pre-Launch Readiness']);
});

test('toBarrierDriver preserves exact category API value for restricted picklist saves', async () => {
  const { mod } = await loadSharedModule();

  const record = mod.toBarrierDriver({
    Id: 'bd-001',
    KPH_Account_Plan__c: 'plan-001',
    KPH_Barrier_Title__c: 'Existing barrier',
    KPH_Indication__c: 'DLBCL',
    KPH_Status__c: 'Open',
    KPH_Barrier_Type__c: 'Clinical | DLBCL,Portfolio',
  }, undefined, new Map(), {
    categoryLabels: {
      'Clinical | DLBCL,Portfolio': 'Clinical',
    },
  });

  assert.equal(record.category, 'Clinical');
  assert.equal(record.categoryValue, 'Clinical | DLBCL,Portfolio');
});

test('barrier driver modal hides rank and keeps category validation explicit', async () => {
  const modalSource = await readFile(barrierDriverModalPath, 'utf8');

  assert.doesNotMatch(modalSource, /strategyRank: record\?\.strategyRank \|\| ''/);
  assert.doesNotMatch(modalSource, /picklists\?\.strategyRanks/);
  assert.doesNotMatch(modalSource, /Field label="Strategy Rank"/);
  assert.doesNotMatch(modalSource, /updateField\('strategyRank'/);
  assert.doesNotMatch(modalSource, /required=\{usesStrategy\}/);
  assert.match(modalSource, /disabled=\{nonStatusFieldsDisabled \|\| !usesStrategy\}/);
  assert.match(modalSource, /disabled=\{nonStatusFieldsDisabled \|\| !hasIndication\}/);
  assert.match(modalSource, /if \(!submission\.category\)/);
  assert.match(modalSource, /onSave\(submission\)/);
  assert.match(modalSource, /Strategy is required/);
  assert.match(modalSource, /Select a valid strategy/);
  assert.match(modalSource, /Select a valid category/);
  assert.doesNotMatch(modalSource, /isDlbclCategoryBlocked/);
  assert.doesNotMatch(modalSource, /hasStrategy/);
  assert.doesNotMatch(modalSource, /categoryMatchesStrategy/);
  assert.doesNotMatch(modalSource, /Select a category for the selected strategy/);
  assert.doesNotMatch(modalSource, /Select strategy first/);
});

test('barrier driver modal refreshes category options when indication changes', async () => {
  const modalSource = await readFile(barrierDriverModalPath, 'utf8');

  assert.match(
    modalSource,
    /const categorySource = !hasIndication[\s\S]*?dependentCategorySource[\s\S]*?picklists\?\.dlbclDriverCategories[\s\S]*?picklists\?\.dlbclBarrierCategories/
  );
  assert.doesNotMatch(modalSource, /picklists\?\.mmDriverCategories/);
  assert.doesNotMatch(modalSource, /picklists\?\.mmBarrierCategories/);
  assert.match(
    modalSource,
    /if \(key === 'indication'\) \{[\s\S]*?next\.strategy = '';[\s\S]*?next\.category = '';[\s\S]*?\}/
  );
  assert.match(
    modalSource,
    /const categoryOptions = useMemo\([\s\S]*?restrictedOptions\(form\.category, categorySource \|\| picklists\?\.barrierCategories\)[\s\S]*?\[form\.category, categorySource, picklists\?\.barrierCategories\]/
  );
});

test('barrier driver modal makes every popup field mandatory', async () => {
  const modalSource = await readFile(barrierDriverModalPath, 'utf8');

  for (const message of [
    'Type is required.',
    'Status is required.',
    'Title is required.',
    'Indication is required.',
    'Strategy is required.',
    'Category is required.',
    'Business Impact is required.',
    'Comments are required.',
  ]) {
    assert.match(modalSource, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const field of [
    'name',
    'status',
    'type',
    'indication',
    'strategy',
    'category',
    'businessImpact',
    'comments',
  ]) {
    assert.match(
      modalSource,
      new RegExp(`(?:value=\\{form\\.${field}\\}|value=\\{submission\\.${field}\\})[\\s\\S]*?required`)
    );
  }

  assert.doesNotMatch(modalSource, /required=\{!isEdit\}/);
  assert.match(modalSource, /if \(!submission\.businessImpact\)/);
  assert.match(modalSource, /if \(!submission\.comments\.trim\(\)\)/);
});

test('closed barrier and driver records allow status-only editing with a clear explanation', async () => {
  const modalSource = await readFile(barrierDriverModalPath, 'utf8');
  const pageSource = await readFile(barriersDriversPagePath, 'utf8');
  const cssSource = await readFile(barriersDriversCssPath, 'utf8');

  assert.match(
    modalSource,
    /const statusOnlyMode = isEdit && \([\s\S]*?isClosedBarrierDriverStatus\(record\?\.status\) \|\| kiteDataAdminStatusOnlyMode[\s\S]*?\)/
  );
  assert.match(modalSource, /const nonStatusFieldsDisabled = statusOnlyMode \|\| isSaving/);
  assert.match(modalSource, /statusOnlyUpdate: true/);
  assert.match(modalSource, /This \$\{typeLower\} is Closed\. Only the Status field can be changed\./);
  assert.match(modalSource, /Reopen the \$\{typeLower\} to edit other details\./);
  assert.match(modalSource, /className="bd-status-only-note"/);
  assert.match(cssSource, /\.bd-status-only-note/);

  for (const field of ['name', 'type', 'indication', 'businessImpact', 'comments']) {
    assert.match(
      modalSource,
      new RegExp(`value=\\{form\\.${field}\\}[\\s\\S]*?disabled=\\{nonStatusFieldsDisabled\\}`)
    );
  }
  assert.match(modalSource, /disabled=\{nonStatusFieldsDisabled \|\| !usesStrategy\}/);
  assert.match(modalSource, /disabled=\{nonStatusFieldsDisabled \|\| !hasIndication\}/);

  const statusField = modalSource.match(/<Field label="Status"[\s\S]*?<\/Field>/)?.[0] || '';
  assert.doesNotMatch(statusField, /nonStatusFieldsDisabled/);

  assert.match(
    pageSource,
    /const statusOnlyUpdate = !isCreate && \([\s\S]*?isClosedBarrierDriverStatus\(bdEditState\.record\?\.status\) \|\|[\s\S]*?isKiteDataAdminPreLaunch === true[\s\S]*?\)/
  );
  assert.match(pageSource, /if \(statusOnlyUpdate\)/);
  assert.doesNotMatch(pageSource, /if \(!isCreate && form\.statusOnlyUpdate\)/);
  assert.match(pageSource, /saveBarrierDriverStatus\(bdEditState\.record\.id,\s*form\.status\)/);
  assert.match(pageSource, /if \(!isCreate && isClosedBarrierDriverStatus\(form\.status\) && openActivityCount > 0\)/);
  assert.match(
    pageSource,
    /await saveBarrierDriver\(bdEditState\.record\.id,\s*\{[\s\S]*?\.\.\.formWithPlan,[\s\S]*?previousIndication: bdEditState\.record\.indication \|\| '',[\s\S]*?\}\)/
  );
});

test('Kite Data Admin Pre-launch Driver protection uses status-only CRM writes on every edit surface', async () => {
  const [modalSource, pageSource, overviewSource] = await Promise.all([
    readFile(barrierDriverModalPath, 'utf8'),
    readFile(barriersDriversPagePath, 'utf8'),
    readFile(new URL('../src/pages/Overview/index.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(modalSource, /record\?\.isKiteDataAdminPreLaunch === true/);
  assert.match(pageSource, /bdEditState\.record\?\.isKiteDataAdminPreLaunch === true/);
  assert.match(overviewSource, /bdEditState\.record\.isKiteDataAdminPreLaunch === true/);
  assert.match(overviewSource, /saveBarrierDriverStatus\(bdEditState\.record\.id, form\.status\)/);
});

test('barrier driver modal displays strategy labels without changing option values', async () => {
  const modalSource = await readFile(barrierDriverModalPath, 'utf8');

  assert.match(modalSource, /const strategyLabelForValue = \(picklists, value\) =>/);
  assert.match(modalSource, /value=\{option\}/);
  assert.match(modalSource, /strategyLabelForValue\(picklists,\s*option\)/);
});

test('barrier driver modal displays category labels without changing option values', async () => {
  const modalSource = await readFile(barrierDriverModalPath, 'utf8');

  assert.match(modalSource, /const categoryLabelForValue = \(picklists, value\) =>/);
  assert.match(modalSource, /picklists\?\.categoryLabels/);
  assert.match(modalSource, /categoryLabelForValue\(picklists,\s*value\)/);
  assert.match(modalSource, /value=\{option\.value\}/);
});
