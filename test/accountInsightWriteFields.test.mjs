import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async ({ accountInsightRows = [], userRows = [] } = {}) => {
  globalThis.__accountInsightMutationCalls = [];
  globalThis.__accountInsightQueries = [];
  globalThis.__accountInsightRows = accountInsightRows;
  globalThis.__accountInsightUserRows = userRows;

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__accountInsightQueries.push(params);
      if (params.object === 'KPH_Monthly_Executive_Summary__c') {
        return Promise.resolve(globalThis.__accountInsightRows || []);
      }
      if (params.object === 'User') {
        return Promise.resolve(globalThis.__accountInsightUserRows || []);
      }
      return Promise.resolve([]);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__accountInsightMutationCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ id: 'new-account-insight-id' });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__accountInsightMutationCalls.push({ type: 'update', object, id, fields });
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
  return { mod, calls: globalThis.__accountInsightMutationCalls };
};

test('updateAccountInsight writes editable insight and indication fields', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateAccountInsight('insight-001', {
    insightText: ' Updated best practice ',
    indication: 'DLBCL',
    insightDate: '2026-03-31',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.ACCOUNT_INSIGHT_OBJECT);
  assert.equal(calls[0].fields.KPH_Best_Practices_Key_Learnings_Insight__c, 'Updated best practice');
  assert.equal(calls[0].fields.Indication__c, 'DLBCL');
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_Created_Date__c'));
});

test('createAccountInsight maps insight text and Account Profile lookup without writing created date', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.createAccountInsight('plan-001', 'profile-001', {
    insightText: 'New key learning',
    indication: 'MM',
    insightDate: '2026-03-31',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'create');
  assert.equal(calls[0].object, mod.ACCOUNT_INSIGHT_OBJECT);
  assert.equal(calls[0].fields.KPH_Account_Plan__c, 'plan-001');
  assert.equal(calls[0].fields.KPH_Account_Profile__c, 'profile-001');
  assert.equal(calls[0].fields.KPH_Best_Practices_Key_Learnings_Insight__c, 'New key learning');
  assert.equal(calls[0].fields.Indication__c, 'MM');
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_Created_Date__c'));
});

test('fetchAccountInsights resolves CreatedById through User.Name', async () => {
  const userId = '0058C00000UserAAA';
  const { mod } = await loadSharedModule({
    accountInsightRows: [
      {
        Id: 'insight-001',
        Name: 'AI-001',
        CreatedDate: '2026-05-28T10:00:00Z',
        CreatedById: userId,
        LastModifiedDate: '2026-05-28T11:00:00Z',
        KPH_Account_Plan__c: 'plan-001',
        KPH_Account_Profile__c: 'profile-001',
        Indication__c: 'DLBCL',
        KPH_Best_Practices_Key_Learnings_Insight__c: 'Follow up on outpatient CAR-T criteria.',
        KPH_Created_Date__c: '2026-05-28',
      },
    ],
    userRows: [
      {
        Id: userId,
        Name: 'Priya Kumar',
      },
    ],
  });

  const rows = await mod.fetchAccountInsights('plan-001', 'profile-001');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].indication, 'DLBCL');
  assert.equal(rows[0].createdById, userId);
  assert.equal(rows[0].createdBy, 'Priya Kumar');
  const insightQuery = globalThis.__accountInsightQueries.find(
    (query) => query.object === mod.ACCOUNT_INSIGHT_OBJECT
  );
  assert.ok(insightQuery);
  assert.doesNotMatch(insightQuery.where, /KPH_Account_Plan__c/);
  assert.match(insightQuery.where, /KPH_Account_Profile__c = 'profile-001'/);
  assert.deepEqual(insightQuery.fields, [
    'Id',
    'Name',
    'CreatedDate',
    'CreatedById',
    'Indication__c',
    'KPH_Best_Practices_Key_Learnings_Insight__c',
    'KPH_Created_Date__c',
  ]);
  assert.deepEqual(insightQuery.sort, ['LastModifiedDate DESC', 'Name ASC']);
  const userQuery = globalThis.__accountInsightQueries.find((query) => query.object === 'User');
  assert.ok(userQuery);
  assert.deepEqual(userQuery.fields, ['Id', 'Name']);
  assert.match(userQuery.where, new RegExp(userId));
});
