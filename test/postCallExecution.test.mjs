import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calendarDay, calculateReach, calculateTrifecta, CHECKLIST_FUNCTIONS, eligibleReachHcpIds,
  formatChecklistDate, sortChecklistItems, TRIFECTA_TASKS,
} from '../src/lib/postLaunchChecklist.js';

const accountId = '001000000000001';
const planId = 'a0X000000000001';
const item = { id: 'aPL000000000001', accountId };
const rawItem = (overrides = {}) => ({
  Id: item.id, KPH_Account__c: accountId, KPH_Checklist_Function__c: CHECKLIST_FUNCTIONS[0],
  KPH_Checklist_Item__c: 'Validate Formulary Inclusion', KPH_Status__c: 'Not Started',
  KPH_Comments__c: '', ...overrides,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const loadService = async (overrides = {}) => {
  const queries = [], writes = [];
  const stubs = {
    runQuery: async (params) => { queries.push(params); return []; },
    updateRecord: async (...args) => { writes.push(args); return { success: true }; },
    context: { planId, account: { id: accountId }, plan: { id: planId, accountId } },
    ...overrides,
  };
  const stubKey = `postLaunchStubs${Math.random()}`;
  globalThis[stubKey] = stubs;
  const querySource = await readFile(new URL('../src/lib/dataservice/query.js', import.meta.url), 'utf8');
  // Use the real ID and IN helpers, with only the runtime adapter replaced.
  const client = dataModule(`export const isOnline = () => false; export const ds = {
    runQuery: async (params) => ({ data: await globalThis['${stubKey}'].runQuery(params) }),
    updateRecord: ({object, id, fields}) => globalThis['${stubKey}'].updateRecord(object, id, fields),
  };`);
  const query = dataModule(querySource.replace("'@/lib/dataservice/client'", `'${client}'`));
  const shared = dataModule(`
    export const requireCurrentAccountPlanId = async () => '${planId}';
    export const resolveShellContextForPlanId = async () => globalThis['${stubKey}'].context;
  `);
  const model = dataModule(await readFile(new URL('../src/lib/postLaunchChecklist.js', import.meta.url), 'utf8'));
  const source = (await readFile(new URL('../src/lib/dataservice/accountPlan/postCallExecution.js', import.meta.url), 'utf8'))
    .replace("'@/lib/dataservice/query'", `'${query}'`)
    .replace("'@/lib/dataservice/accountPlan/shared'", `'${shared}'`)
    .replace("'@/lib/postLaunchChecklist'", `'${model}'`);
  return { service: await import(dataModule(source)), queries, writes, stubs };
};

test('CRM mapping excludes unusable records and normalizes unsupported status and missing fields', async () => {
  const { service } = await loadService();
  for (const value of ['', null, 'In Progress', 'Closed']) {
    const mapped = service.toChecklistItem(Object.fromEntries(Object.entries(rawItem({ KPH_Status__c: value })).map(([key, cell]) => [key, { value: cell }])));
    assert.equal(mapped.status, 'Not Started');
    assert.equal(mapped.accountable, '');
    assert.equal(mapped.dueDate, null);
    assert.equal(mapped.comments, '');
  }
  assert.equal(service.toChecklistItem(rawItem({ KPH_Status__c: 'Completed' })).status, 'Completed');
  assert.equal(service.toChecklistItem(rawItem({ KPH_Checklist_Item__c: '  ' })), null);
  assert.equal(service.toChecklistItem(rawItem({ KPH_Checklist_Function__c: 'Other' })), null);
  assert.equal(service.toChecklistItem(rawItem({ Id: null })), null);
});

test('all five columns sort predictably; dates sort chronologically with missing dates last', () => {
  const rows = [
    { id: 'b', description: 'Bravo', accountable: 'Z', dueDate: '2027-01-02', status: 'Not Started', comments: 'Z' },
    { id: 'a', description: 'Alpha', accountable: 'A', dueDate: '2026-12-31', status: 'Completed', comments: 'A' },
    { id: 'c', description: 'Charlie', accountable: 'M', dueDate: null, status: 'Not Started', comments: 'M' },
  ];
  for (const key of ['description', 'accountable', 'dueDate', 'status', 'comments']) {
    assert.deepEqual(sortChecklistItems(rows, key, 'asc').map((row) => row.id), key === 'description' || key === 'dueDate' || key === 'status' ? ['a', 'b', 'c'] : ['a', 'c', 'b']);
    assert.equal(sortChecklistItems(rows, key, 'desc')[0].id, key === 'description' ? 'c' : 'b');
  }
  assert.deepEqual(sortChecklistItems(rows, 'dueDate', 'desc').map((row) => row.id), ['b', 'a', 'c']);
  assert.deepEqual(sortChecklistItems([{ ...rows[0], dueDate: '2027-01-01' }, { ...rows[1], dueDate: '2027-01-01' }]).map((row) => row.id), ['a', 'b']);
  assert.equal(rows[0].id, 'b', 'sorting does not mutate the source array');
  assert.equal(formatChecklistDate(null), 'Not provided');
  assert.equal(formatChecklistDate('2027-01-04'), '01/04/2027');
  assert.equal(calendarDay('2027-02-30'), null);
  assert.equal(calendarDay('2027-01-04Tbad'), null);
});

test('Trifecta follows the exact three-task baseline and keeps a denominator of three', () => {
  const rows = TRIFECTA_TASKS.map((description) => ({ description, functionName: CHECKLIST_FUNCTIONS[0], status: 'Completed' }));
  assert.deepEqual(calculateTrifecta(rows), { completed: 3, total: 3 });
  assert.deepEqual(calculateTrifecta([]), { completed: 0, total: 3 });
  assert.equal(calculateTrifecta([{ ...rows[0], functionName: 'Medical' }, { ...rows[1], status: 'Not Started' }]).completed, 0);
  assert.equal(calculateTrifecta([rows[0], rows[0]]).completed, 2, 'duplicate records preserve the PRD baseline pending a business decision');
});

const stakeholder = (hcp, overrides = {}) => ({ KPH_Account__c: hcp, KPH_MM_Target__c: 'Yes', KPH_MM_HCP_Classification__c: 'Influencer; CAR-T Treater', ...overrides });
test('reach deduplicates HCPs and 15/18-character IDs and excludes ineligible stakeholders', () => {
  const hcp = '001000000000011';
  const rows = [
    stakeholder(hcp), stakeholder(`${hcp}AAA`), stakeholder('001000000000012', { KPH_Is_Deleted__c: true }),
    stakeholder('001000000000013', { KPH_MM_Target__c: 'No' }), stakeholder('001000000000014', { KPH_MM_HCP_Classification__c: 'Former CAR T Treater' }),
    stakeholder('', {}), stakeholder('001000000000015', { KPH_MM_Target__c: 'true', KPH_Is_Deleted__c: 'false' }),
  ];
  assert.equal(eligibleReachHcpIds(rows).length, 2);
  assert.deepEqual(calculateReach(rows, [
    { Account_vod__c: hcp, Call_Date_vod__c: '2027-04-04' },
    { Account_vod__c: `${hcp}AAA`, Call_Date_vod__c: '2027-04-03' },
    { Account_vod__c: '001000000000012', Call_Date_vod__c: '2027-04-04' },
  ], new Date(2027, 3, 5)), { reached: 1, total: 2 });
  assert.deepEqual(calculateReach([], []), { reached: 0, total: 0 });
});

test('reach uses launch, future-date, and strict 59/60 calendar-day boundaries', () => {
  const today = new Date(2027, 3, 5, 12);
  const dayAgo = (days) => new Date(Date.UTC(2027, 3, 5 - days)).toISOString().slice(0, 10);
  const ids = ['001000000000011', '001000000000012', '001000000000013', '001000000000014'];
  const rows = ids.map((id) => stakeholder(id));
  assert.deepEqual(calculateReach(rows, [
    { Account_vod__c: ids[0], Call_Date_vod__c: dayAgo(59) },
    { Account_vod__c: ids[1], Call_Date_vod__c: dayAgo(60) },
    { Account_vod__c: ids[2], Call_Date_vod__c: '2027-04-06' },
    { Account_vod__c: ids[3], Call_Date_vod__c: '2027-02-30' },
  ], today), { reached: 1, total: 4 });
  for (const [date, expected] of [['2027-01-03', 0], ['2027-01-04', 1], ['2027-01-06', 0]]) {
    assert.equal(calculateReach([rows[0]], [{ Account_vod__c: ids[0], Call_Date_vod__c: date }], new Date(2027, 0, 5)).reached, expected);
  }
  assert.equal(calculateReach([rows[0]], [{ Account_vod__c: ids[0], Call_Date_vod__c: '2026-11-12' }], new Date(2026, 10, 12)).reached, 0);
  assert.equal(calendarDay(new Date(2027, 2, 15)) - calendarDay(new Date(2027, 2, 14)), 1, 'DST does not change calendar-day age');
});

test('loader queries the selected Account and supported functions and rejects missing context or query errors', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { service, stubs } = await loadService();
  let query;
  stubs.runQuery = async (params) => {
    if (params.object === 'Account') return [];
    query = params;
    return [rawItem(), rawItem({ Id: 'other', KPH_Account__c: '001000000000002' }), rawItem({ Id: 'bad', KPH_Checklist_Item__c: '' })];
  };
  const result = await service.loadPostCallExecution();
  assert.equal(result.planId, planId);
  assert.equal(result.accountId, accountId);
  assert.equal(result.checklistItems.length, 1);
  assert.equal(query.object, 'KPH_Post_Launch_Checklist_Item__c');
  assert.match(query.where, /KPH_Account__c = '001000000000001'/);
  assert.match(query.where, /KPH_Checklist_Function__c IN \{'Commercial\/Market Access','Medical'\}/);
  assert.ok(query.fields.every((field) => !field.includes('.')));
  assert.equal(new Set(query.fields).size, query.fields.length);
  await assert.rejects(service.fetchPostLaunchChecklist(null), /No Account is linked/);
  stubs.context = { planId, account: null, plan: {} };
  await assert.rejects(service.loadPostCallExecution(), /No Account is linked/);
  stubs.runQuery = async () => { throw new Error('Access denied'); };
  await assert.rejects(service.fetchPostLaunchChecklist(accountId), /Access denied/);
});

test('checklist loads the selected Account MM Certification Date from its exact CRM field', async () => {
  const { service, queries, writes, stubs } = await loadService();
  let date = '2026-11-16';
  stubs.runQuery = async (params) => {
    queries.push(params);
    if (params.object === 'Account') return [
      { Id: { value: '001000000000002' }, MM_Certification_Date__c: { value: '2000-01-01' } },
      { Id: { value: `${accountId}AAA` }, MM_Certification_Date__c: { value: date } },
    ];
    return [rawItem()];
  };
  const loaded = await service.loadPostCallExecution();
  assert.equal(loaded.milestones.mmCertificationDate, date);
  assert.equal(loaded.milestones.mmCertificationDateStatus, 'ready');
  assert.equal(loaded.checklistItems.length, 1);
  const query = queries.find((params) => params.object === 'Account');
  assert.deepEqual(query.fields, ['Id', 'MM_Certification_Date__c']);
  assert.match(query.where, /Id = '001000000000001'/);
  assert.equal(query.limit, 1);
  assert.equal(writes.length, 0, 'the date is maintained on Account and read-only in the checklist');
  date = '2026-11-17';
  assert.equal((await service.loadPostCallExecution()).milestones.mmCertificationDate, date,
    'reloading reads the latest CRM value rather than retaining the previous certification date');
});

test('MM certification treats blank dates as empty and inaccessible or invalid data as unavailable', async (t) => {
  t.mock.method(console, 'error', () => {});
  const samples = [
    { row: { Id: accountId, MM_Certification_Date__c: null }, status: 'ready' },
    { row: { Id: accountId, MM_Certification_Date__c: '' }, status: 'ready' },
    { row: { Id: accountId }, status: 'unavailable' },
    { row: { Id: accountId, MM_Certification_Date__c: '2026-02-30' }, status: 'unavailable' },
    { row: { Id: '001000000000002', MM_Certification_Date__c: '2026-11-16' }, status: 'unavailable' },
    { row: null, status: 'unavailable' },
    { error: new Error('Field is not available on this device'), status: 'unavailable' },
  ];
  for (const sample of samples) {
    const { service } = await loadService({ runQuery: async ({ object }) => {
      if (object !== 'Account') return [rawItem()];
      if (sample.error) throw sample.error;
      return sample.row ? [sample.row] : [];
    } });
    const loaded = await service.loadPostCallExecution();
    assert.equal(loaded.milestones.mmCertificationDate, null);
    assert.equal(loaded.milestones.mmCertificationDateStatus, sample.status);
    assert.equal(loaded.checklistItems.length, 1, 'date-field unavailability does not hide the checklist');
  }
});

test('MM certification follows the Account selected by the current plan, including plan-only context', async () => {
  const secondAccountId = '001000000000002';
  const { service, stubs } = await loadService({ runQuery: async ({ object, where }) => {
    if (object !== 'Account') return [];
    return where.includes(secondAccountId)
      ? [{ Id: secondAccountId, MM_Certification_Date__c: '2026-10-02' }]
      : [{ Id: accountId, MM_Certification_Date__c: '2026-11-16' }];
  } });
  assert.equal((await service.loadPostCallExecution()).milestones.mmCertificationDate, '2026-11-16');
  stubs.context = { planId, account: null, plan: { id: planId, accountId: secondAccountId } };
  const second = await service.loadPostCallExecution();
  assert.equal(second.accountId, secondAccountId);
  assert.equal(second.milestones.mmCertificationDate, '2026-10-02');
});

test('writes allow only editable fields, validate statuses and comment length, and preserve clearing and multiline text', async () => {
  const { service, writes } = await loadService();
  await service.savePostLaunchChecklistItem(item, { status: 'Completed' });
  await service.savePostLaunchChecklistItem(item, { comments: 'a'.repeat(255) });
  await service.savePostLaunchChecklistItem(item, { comments: 'Line 1\nLine 2' });
  await service.savePostLaunchChecklistItem(item, { comments: '' });
  assert.deepEqual(writes.map((args) => args[2]), [{ KPH_Status__c: 'Completed' }, { KPH_Comments__c: 'a'.repeat(255) }, { KPH_Comments__c: 'Line 1\nLine 2' }, { KPH_Comments__c: '' }]);
  assert.equal(writes[0][0], 'KPH_Post_Launch_Checklist_Item__c');
  assert.equal(writes[0][1], item.id);
  for (const changes of [{ status: 'In Progress' }, { status: '' }, { comments: 'a'.repeat(256) }, { comments: null }, { dueDate: '2027-01-01' }, {}, { status: 'Completed', accountId: 'other' }]) {
    await assert.rejects(service.savePostLaunchChecklistItem(item, changes));
  }
  await assert.rejects(service.savePostLaunchChecklistItem({ id: item.id }, { status: 'Completed' }));
  assert.equal(writes.length, 4);
});

test('same-record writes serialize while different rows save independently', async () => {
  const gate = deferred();
  const events = [];
  const { service } = await loadService({ updateRecord: async (object, id, fields) => {
    events.push([id, fields]);
    if (id === item.id && 'KPH_Status__c' in fields) await gate.promise;
    return { success: true };
  } });
  const status = service.savePostLaunchChecklistItem(item, { status: 'Completed' });
  const comments = service.savePostLaunchChecklistItem(item, { comments: 'Updated' });
  const another = service.savePostLaunchChecklistItem({ ...item, id: 'aPL000000000002' }, { comments: 'Independent' });
  await another;
  assert.equal(events.length, 2);
  gate.resolve();
  assert.deepEqual(await status, { status: 'Completed' });
  assert.deepEqual(await comments, { comments: 'Updated' });
  assert.deepEqual(events[2], [item.id, { KPH_Comments__c: 'Updated' }]);
});

test('a failed write does not poison the row queue, and explicit CRM failures reject', async () => {
  let count = 0;
  const { service } = await loadService({ updateRecord: async () => { if (++count === 1) throw new Error('Offline write failed'); return { success: true }; } });
  const failure = service.savePostLaunchChecklistItem(item, { status: 'Completed' });
  const recovery = service.savePostLaunchChecklistItem(item, { comments: 'Retry' });
  await assert.rejects(failure, /Offline write failed/);
  assert.deepEqual(await recovery, { comments: 'Retry' });
  const failedCrm = await loadService({ updateRecord: async () => ({ success: false }) });
  await assert.rejects(failedCrm.service.savePostLaunchChecklistItem(item, { status: 'Completed' }), /CRM could not save/);
});

test('a read racing status and comment writes preserves both successful fields', async () => {
  const readGate = deferred(), readStarted = deferred();
  const { service } = await loadService({ runQuery: async () => { readStarted.resolve(); await readGate.promise; return [rawItem()]; } });
  const reading = service.fetchPostLaunchChecklist(accountId);
  await readStarted.promise;
  await service.savePostLaunchChecklistItem(item, { status: 'Completed' });
  await service.savePostLaunchChecklistItem(item, { comments: 'Latest comment' });
  readGate.resolve();
  const [row] = await reading;
  assert.equal(row.status, 'Completed');
  assert.equal(row.comments, 'Latest comment');
});

test('return navigation waits for pending Account writes before querying persisted values', async () => {
  const gate = deferred();
  let queried = false;
  const { service } = await loadService({
    updateRecord: async () => { await gate.promise; return { success: true }; },
    runQuery: async () => { queried = true; return [rawItem()]; },
  });
  const writing = service.savePostLaunchChecklistItem(item, { comments: 'Saved after navigation' });
  const reading = service.fetchPostLaunchChecklist(accountId);
  await Promise.resolve();
  assert.equal(queried, false);
  gate.resolve();
  await writing;
  assert.equal((await reading)[0].comments, 'Saved after navigation');
});

test('reach stays plan scoped and queries both HCP ID forms without filtering call status', async () => {
  const hcp = '001000000000011';
  const queries = [];
  const { service } = await loadService({ runQuery: async (params) => {
    queries.push(params);
    if (params.object === 'KPH_Stakeholder_Map__c') return [
      { ...stakeholder(hcp), KPH_Account_Plan__c: planId },
      { ...stakeholder('001000000000012'), KPH_Account_Plan__c: 'another-plan' },
    ];
    return [{ Account_vod__c: `${hcp}AAA`, Call_Date_vod__c: '2027-01-04' }];
  } });
  assert.deepEqual(await service.loadPostLaunchReach(planId, new Date(2027, 0, 5)), { reached: 1, total: 1 });
  assert.match(queries[0].where, /KPH_Account_Plan__c/);
  assert.match(queries[1].where, /001000000000011AAA/);
  assert.match(queries[1].where, /'001000000000011'/);
  assert.ok(!queries[1].where.includes('Status'));
  await assert.rejects(service.loadPostLaunchReach(null), /Select an account plan/);
});
