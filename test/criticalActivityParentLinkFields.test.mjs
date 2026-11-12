import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const barriersDriversPagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const criticalActivitiesPagePath = new URL('../src/pages/CriticalActivities/index.jsx', import.meta.url);
const overviewPagePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);
const urgentActivitiesPath = new URL('../src/pages/Overview/UrgentActivities.jsx', import.meta.url);
const activityModalPath = new URL('../src/pages/BarriersDrivers/ActivityEditModal.jsx', import.meta.url);
const newActivityModalPath = new URL('../src/pages/CriticalActivities/CriticalActivityNewModal.jsx', import.meta.url);
const editActivityModalPath = new URL('../src/pages/CriticalActivities/CriticalActivityEditModal.jsx', import.meta.url);
const linkedOptionsPath = new URL('../src/pages/CriticalActivities/linkedBarrierDriverOptions.js', import.meta.url);
const editModalCssPath = new URL('../src/styles/edit-modal.css', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadLinkedOptionsModule = async () => {
  const source = await readFile(linkedOptionsPath, 'utf8');
  return import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
};

const loadSharedModule = async ({ online = false } = {}) => {
  globalThis.__criticalActivityMutationCalls = [];

  const queryStubUrl = dataModule(`
    export const runQuery = () => Promise.resolve([]);
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => (row && row.raw) || row;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => {
      if (!id) return null;
      return String(id).length === 15 ? String(id) + 'XYZ' : String(id);
    };
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = (object, fields) => {
      globalThis.__criticalActivityMutationCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ id: 'new-critical-activity-id' });
    };
    export const updateRecord = (object, id, fields) => {
      globalThis.__criticalActivityMutationCalls.push({ type: 'update', object, id, fields });
      return Promise.resolve({ id });
    };
  `);
  const clientStubUrl = dataModule(`export const isOnline = () => ${online ? 'true' : 'false'};`);
  const utilsStubUrl = dataModule(`
    export const normalizeCrmBoolean = (value) => value === true || value === 1 || value === '1';
  `);

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__criticalActivityMutationCalls };
};

test('critical activity create links Barrier parent through Barrier_and_Tactical_Action__c', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.createCriticalActivity('plan-001', {
    title: 'Schedule care team follow-up',
    details: 'Confirm next step',
    indication: 'DLBCL',
    status: 'Planned',
    dueDate: '2026-06-30',
    parentId: 'a2BBarrier001',
    parentType: 'Barrier',
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    type: 'update',
    object: mod.BARRIER_DRIVER_OBJECT,
    id: 'a2BBarrier001',
    fields: { RecordTypeId: mod.BARRIER_DRIVER_RECORD_TYPE_IDS.Barrier },
  });
  assert.equal(calls[1].type, 'create');
  assert.equal(calls[1].object, mod.CRITICAL_ACTIVITY_OBJECT);
  assert.equal(calls[1].fields.KPH_Account_Plans__c, 'plan-001');
  assert.equal(calls[1].fields.KPH_Indication__c, 'DLBCL');
  assert.equal(calls[1].fields.Barrier_and_Tactical_Action__c, 'a2BBarrier001');
  assert.ok(!Object.hasOwn(calls[1].fields, mod.ACTIVITY_COMMENTS_FIELD));
});

test('critical activity parent lookup uses the shared field for both parent types', async () => {
  const { mod } = await loadSharedModule();

  assert.equal(mod.criticalActivityParentLookupFieldFor('Barrier'), 'Barrier_and_Tactical_Action__c');
  assert.equal(mod.criticalActivityParentLookupFieldFor('Driver'), 'Barrier_and_Tactical_Action__c');
});

test('critical activity create rejects missing linked barrier or driver', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.createCriticalActivity('plan-001', {
      title: 'Unlinked follow-up',
      details: 'Should not save',
      status: 'Planned',
      dueDate: '2026-06-30',
    }),
    /Linked Barrier\/Driver is required/
  );

  assert.equal(calls.length, 0);
});

