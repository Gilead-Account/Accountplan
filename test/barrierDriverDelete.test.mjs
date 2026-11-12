import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const pagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const cssPath = new URL('../src/pages/BarriersDrivers/BarriersDrivers.css', import.meta.url);
const appPath = new URL('../src/App.jsx', import.meta.url);
const mainCssPath = new URL('../src/styles/main.css', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async (activityRows = []) => {
  globalThis.__barrierDriverDeleteRows = activityRows;
  globalThis.__barrierDriverDeleteCalls = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__barrierDriverDeleteCalls.push({ type: 'query', params });
      return Promise.resolve(globalThis.__barrierDriverDeleteRows || []);
    };
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({});
    export const updateRecord = (object, id, fields) => {
      globalThis.__barrierDriverDeleteCalls.push({ type: 'update', object, id, fields });
      return Promise.resolve({ success: true, data: { id } });
    };
    export const deleteRecord = (object, id) => {
      globalThis.__barrierDriverDeleteCalls.push({ type: 'delete', object, id });
      return Promise.resolve({ success: true, data: { id } });
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
  return { mod, calls: globalThis.__barrierDriverDeleteCalls };
};

const activity = (id) => ({
  Id: id,
  Barrier_and_Tactical_Action__c: 'barrier-001',
  KPH_Activity_Name__c: `Activity ${id}`,
  KPH_Indication__c: 'DLBCL',
  KPH_Is_Deleted__c: false,
});

test('Barrier and Driver rows show Delete beside Edit in both renderers', async () => {
  const [source, css] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(cssPath, 'utf8'),
  ]);

  assert.match(source, /function HierarchyRow\([\s\S]*?barrier-driver-row-actions[\s\S]*?<EditIconButton[\s\S]*?<DeleteIconButton/);
  assert.match(source, /function RecordCard\([\s\S]*?barrier-driver-row-actions[\s\S]*?<EditIconButton[\s\S]*?<DeleteIconButton/);
  assert.match(source, /ariaLabel=\{`Delete \$\{record\.name \|\| 'barrier or driver'\}`\}/);
  assert.match(source, /disabled=\{isReadOnly\}/);
  assert.match(source, /Before completing the deletion, either delete the associated critical activities or[\s\S]*?reassign them to another Barrier or Driver/);
  assert.match(source, /barrier-driver-delete-display-option[\s\S]*?Delete associated critical activities/);
  assert.match(source, /barrier-driver-delete-option-separator[\s\S]*?>OR</);
  assert.match(source, /barrier-driver-delete-display-option[\s\S]*?Reassign associated critical activities to another Barrier or Driver/);
  assert.doesNotMatch(source, /barrier-driver-delete-display-option" disabled/);
  assert.match(css, /\.barrier-driver-row-actions\s*\{/);
  assert.match(css, /\.barrier-driver-delete-button\s*\{/);
  assert.match(source, /critical-activity-confirm-scrim barrier-driver-delete-scrim/);
  assert.match(css, /\.barrier-driver-delete-scrim\s*\{[\s\S]*?backdrop-filter:\s*blur\(4px\)/);
  assert.match(css, /\.barrier-driver-delete-dialog\s*\{[\s\S]*?box-sizing:\s*border-box[\s\S]*?max-width:\s*100%/);
  assert.match(css, /\.barrier-driver-delete-dependencies\s*\{[\s\S]*?box-sizing:\s*border-box[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.barrier-driver-delete-display-option\s*\{[\s\S]*?box-sizing:\s*border-box[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.barrier-driver-delete-display-option strong\s*\{[\s\S]*?overflow-wrap:\s*anywhere[\s\S]*?white-space:\s*normal/);
});

test('Barrier or Driver with no activities is deleted directly after the dependency query', async () => {
  const { mod, calls } = await loadSharedModule([]);

  const result = await mod.deleteBarrierDriverWithDependencies('barrier-001');

  assert.equal(result.dependencyAction, 'none');
  assert.equal(calls[0].type, 'query');
  assert.match(calls[0].params.where, /Barrier_and_Tactical_Action__c = 'barrier-001'/);
  assert.deepEqual(calls.at(-1), {
    type: 'update',
    object: mod.BARRIER_DRIVER_OBJECT,
    id: 'barrier-001',
    fields: { KPH_Is_Deleted__c: true },
  });
  assert.equal(mod.BARRIER_DRIVER_SOFT_DELETE_FIELD, 'KPH_Is_Deleted__c');
});

test('delete popup opens from loaded activities and final confirmation rechecks CRM', async () => {
  const source = await readFile(pagePath, 'utf8');

  assert.match(
    source,
    /const openDeleteBarrierDriver = \(record\) => \{[\s\S]*?activities\.filter\(\(activity\) =>[\s\S]*?recordIdMatches\(activity\.barrierDriverId, record\.id\)[\s\S]*?setDeleteState\(\{[\s\S]*?associatedActivities/
  );
  assert.doesNotMatch(source, /fetchCriticalActivitiesForBarrierDriver/);
  assert.match(
    source,
    /const handleConfirmDeleteBarrierDriver = async \(\) => \{[\s\S]*?await deleteBarrierDriverWithDependencies\(record\.id\)/
  );
});

test('Barrier and Driver delete scrim activates shell modal stacking above the sidebar', async () => {
  const [appSource, mainCss] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(mainCssPath, 'utf8'),
  ]);

  assert.match(
    appSource,
    /document\.querySelector\([\s\S]*?\.stakeholder-edit-overlay, \.modal-scrim, \.critical-activity-confirm-scrim/
  );
  assert.match(mainCss, /\.shell\.shell-frame \.shell-sidebar\s*\{[\s\S]*?z-index:\s*120/);
  assert.match(mainCss, /\.shell\.shell-frame\.modal-open \.shell-main\s*\{[\s\S]*?z-index:\s*200/);
});

test('Barrier and Driver reads exclude records soft-deleted in CRM', async () => {
  const { mod, calls } = await loadSharedModule([]);

  await mod.fetchBarriersAndDrivers('plan-001');

  assert.equal(calls[0].params.object, mod.BARRIER_DRIVER_OBJECT);
  assert.ok(calls[0].params.fields.includes(mod.BARRIER_DRIVER_SOFT_DELETE_FIELD));
  assert.match(calls[0].params.where, /KPH_Account_Plan__c = 'plan-001'/);
  assert.match(calls[0].params.where, /KPH_Is_Deleted__c = false OR KPH_Is_Deleted__c = null/);
});

test('display-only dependency choices preserve Critical Activities and the parent', async () => {
  const { mod, calls } = await loadSharedModule([activity('activity-1')]);

  await assert.rejects(
    () => mod.deleteBarrierDriverWithDependencies('barrier-001'),
    /Resolve the associated critical activities/
  );
  assert.equal(calls.some((call) => call.type === 'delete'), false);
  assert.equal(calls.some((call) => call.type === 'update'), false);
});
