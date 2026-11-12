import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const queryModulePath = new URL('../src/lib/dataservice/query.js', import.meta.url);

const loadQueryModule = async () => {
  globalThis.__queryAllowDottedCalls = [];
  const clientStubUrl = dataModule(`
    export const ds = {
      runQuery(params) {
        globalThis.__queryAllowDottedCalls.push(params);
        return Promise.resolve({ data: [] });
      },
    };
    export const isOnline = () => true;
  `);
  const source = (await readFile(queryModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`);
  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__queryAllowDottedCalls };
};

test('runQuery strips dotted fields by default but allows them for explicit desktop queries', async () => {
  const { mod, calls } = await loadQueryModule();

  await mod.runQuery({
    object: 'Account_Plan_vod__c',
    fields: ['Id', 'Owner.Name', 'LastModifiedBy.Name'],
  });
  await mod.runQuery({
    object: 'Account_Plan_vod__c',
    fields: ['Id', 'Owner.Name', 'LastModifiedBy.Name'],
    allowDottedFields: true,
  });

  assert.deepEqual(calls[0], {
    object: 'Account_Plan_vod__c',
    fields: ['Id'],
  });
  assert.deepEqual(calls[1], {
    object: 'Account_Plan_vod__c',
    fields: ['Id', 'Owner.Name', 'LastModifiedBy.Name'],
  });
});