test('critical activity create rejects missing indication', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.createCriticalActivity('plan-001', {
      title: 'Schedule care team follow-up',
      details: 'Confirm next step',
      status: 'Planned',
      dueDate: '2026-06-30',
      parentId: 'a2BBarrier001',
      parentType: 'Barrier',
    }),
    /Indication is required/
  );

  assert.equal(calls.length, 0);
});

test('critical activity create rejects missing due date', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.createCriticalActivity('plan-001', {
      title: 'Schedule care team follow-up',
      details: 'Confirm next step',
      indication: 'DLBCL',
      status: 'Planned',
      parentId: 'a2BBarrier001',
      parentType: 'Barrier',
    }),
    /Due Date is required/
  );

  assert.equal(calls.length, 0);
});

test('critical activity create rejects titles over 55 characters', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.createCriticalActivity('plan-001', {
      title: 'x'.repeat(mod.CRITICAL_ACTIVITY_TITLE_MAX_LENGTH + 1),
      details: 'Should not save',
      indication: 'DLBCL',
      status: 'Planned',
      dueDate: '2026-06-30',
      parentId: 'a2BBarrier001',
      parentType: 'Barrier',
    }),
    /55 characters or fewer/
  );

  assert.equal(calls.length, 0);
});

test('critical activity create links Driver parent through the shared lookup', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.createCriticalActivity('plan-001', {
    title: 'Schedule care team follow-up',
    details: 'Confirm next step',
    indication: 'DLBCL',
    status: 'Planned',
    dueDate: '2026-06-30',
    parentId: 'a2BDriver001',
    parentType: 'Driver',
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    type: 'update',
    object: mod.BARRIER_DRIVER_OBJECT,
    id: 'a2BDriver001',
    fields: { RecordTypeId: mod.BARRIER_DRIVER_RECORD_TYPE_IDS.Driver },
  });
  assert.equal(calls[1].type, 'create');
  assert.equal(calls[1].object, mod.CRITICAL_ACTIVITY_OBJECT);
  assert.equal(calls[1].fields.Barrier_and_Tactical_Action__c, 'a2BDriver001');
  assert.ok(!Object.hasOwn(calls[1].fields, 'KPH_Driver__c'));
});

test('critical activity mapper resolves wrapped shared parent lookup ids', async () => {
  const { mod } = await loadSharedModule();

  const activity = mod.toActivity({
    Id: 'act-driver-001',
    CreatedDate: '2026-07-17T14:30:00Z',
    KPH_Activity_Name__c: 'Driver follow-up',
    KPH_Status__c: 'Planned',
    Barrier_and_Tactical_Action__c: {
      Id: { value: 'a2BDriver001' },
      Name: { value: 'Driver record' },
    },
  });

  assert.equal(activity.barrierDriverId, 'a2BDriver001');
  assert.equal(activity.createdDate, '2026-07-17T14:30:00Z');
  assert.equal(activity.parentType, null);
});

test('critical activity mapper identifies records created by Kite Data Admin', async () => {
  const { mod } = await loadSharedModule();

  const protectedActivity = mod.toActivity({
    Id: 'act-admin-001',
    CreatedById: mod.KITE_DATA_ADMIN_USER_ID,
    KPH_Activity_Name__c: 'Admin activity',
  });
  const editableActivity = mod.toActivity({
    Id: 'act-user-001',
    CreatedById: '0056T000009zj0VQAQ',
    KPH_Activity_Name__c: 'User activity',
  });

  assert.equal(protectedActivity.isKiteDataAdminCreated, true);
  assert.equal(editableActivity.isKiteDataAdminCreated, false);
});

