import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__referralMutationCalls = [];

  const queryStubUrl = dataModule(`
    export const runQuery = () => Promise.resolve([]);
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__referralMutationCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ id: 'new-referral-id' });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__referralMutationCalls.push({ type: 'update', object, id, fields });
      return Promise.resolve({ id });
    };
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule('export const normalizeCrmBoolean = (value) => Boolean(value);');

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const moduleUrl = `${dataModule(source)}#${Date.now()}-${Math.random()}`;
  const mod = await import(moduleUrl);

  return { mod, calls: globalThis.__referralMutationCalls };
};

test('updateReferralAccount omits read-only HCO classification from write fields', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateReferralAccount('referral-001', {
    name: 'UCSF Benioff Childrens Hospital',
    siteId: '0018C00000MSite1AA',
    hcoClassification: 'Community Oncology',
    hcpTargetCount: '4',
    referralPriority: true,
    indication: 'DLBCL',
    comments: 'Keep this comment',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.REFERRAL_ACCOUNT_OBJECT);
  assert.equal(Object.hasOwn(calls[0].fields, 'KPH_HCO_Classification__c'), false);
  assert.equal(Object.hasOwn(calls[0].fields, 'KPH_Name_of_Site__c'), false);
  assert.equal(calls[0].fields.Name_of_Site__c, 'UCSF Benioff Childrens Hospital');
  assert.equal(calls[0].fields.KPH_of_HCP_Targets_within_a_Site__c, 4);
});

test('createReferralAccount maps Account Profile lookup and omits read-only HCO classification from write fields', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.createReferralAccount('plan-001', 'profile-001', {
    name: 'Northern Oncology Associates',
    siteId: '0018C00000MSite2AA',
    hcoClassification: 'Academic Affiliate',
    hcpTargetCount: 2,
    referralPriority: false,
    indication: 'MM',
    comments: 'New site',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'create');
  assert.equal(calls[0].object, mod.REFERRAL_ACCOUNT_OBJECT);
  assert.equal(calls[0].fields.Account_Plan_vod__c, 'plan-001');
  assert.equal(calls[0].fields.KPH_Account_Profile__c, 'profile-001');
  assert.equal(Object.hasOwn(calls[0].fields, 'KPH_HCO_Classification__c'), false);
  assert.equal(Object.hasOwn(calls[0].fields, 'KPH_Name_of_Site__c'), false);
  assert.equal(calls[0].fields.Name_of_Site__c, 'Northern Oncology Associates');
  assert.equal(calls[0].fields.KPH_of_HCP_Targets_within_a_Site__c, 2);
});
