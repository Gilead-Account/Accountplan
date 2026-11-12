import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  const queryStubUrl = dataModule(`
    export const runQuery = () => Promise.resolve([]);
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({});
    export const updateRecord = () => Promise.resolve({});
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule('export const normalizeCrmBoolean = (value) => Boolean(value);');

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  return import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
};

test('account profile query maps regional dynamics to the exact CRM fields once', async () => {
  const mod = await loadSharedModule();

  assert.equal(
    mod.ACCOUNT_PROFILE_FIELDS.filter((field) => field === 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c').length,
    1
  );
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_Region_Dynamics_To_Be_Aware_Of_DLBCL__c'), false);
  assert.equal(
    mod.ACCOUNT_PROFILE_FIELDS.filter((field) => field === 'KPH_Region_Dynamics_to_be_Aware_of_MM__c').length,
    1
  );
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_Region_Dynamics_To_Be_Aware_Of_MM__c'), false);
});

test('account profile query excludes unused fields', async () => {
  const mod = await loadSharedModule();

  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('Name'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('CreatedDate'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('LastModifiedDate'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_Account_Plan__c'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_Name_of_the_Site__c'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_Name_of_the_Site__r.Name'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_KAD_Target_List__c'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_MM_Q_vs_Q_CART_Volume_Trend__c'), false);
  assert.equal(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_MM_ATC_Segment_Q3_2025__c'), false);
  assert.ok(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_ATC_Cohort__c'));
  assert.ok(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_ATC_Share_of_Business_R6M_1Q_Lag__c'));
  assert.ok(mod.ACCOUNT_PROFILE_FIELDS.includes('KPH_Payer_Mix__c'));
  assert.equal(
    mod.ACCOUNT_PROFILE_FIELDS.filter((field) => field === 'KPH_Payer_Mix__c').length,
    1
  );
  assert.equal(new Set(mod.ACCOUNT_PROFILE_FIELDS).size, mod.ACCOUNT_PROFILE_FIELDS.length);
});

test('toAccountProfile uses only the supported DLBCL ATC Segment field', async () => {
  const mod = await loadSharedModule();

  const profile = mod.toAccountProfile({
    Id: 'profile-001',
    KPH_ATC_Share_of_Business_R6M_1Q_Lag__c: 'Inpatient and Outpatient',
    KPH_MM_ATC_Segment_Q3_2025__c: 'Retired fallback value',
  });
  const retiredFallbackOnly = mod.toAccountProfile({
    Id: 'profile-002',
    KPH_MM_ATC_Segment_Q3_2025__c: 'Retired fallback value',
  });

  assert.equal(profile.atcSegment, 'Inpatient and Outpatient');
  assert.equal(retiredFallbackOnly.atcSegment, null);
});

test('toAccountProfile saves DLBCL regional edits back to the exact CRM field', async () => {
  const mod = await loadSharedModule();

  const profile = mod.toAccountProfile({
    Id: 'profile-001',
    KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c: 'Existing DLBCL notes',
  });

  assert.equal(profile.regionDynamicsDlbcl, 'Existing DLBCL notes');
  assert.equal(profile.regionDynamicsDlbclField, 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c');
});

test('toAccountProfile defaults blank DLBCL regional edits to the exact CRM field', async () => {
  const mod = await loadSharedModule();

  const profile = mod.toAccountProfile({
    Id: 'profile-001',
    KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c: '',
  });

  assert.equal(profile.regionDynamicsDlbcl, null);
  assert.equal(profile.regionDynamicsDlbclField, 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c');
});
