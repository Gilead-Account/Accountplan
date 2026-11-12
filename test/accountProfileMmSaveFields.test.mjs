import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__accountProfileMutationCalls = [];

  const queryStubUrl = dataModule(`
    export const runQuery = () => Promise.resolve([]);
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({ id: 'new-record-id' });
    export const updateRecord = (object, id, fields) => {
      globalThis.__accountProfileMutationCalls.push({ object, id, fields });
      return Promise.resolve({ id });
    };
  `);
  const clientStubUrl = dataModule('export const isOnline = () => false;');
  const utilsStubUrl = dataModule(`
    export const normalizeCrmBoolean = (value) => value === true || value === 1 || value === '1';
  `);

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__accountProfileMutationCalls };
};

test('updateAccountProfileField saves Projected Anito-Cel Demand as a CRM number', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateAccountProfileField(
    'ecosystem-profile-001',
    mod.MM_PROFILE_FIELD_API_NAMES.projectedAnitoCelDemand,
    '123'
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].object, mod.ACCOUNT_PROFILE_OBJECT);
  assert.deepEqual(calls[0].fields, {
    KPH_Projected_Anito_cel_Demand__c: 123,
  });
  assert.equal(typeof calls[0].fields.KPH_Projected_Anito_cel_Demand__c, 'number');
});

test('updateAccountProfileField keeps non-number MM fields as text', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateAccountProfileField(
    'ecosystem-profile-001',
    mod.MM_PROFILE_FIELD_API_NAMES.perceptionOfAnitoCel,
    'Positive'
  );

  assert.deepEqual(calls[0].fields, {
    KPH_Perception_of_Anito_cel__c: 'Positive',
  });
});

test('updateAccountProfileField writes Pre-Formulary Exception Pathway to its exact CRM field', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateAccountProfileField(
    'ecosystem-profile-001',
    mod.MM_PROFILE_FIELD_API_NAMES.preFormularyExceptionPathway,
    'Use the medical-necessity exception pathway while review is pending.'
  );

  assert.deepEqual(calls[0], {
    object: 'KPH_Ecosystem_Plan__c',
    id: 'ecosystem-profile-001',
    fields: {
      KPH_Pre_Formulary_Exception_Pathway__c:
        'Use the medical-necessity exception pathway while review is pending.',
    },
  });
});
