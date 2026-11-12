import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadQueryModule = async () => {
  const querySource = await readFile(new URL('../src/lib/dataservice/query.js', import.meta.url), 'utf8');
  const clientStubUrl = dataModule('export const ds = {}; export const isOnline = () => false;');
  const source = querySource.replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`);
  return import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
};

test('unwrap flattens nested iPad date cells before UI date formatting', async () => {
  const { unwrap } = await loadQueryModule();

  const row = unwrap({
    KPH_Last_MPD_Review_Date__c: { value: { value: '2026-04-15', display: '04/15/2026' } },
    KPH_To_Be_Completed_By__c: { value: { display: '05/30/2026', value: '2026-05-30' } },
    LastModifiedDate: { value: { value: '2026-06-18T12:00:00Z', display: '06/18/2026' } },
  });

  assert.equal(row.KPH_Last_MPD_Review_Date__c, '2026-04-15');
  assert.equal(row.KPH_To_Be_Completed_By__c, '2026-05-30');
  assert.equal(row.LastModifiedDate, '2026-06-18T12:00:00Z');
});
