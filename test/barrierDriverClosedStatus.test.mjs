import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const barriersDriversPagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const barriersDriversCssPath = new URL('../src/pages/BarriersDrivers/BarriersDrivers.css', import.meta.url);
const overviewPagePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadSharedModule = async () => {
  globalThis.__barrierDriverMutationCalls = [];

  const queryStubUrl = dataModule(`
    export const runQuery = () => Promise.resolve([]);
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => {
      if (!id) return [];
      const value = String(id);
      return value.length === 18 ? [value, value.slice(0, 15)] : [value];
    };
    export const createRecord = (object, fields) => {
      globalThis.__barrierDriverMutationCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ id: 'new-bd-id' });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__barrierDriverMutationCalls.push({ type: 'update', object, id, fields });
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
  return { mod, calls: globalThis.__barrierDriverMutationCalls };
};

test('toBarrierDriver treats CRM Close status as UI Closed after reload', async () => {
  const { mod } = await loadSharedModule();

  const record = mod.toBarrierDriver({
    Id: 'bd-closed-001',
    KPH_Barrier_Title__c: 'Closed barrier',
    KPH_Indication__c: 'DLBCL',
    KPH_Status__c: 'Close',
  });

  assert.equal(record.status, 'Closed');
});

test('barrier and driver query excludes retired legacy title fields', async () => {
  const { mod } = await loadSharedModule();

  assert.equal(mod.BARRIER_DRIVER_FIELDS.includes('KPH_Barrier_1__c'), false);
  assert.equal(mod.BARRIER_DRIVER_FIELDS.includes('CreatedById'), true);
});

test('only Kite Data Admin Pre-launch Drivers are mapped as status-only', async () => {
  const { mod } = await loadSharedModule();
  const base = {
    Id: 'driver-001',
    RecordTypeId: mod.BARRIER_DRIVER_RECORD_TYPE_IDS.Driver,
    KPH_Driver_Title__c: 'Pre-launch driver',
    KPH_Indication__c: 'MM',
    KPH_Strategy__c: 'MM Pre-Launch Readiness | MM',
    KPH_Status__c: 'In Progress',
  };

  const protectedDriver = mod.toBarrierDriver({
    ...base,
    CreatedById: mod.KITE_DATA_ADMIN_USER_ID,
  });
  const otherCreatorDriver = mod.toBarrierDriver({
    ...base,
    CreatedById: '0056T000009zj0VQAQ',
  });
  const nonPreLaunchDriver = mod.toBarrierDriver({
    ...base,
    CreatedById: mod.KITE_DATA_ADMIN_USER_ID,
    KPH_Strategy__c: 'Lead/Grow Brand Share | MM',
  });

  assert.equal(protectedDriver.createdById, mod.KITE_DATA_ADMIN_USER_ID);
  assert.equal(protectedDriver.isKiteDataAdminPreLaunch, true);
  assert.equal(otherCreatorDriver.isKiteDataAdminPreLaunch, false);
  assert.equal(nonPreLaunchDriver.isKiteDataAdminPreLaunch, false);
});

test('toBarrierDriver treats CRM completed statuses as UI Closed after reload', async () => {
  const { mod } = await loadSharedModule();

  assert.equal(mod.normalizeBarrierDriverStatusForDisplay('Complete'), 'Closed');
  assert.equal(mod.normalizeBarrierDriverStatusForDisplay('Completed'), 'Closed');
  assert.equal(mod.isClosedBarrierDriverStatus('Complete'), true);
  assert.equal(mod.isClosedBarrierDriverStatus('Completed'), true);
  assert.equal(
    mod.toBarrierDriver({
      Id: 'bd-completed-001',
      KPH_Barrier_Title__c: 'Completed barrier',
      KPH_Indication__c: 'DLBCL',
      KPH_Status__c: 'Completed',
    }).status,
    'Closed'
  );
});

test('updateBarrierDriver saves UI Closed status using CRM Closed picklist value', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateBarrierDriver('bd-closed-001', {
    type: 'Barrier',
    name: 'Closed barrier',
    status: 'Closed',
    indication: 'DLBCL',
    category: 'Clinical',
    businessImpact: 'Medium',
    strategy: 'Expand Class Share',
    comments: '',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.BARRIER_DRIVER_OBJECT);
  assert.equal(calls[0].fields.KPH_Status__c, 'Closed');
});

test('updateBarrierDriverStatus saves popup Closed selection as CRM Closed picklist value', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateBarrierDriverStatus('bd-closed-001', 'Closed');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.BARRIER_DRIVER_OBJECT);
  assert.deepEqual(calls[0].fields, { KPH_Status__c: 'Closed' });
});

test('open critical activity counts ignore inactive activities', async () => {
  const { mod } = await loadSharedModule();

  assert.deepEqual(
    mod.buildOpenActivityCountByBarrier([
      { id: 'act-open', barrierDriverId: 'bd-001', status: 'Planned' },
      { id: 'act-inactive', barrierDriverId: 'bd-001', status: 'In Progress', isDeactivated: true },
      { id: 'act-complete', barrierDriverId: 'bd-001', status: 'Complete' },
      { id: 'act-driver', barrierDriverId: 'driver-001', status: 'In Progress' },
    ]),
    {
      'bd-001': 1,
      'driver-001': 1,
    }
  );
});

test('closed critical activity counts are all-time and ignore inactive or deleted activities', async () => {
  const { mod } = await loadSharedModule();
  const parentId = '001000000000001AAA';

  assert.deepEqual(
    mod.buildClosedActivityCountByBarrier([
      { id: 'act-complete-old', barrierDriverId: parentId, status: 'Complete', completedDate: '2020-01-01' },
      { id: 'act-completed', barrierDriverId: parentId, status: 'Completed' },
      { id: 'act-closed', barrierDriverId: parentId, status: 'Closed' },
      { id: 'act-open', barrierDriverId: parentId, status: 'In Progress' },
      { id: 'act-inactive', barrierDriverId: parentId, status: 'Complete', isDeactivated: true },
      { id: 'act-deleted', barrierDriverId: parentId, status: 'Closed', isDeleted: true },
    ]),
    {
      '001000000000001AAA': 3,
      '001000000000001': 3,
    }
  );
});

test('Barrier and Driver cards always render separate open and closed activity pills', async () => {
  const [source, css] = await Promise.all([
    readFile(barriersDriversPagePath, 'utf8'),
    readFile(barriersDriversCssPath, 'utf8'),
  ]);

  assert.match(source, /No open critical activities/);
  assert.match(source, /No closed critical activities/);
  assert.match(source, /buildClosedActivityCountByBarrier/);
  assert.equal((source.match(/recordClosedActivitySummary\(record, closedCountMap\)/g) || []).length, 2);
  assert.equal((source.match(/chip chip-blue bd-activity-summary-pill is-closed/g) || []).length, 2);
  assert.doesNotMatch(css, /\.bd-activity-summary-pill\.is-closed\s*\{/);
});

test('barrier and driver close saves are blocked while open critical activities exist', async () => {
  const barriersSource = await readFile(barriersDriversPagePath, 'utf8');
  const overviewSource = await readFile(overviewPagePath, 'utf8');

  for (const source of [barriersSource, overviewSource]) {
    assert.match(source, /closeBlockedByActivitiesMessage/);
    assert.match(source, /isClosedBarrierDriverStatus\(form\.status\)/);
    assert.match(source, /(openCountByBarrier|openActivityCountByBarrier)\[bdEditState\.record\.id\]/);
    assert.match(source, /openActivityCount > 0/);
    assert.match(source, /setBdError\(closeBlockedByActivitiesMessage/);
  }
});