test('critical activity mapper caps activity title and detail fallback at 55 characters', async () => {
  const { mod } = await loadSharedModule();
  const longDetail = 'Detail fallback title that is longer than fifty five characters total';
  const longExistingTitle = 'Existing critical activity title longer than fifty five characters';

  const detailFallbackActivity = mod.toActivity({
    Id: 'act-detail-fallback',
    KPH_Activity_Name__c: '',
    KPH_Detail__c: longDetail,
    Name: 'CRM generated name',
  });
  const existingTitleActivity = mod.toActivity({
    Id: 'act-existing-title',
    KPH_Activity_Name__c: longExistingTitle,
    KPH_Detail__c: 'Detail text',
  });

  assert.equal(detailFallbackActivity.name, longDetail.slice(0, mod.CRITICAL_ACTIVITY_TITLE_MAX_LENGTH));
  assert.equal(existingTitleActivity.name, longExistingTitle.slice(0, mod.CRITICAL_ACTIVITY_TITLE_MAX_LENGTH));
});

test('critical activity mapper does not fall back to CRM Name for title', async () => {
  const { mod } = await loadSharedModule();

  const activity = mod.toActivity({
    Id: 'act-no-title',
    KPH_Activity_Name__c: '',
    KPH_Detail__c: '',
    Name: 'CRM generated name should not be shown',
  });

  assert.equal(activity.name, '');
});

test('critical activity update preserves parent when edit form has no parent field', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateCriticalActivity('act-001', {
    title: 'Updated title',
    details: 'Updated detail',
    status: 'In Progress',
    dueDate: '2026-06-30',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.CRITICAL_ACTIVITY_OBJECT);
  assert.ok(!Object.hasOwn(calls[0].fields, 'Barrier_and_Tactical_Action__c'));
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_Driver__c'));
  assert.ok(!Object.hasOwn(calls[0].fields, mod.ACTIVITY_DEACTIVATE_FIELD));
  assert.ok(!Object.hasOwn(calls[0].fields, mod.ACTIVITY_COMMENTS_FIELD));
});

test('Kite Data Admin critical activity update writes only Status and Details', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateCriticalActivity('act-admin-001', {
    title: 'Attempted changed title',
    details: 'Allowed changed details',
    indication: 'MM',
    status: 'In Progress',
    accountable: 'Somebody',
    dueDate: '2027-01-01',
    parentId: 'driver-002',
    kiteDataAdminLimitedUpdate: true,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    type: 'update',
    object: mod.CRITICAL_ACTIVITY_OBJECT,
    id: 'act-admin-001',
    fields: {
      KPH_Detail__c: 'Allowed changed details',
      KPH_Status__c: 'In Progress',
    },
  });
});

test('critical activity update writes inactive checkbox only when provided', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateCriticalActivity('act-001', {
    title: 'Updated title',
    details: 'Updated detail',
    status: 'In Progress',
    dueDate: '2026-06-30',
    deactivate: true,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].fields[mod.ACTIVITY_DEACTIVATE_FIELD], true);
});

test('critical activity update rejects titles over 55 characters', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.updateCriticalActivity('act-001', {
      title: 'x'.repeat(mod.CRITICAL_ACTIVITY_TITLE_MAX_LENGTH + 1),
      details: 'Updated detail',
      status: 'In Progress',
      dueDate: '2026-06-30',
    }),
    /55 characters or fewer/
  );

  assert.equal(calls.length, 0);
});

test('critical activity update rejects missing due date', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.updateCriticalActivity('act-001', {
      title: 'Updated title',
      details: 'Updated detail',
      status: 'In Progress',
    }),
    /Due Date is required/
  );

  assert.equal(calls.length, 0);
});

test('critical activity update rejects explicit unlinked parent', async () => {
  const { mod, calls } = await loadSharedModule();

  await assert.rejects(
    () => mod.updateCriticalActivity('act-001', {
      title: 'Updated title',
      details: 'Updated detail',
      status: 'In Progress',
      dueDate: '2026-06-30',
      parentId: '',
    }),
    /Linked Barrier\/Driver is required/
  );

  assert.equal(calls.length, 0);
});

