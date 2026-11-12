import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const stakeholdersModulePath = new URL('../src/lib/dataservice/accountPlan/stakeholders.js', import.meta.url);
const stakeholdersPagePath = new URL('../src/pages/Stakeholders/index.jsx', import.meta.url);
const stakeholderModalPath = new URL('../src/pages/Stakeholders/StakeholderEditModal.jsx', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__stakeholderLookupQueries = [];
  globalThis.__stakeholderLookupUpdates = [];
  globalThis.__stakeholderLookupCreates = [];
  globalThis.__stakeholderAccountRows = [
    {
      Id: '0038C00000MockHcp1',
      Name: 'ELENA MARTIN',
      EID_GILD__c: '118822',
      Account_Identifier_vod__c: 'ALT-118822',
      Territory_vod__c: 'Upstate NY',
      Account_Type__c: 'HCP',
    },
    {
      Id: '0038C00000OtherHcp',
      Name: 'Marcus Lin',
      EID_GILD__c: '118899',
      Account_Identifier_vod__c: 'ALT-118899',
      Territory_vod__c: 'Upstate NY',
      Account_Type__c: 'HCP',
    },
  ];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__stakeholderLookupQueries.push(params);
      return Promise.resolve(globalThis.__stakeholderAccountRows);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => row || null;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__stakeholderLookupCreates.push({ object, fields });
      return Promise.resolve({ data: { id: 'new-stakeholder-id' } });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__stakeholderLookupUpdates.push({ object, id, fields });
      return Promise.resolve({ data: { id } });
    };
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule(
    'export const normalizeCrmBoolean = (value) => Boolean(value);'
  );

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return {
    mod,
    queries: globalThis.__stakeholderLookupQueries,
    updates: globalThis.__stakeholderLookupUpdates,
    creates: globalThis.__stakeholderLookupCreates,
  };
};

const defaultStakeholderPicklistLabels = {
  KPH_Stakeholder_Map__c: {
    KPH_Title__c: {
      'Cell Therapy Director': 'Cell Therapy Director',
      'Pharmacy Director': 'Pharmacy Director',
    },
    KPH_DLBCL_Clinical_Influence__c: {
      Champion: 'Champion',
    },
    KPH_DLBCL_Financial_Influence__c: {
      Neutral: 'Neutral',
    },
    KPH_DLBCL_Operational_Influence__c: {
      Resistant: 'Resistant',
    },
    KPH_MM_Clinical_Influence__c: {
      'MM Champion': 'MM Champion',
    },
    KPH_MM_Financial_Influence__c: {
      'MM Neutral': 'MM Neutral',
    },
    KPH_MM_Operational_Influence__c: {
      'MM Resistant': 'MM Resistant',
    },
    KPH_Priority__c: {
      P1: 'P1',
    },
    KPH_Estimated_Annual_RRMM_Treatment_Vol__c: {
      '0-5': '0-5',
      '6-10': '6-10',
    },
    Physician_Identified_Highest_Unmet_Needs__c: {
      'Access to treatment': 'Access to treatment',
      'Earlier-line options': 'Earlier-line options',
    },
    MM_Priority__c: {
      P2: 'P2',
    },
  },
};

const defaultStakeholderRows = [
  {
    id: 'stk-001',
    name: 'Elena Martin',
    role: 'Legacy Role',
    dlbclClinicalInfluence: 'Legacy Influence',
    mmClinicalInfluence: 'Legacy MM Influence',
    dlbclPriority: 'Legacy Priority',
    estimatedAnnualRrmmTreatmentVolume: '11-20',
    physicianIdentifiedHighestUnmetNeedsRrmm: ['Care coordination'],
  },
];

