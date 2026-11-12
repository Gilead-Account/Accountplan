import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async ({ failPriorityQuery = false } = {}) => {
  globalThis.__accountPriorityQueries = [];
  globalThis.__accountPriorityFailPriorityQuery = failPriorityQuery;

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__accountPriorityQueries.push(params);
      if (params.object === 'Account') {
        if ((params.fields || []).includes('KPH_MM_ATC_Priority__c')) {
          if (globalThis.__accountPriorityFailPriorityQuery) {
            return Promise.reject(new Error('getFieldLabel error'));
          }
          return Promise.resolve([{
            Id: { value: '0018C00000MAccount' },
            KPH_MM_ATC_Priority__c: { value: 'P1' },
            KPH_Market_Access_Prioritized_Account__c: { value: 'Yes' },
          }]);
        }
        return Promise.resolve([{
          Id: { value: '0018C00000MAccount' },
          Name: { value: 'Mock Cancer Center' },
          EID_GILD__c: { value: '998877' },
          Territory_vod__c: { value: 'US - North Region 4' },
        }]);
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
  return { mod, queries: globalThis.__accountPriorityQueries };
};

test('fetchAccount maps MM ATC Priority from Account in a separate safe query', async () => {
  const { mod, queries } = await loadSharedModule();

  const account = await mod.fetchAccount('0018C00000MAccount');

  assert.equal(account.mmAtcPriority, 'P1');
  assert.equal(account.marketAccessPrioritizedAccount, 'Yes');
  const accountQueries = queries.filter((query) => query.object === 'Account');
  assert.equal(accountQueries.length, 2);
  assert.deepEqual(accountQueries[0].fields, mod.ACCOUNT_FIELDS);
  assert.ok(!accountQueries[0].fields.includes('KPH_MM_ATC_Priority__c'));
  assert.deepEqual(accountQueries[1].fields, [
    'Id',
    'KPH_MM_ATC_Priority__c',
    'KPH_Market_Access_Prioritized_Account__c',
  ]);
});

test('fetchAccount still returns Account details when MM ATC Priority is blocked by FLS', async () => {
  const { mod } = await loadSharedModule({ failPriorityQuery: true });

  const account = await mod.fetchAccount('0018C00000MAccount');

  assert.equal(account.name, 'Mock Cancer Center');
  assert.equal(account.mmAtcPriority, null);
  assert.equal(account.marketAccessPrioritizedAccount, null);
});