test('critical activity update does not repair parent RecordTypeId when already correct', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateCriticalActivity('act-001', {
    title: 'Updated title',
    details: 'Updated detail',
    status: 'In Progress',
    dueDate: '2026-06-30',
    parentId: 'a2BBarrier001',
    parentType: 'Barrier',
    parentRecordTypeId: mod.BARRIER_DRIVER_RECORD_TYPE_IDS.Barrier,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.CRITICAL_ACTIVITY_OBJECT);
  assert.equal(calls[0].fields.Barrier_and_Tactical_Action__c, 'a2BBarrier001');
});

test('critical activity update links Driver through the shared lookup', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.updateCriticalActivity('act-001', {
    title: 'Updated title',
    details: 'Updated detail',
    status: 'In Progress',
    dueDate: '2026-06-30',
    parentId: 'a2BDriver001',
    parentType: 'Driver',
    parentRecordTypeId: mod.BARRIER_DRIVER_RECORD_TYPE_IDS.Driver,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.CRITICAL_ACTIVITY_OBJECT);
  assert.equal(calls[0].fields.Barrier_and_Tactical_Action__c, 'a2BDriver001');
  assert.ok(!Object.hasOwn(calls[0].fields, 'KPH_Driver__c'));
});

test('critical activity delete carries existing Driver parent through required shared lookup', async () => {
  const { mod, calls } = await loadSharedModule();

  await mod.deleteCriticalActivity('act-001', {
    barrierDriverId: 'a2BDriver001',
    parentType: 'Driver',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.CRITICAL_ACTIVITY_OBJECT);
  assert.equal(calls[0].fields[mod.ACTIVITY_SOFT_DELETE_FIELD], true);
  assert.equal(calls[0].fields.Barrier_and_Tactical_Action__c, 'a2BDriver001');
});

test('critical activity desktop delete canonicalizes 15-character record id for online updateRecord', async () => {
  const { mod, calls } = await loadSharedModule({ online: true });

  await mod.deleteCriticalActivity('a3C8C00000ABCDE', {
    barrierDriverId: 'a2BDriver001',
    parentType: 'Driver',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].id, 'a3C8C00000ABCDEXYZ');
  assert.equal(calls[0].fields[mod.ACTIVITY_SOFT_DELETE_FIELD], true);
  assert.equal(calls[0].fields.Barrier_and_Tactical_Action__c, 'a2BDriver001');
});

test('Barriers and Drivers activity modals carry parent link fields into save payloads', async () => {
  const pageSource = await readFile(barriersDriversPagePath, 'utf8');
  const criticalActivitiesPageSource = await readFile(criticalActivitiesPagePath, 'utf8');
  const overviewPageSource = await readFile(overviewPagePath, 'utf8');
  const urgentActivitiesSource = await readFile(urgentActivitiesPath, 'utf8');
  const legacyModalSource = await readFile(activityModalPath, 'utf8');
  const newModalSource = await readFile(newActivityModalPath, 'utf8');
  const modalSource = await readFile(editActivityModalPath, 'utf8');

  assert.match(pageSource, /CriticalActivityNewModal/);
  assert.match(criticalActivitiesPageSource, /import CriticalActivityEditModal from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
  assert.match(pageSource, /import CriticalActivityEditModal from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
  assert.match(legacyModalSource, /export \{ default \} from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
  assert.match(criticalActivitiesPageSource, /barrierDriverOptions=\{barrierDriverOptions\}/);
  assert.match(criticalActivitiesPageSource, /barrierDriverOptions=\{openBarrierDriverOptions\}/);
  assert.match(criticalActivitiesPageSource, /openBarrierDriverLookup\.has\(form\.parentId\)/);
  assert.match(criticalActivitiesPageSource, /onSave=\{\(form\) => handleSaveActivity\(editingActivity, form\)\}/);
  assert.match(pageSource, /setActivityCreateState\(\{ parentRecord: parentRecord \|\| null \}\)/);
  assert.match(pageSource, /openRecordById\.has\(form\.parentId\)/);
  assert.match(pageSource, /parentId: form\.parentId/);
  assert.match(pageSource, /parentType: form\.parentType/);
  assert.match(pageSource, /parentRecordTypeId: form\.parentRecordTypeId/);
  assert.match(pageSource, /parentRecord=\{activityCreateState\.parentRecord\}/);
  assert.match(pageSource, /barrierDriverOptions=\{openBarrierDriverOptionsForActivity\}/);
  assert.match(pageSource, /onSave=\{handleCreateActivity\}/);
  assert.match(modalSource, /const preferredParentId = activity\?\.barrierDriverId \|\| parentRecord\?\.id \|\| ''/);
  assert.match(modalSource, /const allowedParent = optionForId\(allowedParentOptions,\s*preferredParentId\)/);
  assert.match(modalSource, /parentType: allowedParent\?\.type \|\| ''/);
  assert.match(modalSource, /parentRecordTypeId: allowedParent\?\.recordTypeId \|\| ''/);
  // Indication is inherited from the linked barrier/driver and shown read-only.
  assert.match(modalSource, /next\.indication = found \? \(found\.indication \|\| ''\)/);
  assert.match(modalSource, /Set by the linked barrier\/driver/);
  assert.match(modalSource, /Linked Barrier\/Driver is required/);
  assert.match(modalSource, /Indication is required/);
  assert.match(modalSource, /Due Date is required/);
  assert.match(modalSource, /name="criticalActivityDueDate"[\s\S]*?required/);
  assert.match(modalSource, /linkedBarrierDriverSelectOptions\(allowedParentOptions,\s*form\.parentId\)/);
  assert.match(modalSource, /hidden=\{!!opt\.isCurrentClosedSelection\}/);
  assert.doesNotMatch(modalSource, /legacyCurrentDriverLocked/);
  assert.match(modalSource, /optionForId\(relatedOptions,\s*form\.parentId\)/);
  assert.match(modalSource, /isOpenBarrierDriverOption/);
  assert.match(modalSource, /remainingFieldsDisabled/);
  assert.match(modalSource, /readOnly=\{remainingFieldsDisabled\}/);
  assert.match(modalSource, /disabled=\{remainingFieldsDisabled\}/);
  assert.match(modalSource, /disabled=\{isSaving \|\| allFieldsDisabled\}/);
  assert.match(newModalSource, /Linked Barrier\/Driver/);
  assert.match(newModalSource, /isOpenBarrierDriverOption/);
  assert.match(newModalSource, /Select an open linked Barrier\/Driver/);
  assert.match(newModalSource, /parentType: parentOption\?\.type \|\| ''/);
  assert.match(newModalSource, /parentRecordTypeId: parentOption\?\.recordTypeId \|\| ''/);
  // Indication is inherited from the selected barrier/driver and read-only.
  assert.match(newModalSource, /indication: parentOption\?\.indication \|\| ''/);
  assert.match(newModalSource, /next\.indication = found \? \(found\.indication \|\| ''\)/);
  assert.match(newModalSource, /Set by the linked barrier\/driver/);
  assert.match(newModalSource, /Critical Activity Title, Details, Linked Barrier\/Driver, Indication, and Due Date are required/);
  assert.match(newModalSource, /CRITICAL_ACTIVITY_TITLE_MAX_LENGTH = 55/);
  assert.match(newModalSource, /maxLength=\{CRITICAL_ACTIVITY_TITLE_MAX_LENGTH\}/);
  assert.match(modalSource, /CRITICAL_ACTIVITY_TITLE_MAX_LENGTH = 55/);
  assert.match(modalSource, /maxLength=\{CRITICAL_ACTIVITY_TITLE_MAX_LENGTH\}/);
  assert.doesNotMatch(modalSource, /label="Comments"/);
  assert.doesNotMatch(newModalSource, /label="Comments"/);
  assert.doesNotMatch(modalSource, /criticalActivityComments/);
  assert.doesNotMatch(modalSource, /name="criticalActivityDeactivate"/);
  assert.doesNotMatch(modalSource, />\s*Inactive\s*</);
  assert.match(modalSource, /Are you sure you want to delete this critical activity\?/);
  assert.match(modalSource, />\s*Confirm Delete\s*</);
  assert.match(modalSource, /onDelete/);
  assert.match(criticalActivitiesPageSource, /criticalActivityClosedParentEditReason/);
  assert.match(criticalActivitiesPageSource, /editDisabledReason:\s*closedParentEditReason\(activity\)/);
  assert.match(criticalActivitiesPageSource, /disabled=\{isReadOnly \|\| !a\.id\}/);
  assert.doesNotMatch(criticalActivitiesPageSource, /disabled=\{isReadOnly \|\| !a\.id \|\| !!a\.editDisabledReason\}/);
  assert.match(pageSource, /criticalActivityClosedParentEditReason/);
  assert.match(pageSource, /editDisabledReason:\s*closedParentEditReason\(activity\)/);
  assert.doesNotMatch(pageSource, /disabled=\{isReadOnly \|\| !!activity\.editDisabledReason\}/);
  assert.match(overviewPageSource, /criticalActivityClosedParentEditReason/);
  assert.match(overviewPageSource, /editDisabledReason:\s*closedParentEditReason\(activity\)/);
  assert.match(overviewPageSource, /editDisabledReason=\{closedParentEditReason\(activityEditState\.activity\)\}/);
  assert.match(overviewPageSource, /barrierDriverOptions=\{allBarrierDriverRecords\}/);
  assert.match(overviewPageSource, /parentRecord=\{activityEditState\.parentRecord\}/);
  assert.doesNotMatch(urgentActivitiesSource, /disabled=\{!onEditActivity \|\| !!activity\.editDisabledReason\}/);
  assert.match(urgentActivitiesSource, /disabled=\{!onEditActivity\}/);
});

test('locked critical activity fields are visibly grey', async () => {
  const modalSource = await readFile(editActivityModalPath, 'utf8');
  const cssSource = await readFile(editModalCssPath, 'utf8');

  assert.match(
    modalSource,
    /className=\{`stakeholder-edit-modal critical-activity-edit-modal bd-critical-activity-modal \$\{remainingFieldsDisabled \? 'is-fields-locked' : ''\}`\}/
  );
  assert.match(cssSource, /\.critical-activity-edit-modal\.is-fields-locked\s+input:read-only/);
  assert.match(cssSource, /\.critical-activity-edit-modal\.is-fields-locked\s+select:disabled/);
  assert.match(cssSource, /\.critical-activity-edit-modal\.is-fields-locked[\s\S]*?background:\s*#eef2f4;/);
  assert.match(cssSource, /\.critical-activity-edit-modal\.is-fields-locked[\s\S]*?color:\s*#6b7b86;/);
  assert.match(cssSource, /\.critical-activity-edit-modal\.is-fields-locked[\s\S]*?-webkit-text-fill-color:\s*#6b7b86;/);
});

test('critical activity edit clicks share the Critical Activities tab modal everywhere', async () => {
  const pageSource = await readFile(barriersDriversPagePath, 'utf8');
  const criticalActivitiesPageSource = await readFile(criticalActivitiesPagePath, 'utf8');
  const overviewPageSource = await readFile(overviewPagePath, 'utf8');
  const modalSource = await readFile(editActivityModalPath, 'utf8');
  const legacyModalSource = await readFile(activityModalPath, 'utf8');

  assert.match(
    criticalActivitiesPageSource,
    /import CriticalActivityEditModal from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/
  );
  assert.doesNotMatch(
    criticalActivitiesPageSource,
    /import ActivityEditModal from '@\/pages\/BarriersDrivers\/ActivityEditModal'/
  );
  assert.match(pageSource, /import CriticalActivityEditModal from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
  assert.match(overviewPageSource, /import CriticalActivityEditModal from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
  assert.match(pageSource, /<CriticalActivityEditModal/);
  assert.match(criticalActivitiesPageSource, /<CriticalActivityEditModal/);
  assert.match(overviewPageSource, /<CriticalActivityEditModal/);
  assert.match(overviewPageSource, /barrierDriverOptions=\{allBarrierDriverRecords\}/);
  assert.match(overviewPageSource, /parentRecord=\{activityEditState\.parentRecord\}/);
  assert.match(modalSource, /Linked Barrier\/Driver/);
  assert.match(modalSource, /linkedBarrierDriverSelectOptions\(allowedParentOptions,\s*form\.parentId\)/);
  assert.match(
    modalSource,
    /className=\{`stakeholder-edit-modal critical-activity-edit-modal bd-critical-activity-modal \$\{remainingFieldsDisabled \? 'is-fields-locked' : ''\}`\}/
  );
  assert.match(legacyModalSource, /export \{ default \} from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
});

test('linked Barrier/Driver dropdown keeps a closed current parent only as the selected hidden value', async () => {
  const mod = await loadLinkedOptionsModule();
  const options = [
    { id: 'closed-current', type: 'Barrier', name: 'Closed current barrier', status: 'Closed' },
    { id: 'open-barrier', type: 'Barrier', name: 'Open barrier', status: 'In Progress' },
    { id: 'closed-other', type: 'Driver', name: 'Other closed driver', status: 'Close' },
    { id: 'open-driver', type: 'Driver', name: 'Open driver', status: 'Identified - Not Started' },
  ];

  assert.equal(mod.isOpenBarrierDriverOption(options[0]), false);
  assert.equal(mod.isOpenBarrierDriverOption(options[1]), true);

  assert.deepEqual(
    mod.linkedBarrierDriverSelectOptions(options, 'closed-current').map((option) => ({
      id: option.id,
      hidden: option.isCurrentClosedSelection === true,
    })),
    [
      { id: 'closed-current', hidden: true },
      { id: 'open-barrier', hidden: false },
      { id: 'open-driver', hidden: false },
    ]
  );

  assert.deepEqual(
    mod.linkedBarrierDriverSelectOptions(options, 'open-barrier').map((option) => option.id),
    ['open-barrier', 'open-driver']
  );

  assert.equal(
    mod.criticalActivityClosedParentEditReason({ barrierDriverId: 'closed-current', status: 'Planned' }, options[0]),
    'Reopen linked Barrier/Driver before editing this critical activity.'
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason({ barrierDriverId: 'closed-current', status: 'Complete' }, options[0]),
    ''
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason({ barrierDriverId: 'closed-current', status: 'Completed' }, options[0]),
    ''
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason({ barrierDriverId: 'open-barrier' }, options[1]),
    ''
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason({ barrierDriverId: '' }, null),
    ''
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason({ barrierDriverId: 'missing-parent' }, null),
    ''
  );
});

test('completed Barrier/Driver statuses behave as closed parents for critical activity editing', async () => {
  const mod = await loadLinkedOptionsModule();
  const options = [
    { id: 'completed-current', type: 'Barrier', name: 'Completed current barrier', status: 'Completed' },
    { id: 'complete-other', type: 'Driver', name: 'Complete other driver', status: 'Complete' },
    { id: 'open-driver', type: 'Driver', name: 'Open driver', status: 'In Progress' },
  ];

  assert.equal(mod.isOpenBarrierDriverOption(options[0]), false);
  assert.equal(mod.isOpenBarrierDriverOption(options[1]), false);
  assert.equal(mod.isOpenBarrierDriverOption(options[2]), true);
  assert.deepEqual(
    mod.linkedBarrierDriverSelectOptions(options, 'completed-current').map((option) => ({
      id: option.id,
      hidden: option.isCurrentClosedSelection === true,
    })),
    [
      { id: 'completed-current', hidden: true },
      { id: 'open-driver', hidden: false },
    ]
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason(
      { barrierDriverId: 'completed-current', status: 'Planned' },
      options[0]
    ),
    'Reopen linked Barrier/Driver before editing this critical activity.'
  );
  assert.equal(
    mod.criticalActivityClosedParentEditReason(
      { barrierDriverId: 'completed-current', status: 'Complete' },
      options[0]
    ),
    ''
  );
});