const loadStakeholdersModule = async ({
  picklistLabels = defaultStakeholderPicklistLabels,
  stakeholderRows = defaultStakeholderRows,
} = {}) => {
  globalThis.__stakeholderPicklistCalls = [];
  globalThis.__stakeholderPicklistLabels = picklistLabels;
  globalThis.__stakeholderRows = stakeholderRows;

  const sharedStubUrl = dataModule(`
    export const createStakeholder = () => Promise.resolve({});
    export const deleteStakeholder = () => Promise.resolve({});
    export const fetchStakeholders = () => Promise.resolve(globalThis.__stakeholderRows);
    export const requireCurrentAccountPlanId = () => Promise.resolve('plan-001');
    export const resolveShellContextForPlanId = () => Promise.resolve({
      planId: 'plan-001',
      plan: { id: 'plan-001' },
      account: { id: 'account-001' },
    });
    export const resolveShellContext = resolveShellContextForPlanId;
    export const searchSiteAccounts = () => Promise.resolve([]);
    export const searchStakeholderAccounts = () => Promise.resolve([]);
    export const updateStakeholder = () => Promise.resolve({});
  `);
  const queryStubUrl = dataModule(`
    export const getPicklistValueLabels = (object, field) => {
      globalThis.__stakeholderPicklistCalls.push({ object, field });
      return Promise.resolve(
        (globalThis.__stakeholderPicklistLabels[object] &&
          globalThis.__stakeholderPicklistLabels[object][field]) ||
        {}
      );
    };
  `);

  const source = (await readFile(stakeholdersModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/shared['"]/g, `from '${sharedStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__stakeholderPicklistCalls };
};

test('searchStakeholderAccounts queries Account records and exposes EID for autofill', async () => {
  const { mod, queries } = await loadSharedModule();

  const rows = await mod.searchStakeholderAccounts('elena', 60);

  assert.equal(queries[0].object, 'Account');
  assert.ok(queries[0].fields.includes('EID_GILD__c'));
  assert.equal(queries[0].fields.includes('RecordTypeId'), false);
  assert.equal(queries[0].fields.includes('IsPersonAccount'), false);
  assert.equal(queries[0].fields.includes('Type'), false);
  assert.equal(queries[0].fields.includes('Account_Type__c'), false);
  assert.match(queries[0].where, /IsPersonAccount\s*=\s*true/);
  assert.match(queries[0].where, /Name LIKE '%elena%'/);
  assert.match(queries[0].where, /Name LIKE '%ELENA%'/);
  assert.deepEqual(rows, [
    {
      id: '0038C00000MockHcp1',
      name: 'ELENA MARTIN',
      accountIdentifier: 'ALT-118822',
      eid: '118822',
      territory: 'Upstate NY',
    },
  ]);
});

test('searchStakeholderAccounts keeps blank stakeholder lookup restricted to person accounts', async () => {
  const { mod, queries } = await loadSharedModule();

  await mod.searchStakeholderAccounts('', 60);

  assert.equal(queries[0].object, 'Account');
  assert.match(queries[0].where, /IsPersonAccount\s*=\s*true/);
  assert.doesNotMatch(queries[0].where, /Name LIKE/);
});

test('stakeholder update omits hidden Champion fields and writes remaining editable values', async () => {
  const { mod, updates } = await loadSharedModule();

  await mod.updateStakeholder('stk-001', {
    name: 'Elena Martin',
    profileRecordId: '0038C00000MockHcp1',
    stakeholderId: '118822',
    primaryParent: 'Northern Oncology Associates',
    role: 'Cell Therapy Director',
    dlbclAdministrativeChampion: true,
    dlbclClinicalChampion: false,
    mmAdministrativeChampion: true,
    mmClinicalChampion: false,
    estimatedAnnualRrmmTreatmentVolume: '6-10',
    physicianIdentifiedHighestUnmetNeedsRrmm: ['Access to treatment', 'Earlier-line options'],
  });

  assert.equal(updates[0].object, 'KPH_Stakeholder_Map__c');
  assert.equal(updates[0].fields.KPH_Account__c, '0038C00000MockHcp1');
  assert.equal(updates[0].fields.KPH_Title__c, 'Cell Therapy Director');
  assert.equal(Object.hasOwn(updates[0].fields, 'KPH_DLBCL_Administrative_Champion__c'), false);
  assert.equal(Object.hasOwn(updates[0].fields, 'KPH_DLBCL_Clinical_Champion__c'), false);
  assert.equal(Object.hasOwn(updates[0].fields, 'KPH_MM_Administrative_Champion__c'), false);
  assert.equal(Object.hasOwn(updates[0].fields, 'KPH_MM_Clinical_Champion__c'), false);
  assert.equal(updates[0].fields.KPH_Estimated_Annual_RRMM_Treatment_Vol__c, '6-10');
  assert.equal(
    updates[0].fields.Physician_Identified_Highest_Unmet_Needs__c,
    'Access to treatment;Earlier-line options'
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_First_Name__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_Last_Name__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'Stakeholder_EID__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_Name_Of_Site2__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_Priority__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_Current_Target__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(updates[0].fields, 'KPH_HCP_Classification__c'));
});

test('stakeholder create omits hidden Champion fields and derived fields Salesforce rejects', async () => {
  const { mod, creates } = await loadSharedModule();

  await mod.createStakeholder('plan-001', {
    name: 'Elena Martin',
    profileRecordId: '0038C00000MockHcp1',
    stakeholderId: '118822',
    primaryParent: 'Northern Oncology Associates',
    role: 'Cell Therapy Director',
    dlbclPriority: 'P1',
    dlbclCurrentTarget: 'Yes',
    dlbclHcpClassification: 'Decision Maker',
    dlbclClinicalInfluence: 'High',
    dlbclAdministrativeChampion: false,
    dlbclClinicalChampion: true,
    mmAdministrativeChampion: false,
    mmClinicalChampion: true,
    estimatedAnnualRrmmTreatmentVolume: '0-5',
    physicianIdentifiedHighestUnmetNeedsRrmm: ['Access to treatment'],
  });

  assert.equal(creates[0].object, 'KPH_Stakeholder_Map__c');
  assert.equal(creates[0].fields.KPH_Account_Plan__c, 'plan-001');
  assert.equal(creates[0].fields.KPH_Account__c, '0038C00000MockHcp1');
  assert.equal(creates[0].fields.KPH_Title__c, 'Cell Therapy Director');
  assert.equal(creates[0].fields.KPH_DLBCL_Clinical_Influence__c, 'High');
  assert.equal(Object.hasOwn(creates[0].fields, 'KPH_DLBCL_Administrative_Champion__c'), false);
  assert.equal(Object.hasOwn(creates[0].fields, 'KPH_DLBCL_Clinical_Champion__c'), false);
  assert.equal(Object.hasOwn(creates[0].fields, 'KPH_MM_Administrative_Champion__c'), false);
  assert.equal(Object.hasOwn(creates[0].fields, 'KPH_MM_Clinical_Champion__c'), false);
  assert.equal(creates[0].fields.KPH_Estimated_Annual_RRMM_Treatment_Vol__c, '0-5');
  assert.equal(
    creates[0].fields.Physician_Identified_Highest_Unmet_Needs__c,
    'Access to treatment'
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_First_Name__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_Last_Name__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'Stakeholder_EID__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_Name_Of_Site2__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_Priority__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_Current_Target__c'));
  assert.ok(!Object.prototype.hasOwnProperty.call(creates[0].fields, 'KPH_HCP_Classification__c'));
});

test('stakeholder Champion fields are excluded from CRM reads and mapped UI data', async () => {
  const { mod } = await loadSharedModule();

  const stakeholder = mod.toStakeholder({
    Id: 'stk-001',
    Name: 'Elena Martin',
    KPH_DLBCL_Administrative_Champion__c: true,
    KPH_DLBCL_Clinical_Champion__c: false,
    KPH_MM_Administrative_Champion__c: 1,
    KPH_MM_Clinical_Champion__c: 0,
  });

  assert.equal(Object.hasOwn(stakeholder, 'dlbclAdministrativeChampion'), false);
  assert.equal(Object.hasOwn(stakeholder, 'dlbclClinicalChampion'), false);
  assert.equal(Object.hasOwn(stakeholder, 'mmAdministrativeChampion'), false);
  assert.equal(Object.hasOwn(stakeholder, 'mmClinicalChampion'), false);
  assert.equal(mod.STAKEHOLDER_FIELDS.includes('KPH_DLBCL_Administrative_Champion__c'), false);
  assert.equal(mod.STAKEHOLDER_FIELDS.includes('KPH_DLBCL_Clinical_Champion__c'), false);
  assert.equal(mod.STAKEHOLDER_FIELDS.includes('KPH_MM_Administrative_Champion__c'), false);
  assert.equal(mod.STAKEHOLDER_FIELDS.includes('KPH_MM_Clinical_Champion__c'), false);
});

test('stakeholder RRMM profile fields map from CRM and split multi-select values', async () => {
  const { mod } = await loadSharedModule();

  const stakeholder = mod.toStakeholder({
    Id: 'stk-001',
    KPH_Estimated_Annual_RRMM_Treatment_Vol__c: '6-10',
    Physician_Identified_Highest_Unmet_Needs__c:
      'Access to treatment; Earlier-line options;;',
  });

  assert.equal(stakeholder.estimatedAnnualRrmmTreatmentVolume, '6-10');
  assert.deepEqual(stakeholder.physicianIdentifiedHighestUnmetNeedsRrmm, [
    'Access to treatment',
    'Earlier-line options',
  ]);
  assert.ok(mod.STAKEHOLDER_FIELDS.includes('KPH_Estimated_Annual_RRMM_Treatment_Vol__c'));
  assert.ok(mod.STAKEHOLDER_FIELDS.includes('Physician_Identified_Highest_Unmet_Needs__c'));
});

test('loadStakeholders keeps global role options limited to CRM picklist metadata', async () => {
  const { mod, calls } = await loadStakeholdersModule();

  const data = await mod.loadStakeholders();

  assert.ok(calls.some((call) =>
    call.object === 'KPH_Stakeholder_Map__c' && call.field === 'KPH_Title__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Stakeholder_Map__c' && call.field === 'KPH_DLBCL_Clinical_Influence__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Stakeholder_Map__c' && call.field === 'KPH_MM_Clinical_Influence__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Stakeholder_Map__c' &&
    call.field === 'KPH_Estimated_Annual_RRMM_Treatment_Vol__c'
  ));
  assert.ok(calls.some((call) =>
    call.object === 'KPH_Stakeholder_Map__c' &&
    call.field === 'Physician_Identified_Highest_Unmet_Needs__c'
  ));
  assert.deepEqual(data.picklists.roleOptions, [
    'Cell Therapy Director',
    'Pharmacy Director',
  ]);
  assert.equal(data.stakeholders[0].role, 'Legacy Role');
  assert.deepEqual(data.picklists.influenceOptions, [
    'Champion',
    'Neutral',
    'Resistant',
    'MM Champion',
    'MM Neutral',
    'MM Resistant',
    'Legacy Influence',
    'Legacy MM Influence',
  ]);
  assert.deepEqual(data.picklists.estimatedAnnualRrmmTreatmentVolumeOptions, [
    '0-5',
    '6-10',
    '11-20',
  ]);
  assert.deepEqual(data.picklists.physicianIdentifiedHighestUnmetNeedsOptions, [
    'Access to treatment',
    'Earlier-line options',
    'Care coordination',
  ]);
});

test('loadStakeholders does not inject static modal picklist fallbacks when CRM metadata is empty', async () => {
  const { mod } = await loadStakeholdersModule({
    picklistLabels: { KPH_Stakeholder_Map__c: {} },
    stakeholderRows: [],
  });

  const data = await mod.loadStakeholders();

  assert.deepEqual(data.picklists.roleOptions, []);
  assert.deepEqual(data.picklists.influenceOptions, []);
  assert.deepEqual(data.picklists.priorityOptions, []);
  assert.deepEqual(data.picklists.estimatedAnnualRrmmTreatmentVolumeOptions, []);
  assert.deepEqual(data.picklists.physicianIdentifiedHighestUnmetNeedsOptions, []);
});

test('stakeholder popup is wired to Account lookup fields and role picklist props', async () => {
  const loaderSource = await readFile(stakeholdersModulePath, 'utf8');
  const pageSource = await readFile(stakeholdersPagePath, 'utf8');
  const modalSource = await readFile(stakeholderModalPath, 'utf8');

  assert.doesNotMatch(loaderSource, /FALLBACK_PICKLISTS/);
  assert.doesNotMatch(loaderSource, /\['High', 'Medium', 'Low'\]/);
  assert.doesNotMatch(loaderSource, /\['P1', 'P2', 'P3'\]/);
  assert.match(pageSource, /searchStakeholderAccounts/);
  assert.match(pageSource, /searchSiteAccounts/);
  assert.match(pageSource, /influenceOptions=\{picklists\.influenceOptions \|\| \[\]\}/);
  assert.match(pageSource, /roleOptions=\{picklists\.roleOptions \|\| \[\]\}/);
  assert.match(
    pageSource,
    /estimatedAnnualRrmmTreatmentVolumeOptions=\{[\s\S]*?picklists\.estimatedAnnualRrmmTreatmentVolumeOptions \|\| \[\][\s\S]*?\}/
  );
  assert.match(
    pageSource,
    /physicianIdentifiedHighestUnmetNeedsOptions=\{[\s\S]*?picklists\.physicianIdentifiedHighestUnmetNeedsOptions \|\| \[\][\s\S]*?\}/
  );
  assert.match(modalSource, /AccountLookupField/);
  assert.match(modalSource, /label="Stakeholder Name"/);
  assert.match(modalSource, /label="Name Of Site"/);
  assert.match(modalSource, /updateStakeholderQuery/);
  assert.match(modalSource, /selectStakeholderAccount/);
  assert.match(modalSource, /selectSiteAccount/);
  assert.match(modalSource, /field\.type === 'select' \? mergeOptions\(form\[field\.key\], influenceOptions\) : \[\]/);
  assert.match(modalSource, /\{ label: 'Name Of Site', key: 'primaryParent', readOnly: true/);
  assert.doesNotMatch(modalSource, /field\.readOnly && !isNew/);
});

test('stakeholder add lookup excludes Accounts already present as stakeholders', async () => {
  const pageSource = await readFile(stakeholdersPagePath, 'utf8');
  const modalSource = await readFile(stakeholderModalPath, 'utf8');

  assert.match(pageSource, /excludedStakeholderAccountIds/);
  assert.match(pageSource, /profileRecordId/);
  assert.match(pageSource, /excludedStakeholderAccountIds=\{excludedStakeholderAccountIds\}/);
  assert.match(modalSource, /excludedStakeholderAccountIds = \[\]/);
  assert.match(modalSource, /excludedStakeholderAccountIdSet/);
  assert.match(modalSource, /filteredStakeholderSearch/);
  assert.match(modalSource, /account\.id/);
  assert.match(modalSource, /searchAccounts=\{filteredStakeholderSearch\}/);
});
