import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__referralSiteNameQueries = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__referralSiteNameQueries.push(params);
      if (params.object === 'KPH_Ecosystem_Map_Dynamics__c') {
        return Promise.resolve([
          {
            Id: { value: 'referral-001' },
            Name: { value: 'ED-1580' },
            Name_of_Site__c: { value: 'UCSF Benioff Childrens Hospital' },
            KPH_Referral_Priority__c: { value: false },
          },
        ]);
      }
      if (params.object === 'KPH_Other_Healthcare_Networks__c') {
        return Promise.resolve([
          {
            Id: { value: 'network-001' },
            Name: { value: 'Fallback Network Name' },
            KPH_Account_Name__c: { value: '0018C00000MNetwork' },
            KPH_Account_Profile__c: { value: 'profile-001' },
            KPH_Kite_Accountable__c: { value: 'Priya Kumar' },
          },
        ]);
      }
      if (params.object === 'KPH_Monthly_Executive_Summary__c') {
        return Promise.resolve([]);
      }
      if (params.object === 'Account') {
        return Promise.resolve([
          {
            Id: { value: '0018C00000MSite1AA' },
            Name: { value: 'UCSF Benioff Childrens Hospital' },
          },
          {
            Id: { value: '0018C00000MNetwork' },
            Name: { value: 'Northern Healthcare Network' },
          },
        ]);
      }
      return Promise.resolve([]);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (record) => {
      if (!record) return null;
      const out = {};
      for (const key of Object.keys(record)) {
        const value = record[key];
        out[key] = value && typeof value === 'object' && 'value' in value ? value.value : value;
      }
      return out;
    };
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

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, queries: globalThis.__referralSiteNameQueries };
};

test('fetchReferralAccounts uses the supported free-text site name without the unavailable lookup field', async () => {
  const { mod, queries } = await loadSharedModule();

  const rows = await mod.fetchReferralAccounts('plan-001', 'profile-001');

  assert.equal(rows[0].name, 'UCSF Benioff Childrens Hospital');
  assert.equal(Object.hasOwn(rows[0], 'siteId'), false);
  assert.equal(Object.hasOwn(rows[0], 'accountProfileId'), false);
  assert.equal(queries.some((query) => query.object === 'Account'), false);
});

test('referral mapping query excludes unavailable and filter-only fields', async () => {
  const { mod, queries } = await loadSharedModule();

  await mod.fetchReferralAccounts('plan-001', 'profile-001');

  const referralQuery = queries.find((query) => query.object === mod.REFERRAL_ACCOUNT_OBJECT);
  assert.ok(referralQuery);
  assert.equal(referralQuery.fields.includes('KPH_Name_of_Site__c'), false);
  assert.ok(referralQuery.fields.includes('Name_of_Site__c'));
  assert.equal(referralQuery.fields.includes('Account_Plan_vod__c'), false);
  assert.equal(referralQuery.fields.includes('KPH_Account_Profile__c'), false);
  assert.equal(referralQuery.fields.includes('KPH_Is_Deleted__c'), false);
  assert.match(referralQuery.where, /Account_Plan_vod__c = 'plan-001'/);
  assert.match(referralQuery.where, /KPH_Account_Profile__c = 'profile-001'/);
});

test('fetchAccountProfileChildRecords resolves referral and healthcare names with one Account lookup', async () => {
  const { mod, queries } = await loadSharedModule();

  const result = await mod.fetchAccountProfileChildRecords('plan-001', 'profile-001');

  assert.equal(result.referralAccounts[0].name, 'UCSF Benioff Childrens Hospital');
  assert.equal(result.healthcareNetworks[0].accountName, 'Northern Healthcare Network');
  const accountQueries = queries.filter((query) => query.object === 'Account');
  assert.equal(accountQueries.length, 1);
  assert.doesNotMatch(accountQueries[0].where, /0018C00000MSite1AA/);
  assert.match(accountQueries[0].where, /0018C00000MNetwork/);
});
