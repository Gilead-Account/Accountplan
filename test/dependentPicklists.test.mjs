import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modulePath = new URL('../src/lib/dataservice/accountPlan/dependentPicklists.js', import.meta.url);
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadModule = async () => {
  const queryStubUrl = dataModule(`
    export const getObjectMetadata = () => Promise.resolve(globalThis.__dependentPicklistMetadata || null);
  `);
  const source = (await readFile(modulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);
  return import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
};

test('dependencyOptionsFromMetadata maps dependent picklist values by controlling indication', async () => {
  const mod = await loadModule();

  const options = mod.dependencyOptionsFromMetadata({
    objectApi: 'KPH_Barriers_and_Tactical_Actions__c',
    fieldApi: 'KPH_Strategy__c',
    controllingFieldApi: 'KPH_Indication__c',
    allOptions: ['DLBCL Strategy', 'MM Strategy', 'Shared Strategy'],
    metadata: {
      data: {
        object: 'KPH_Barriers_and_Tactical_Actions__c',
        fields: [
          {
            name: 'KPH_Indication__c',
            picklistValues: [{ value: 'DLBCL' }, { value: 'MM' }],
          },
          {
            name: 'KPH_Strategy__c',
            controllerName: 'KPH_Indication__c',
            controllerValues: { DLBCL: 0, MM: 1 },
            picklistValues: [
              { value: 'DLBCL Strategy', validFor: ['DLBCL'] },
              { value: 'MM Strategy', validFor: ['MM'] },
              { value: 'Shared Strategy', validFor: ['DLBCL', 'MM'] },
            ],
          },
        ],
      },
    },
  });

  assert.deepEqual(options, {
    DLBCL: ['DLBCL Strategy', 'Shared Strategy'],
    MM: ['MM Strategy', 'Shared Strategy'],
  });
  assert.deepEqual(mod.optionsForControllerValue(options, 'mm'), ['MM Strategy', 'Shared Strategy']);
});

test('fetchDependencyOptionsFromObjectMetadata falls back to hardcoded MM strategy dependency', async () => {
  const mod = await loadModule();
  globalThis.__dependentPicklistMetadata = {
    data: {
      object: 'KPH_Barriers_and_Tactical_Actions__c',
      fields: [
        { name: 'KPH_Indication__c', dataType: 'picklist' },
        { name: 'KPH_Strategy__c', dataType: 'picklist' },
      ],
    },
  };

  const options = await mod.fetchDependencyOptionsFromObjectMetadata({
    objectApi: 'KPH_Barriers_and_Tactical_Actions__c',
    fieldApi: 'KPH_Strategy__c',
    controllingFieldApi: 'KPH_Indication__c',
    allOptions: [
      'Grow Class | Expand Referral Networks',
      'Lead/Grow Brand Share',
      'Expand Class Share',
      'MM Pre-Launch Readiness',
      'MM Pre-Launch Readiness'
    ],
  });

  assert.deepEqual(options, {
    DLBCL: ['Grow Class | Expand Referral Networks'],
    Portfolio: ['Grow Class | Expand Referral Networks'],
    MM: ['Lead/Grow Brand Share', 'Expand Class Share', 'MM Pre-Launch Readiness','MM Pre-Launch Readiness'],
  });
});
