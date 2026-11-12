import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const queryModulePath = new URL('../src/lib/dataservice/query.js', import.meta.url);

const loadQueryModule = async () => {
  globalThis.__coalescedRunQueryCalls = [];
  globalThis.__coalescedPicklistCalls = [];
  globalThis.__resolveRunQuery = null;
  globalThis.__resolvePicklist = null;

  const clientStubUrl = dataModule(`
    export const ds = {
      runQuery(params) {
        globalThis.__coalescedRunQueryCalls.push(params);
        return new Promise((resolve) => {
          globalThis.__resolveRunQuery = resolve;
        });
      },
      getDataForCurrentObject() {
        return Promise.resolve({});
      },
      getPicklistValueLabels(object, field) {
        globalThis.__coalescedPicklistCalls.push({ object, field });
        return new Promise((resolve) => {
          globalThis.__resolvePicklist = resolve;
        });
      },
    };
    export const isOnline = () => false;
  `);
  const source = (await readFile(queryModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`);
  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return {
    mod,
    runQueryCalls: globalThis.__coalescedRunQueryCalls,
    picklistCalls: globalThis.__coalescedPicklistCalls,
  };
};

test('runQuery shares identical in-flight CRM reads without caching settled results', async () => {
  const { mod, runQueryCalls } = await loadQueryModule();
  const params = {
    object: 'KPH_Barriers_and_Tactical_Actions__c',
    fields: ['Id', 'Name'],
    where: "KPH_Account_Plan__c = 'plan-001'",
  };

  const first = mod.runQuery(params);
  const second = mod.runQuery(params);
  assert.equal(runQueryCalls.length, 1);

  globalThis.__resolveRunQuery({ data: [{ Id: 'bd-001' }] });
  assert.deepEqual(await first, [{ Id: 'bd-001' }]);
  assert.deepEqual(await second, [{ Id: 'bd-001' }]);

  const third = mod.runQuery(params);
  assert.equal(runQueryCalls.length, 2);
  globalThis.__resolveRunQuery({ data: [{ Id: 'bd-002' }] });
  assert.deepEqual(await third, [{ Id: 'bd-002' }]);
});

test('getPicklistValueLabels shares identical in-flight metadata reads', async () => {
  const { mod, picklistCalls } = await loadQueryModule();

  const first = mod.getPicklistValueLabels('Account_Team_Member_vod__c', 'KPH_Participation__c');
  const second = mod.getPicklistValueLabels('Account_Team_Member_vod__c', 'KPH_Participation__c');
  assert.equal(picklistCalls.length, 1);

  globalThis.__resolvePicklist({
    Account_Team_Member_vod__c: {
      KPH_Participation__c: { Core: 'Core' },
    },
  });

  assert.deepEqual(await first, { Core: 'Core' });
  assert.deepEqual(await second, { Core: 'Core' });
});
