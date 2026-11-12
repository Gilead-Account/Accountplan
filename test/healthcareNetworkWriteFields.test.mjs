import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__healthcareNetworkMutationCalls = [];
  globalThis.__healthcareNetworkQueries = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__healthcareNetworkQueries.push(params);
      if (params.object === 'KPH_Other_Healthcare_Networks__c') {
        return Promise.resolve([
          {
            Id: 'network-row-001',
            Name: 'HN-001',
            KPH_Account_Name__c: '0018C00000NetworkAA',
            KPH_Account_Profile__c: 'profile-001',
            KPH_Kite_Accountable__c: 'James Chen',
          },
        ]);
      }
      if (params.object === 'Account') {
        return Promise.resolve([
          {
            Id: '0018C00000NetworkAA',
            Name: 'Northern Regional Network',
          },
        ]);
      }
      return Promise.resolve([]);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__healthcareNetworkMutationCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ id: 'new-healthcare-network-id' });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__healthcareNetworkMutationCalls.push({ type: 'update', object, id, fields });
      return Promise.resolve({ id });
    };
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule('export const normalizeCrmBoolean = (value) => Boolean(value);');

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__healthcareNetworkMutationCalls, queries: globalThis.__healthcareNetworkQueries };
};

test('healthcare network field list does not request missing Mobile_ID_vod__c', async () => {
  const { mod } = await loadSharedModule();

  assert.ok(!mod.HEALTHCARE_NETWORK_FIELDS.includes('Mobile_ID_vod__c'));
});

test('healthcare network table filters by Account Profile and queries account names by Account Id', async () => {
  const { mod, queries } = await loadSharedModule();

  const rows = await mod.fetchHealthcareNetworks('profile-001');

  assert.equal(rows[0].accountId, '0018C00000NetworkAA');
  assert.equal(rows[0].accountName, 'Northern Regional Network');
  assert.equal(Object.hasOwn(rows[0], 'accountProfileId'), false);

  const networkQuery = queries.find((query) => query.object === mod.HEALTHCARE_NETWORK_OBJECT);
  assert.ok(networkQuery);
  assert.deepEqual(networkQuery.fields, [
    'Id',
    'Name',
    'KPH_Account_Name__c',
    'KPH_Kite_Accountable__c',
  ]);
  assert.doesNotMatch(networkQuery.where, /KPH_Account_Name__c/);
  assert.match(networkQuery.where, /KPH_Account_Profile__c = 'profile-001'/);

  const accountQuery = queries.find((query) => query.object === 'Account');
  assert.ok(accountQuery);
  assert.deepEqual(accountQuery.fields, ['Id', 'Name']);
  assert.match(accountQuery.where, /Id = '0018C00000NetworkAA'/);
});

test('createHealthcareNetwork maps Account Profile lookup and omits missing Mobile_ID_vod__c field', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.createHealthcareNetwork('profile-001', {
    accountId: '0018C00000NetworkAA',
    kiteAccountable: 'James Chen',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'create');
  assert.equal(calls[0].object, mod.HEALTHCARE_NETWORK_OBJECT);
  assert.equal(calls[0].fields.KPH_Account_Name__c, '0018C00000NetworkAA');
  assert.equal(calls[0].fields.KPH_Account_Profile__c, 'profile-001');
  assert.equal(calls[0].fields.KPH_Kite_Accountable__c, 'James Chen');
  assert.ok(!Object.hasOwn(calls[0].fields, 'Mobile_ID_vod__c'));
});
