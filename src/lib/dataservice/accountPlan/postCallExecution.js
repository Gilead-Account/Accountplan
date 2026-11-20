import { buildIdMatchWhere, inClause, runQuery, salesforceIdVariants, unwrap, updateRecord } from '@/lib/dataservice/query';
import { requireCurrentAccountPlanId, resolveShellContextForPlanId } from '@/lib/dataservice/accountPlan/shared';
import {
  CHECKLIST_COMMENT_LIMIT, CHECKLIST_FUNCTIONS, CHECKLIST_STATUSES,
  calculateReach, calendarDay, checklistRecordKey, eligibleReachHcpIds, normalizeChecklistStatus, sortChecklistItems,
} from '@/lib/postLaunchChecklist';

export const POST_LAUNCH_OBJECT = 'KPH_Post_Launch_Checklist_Item__c';
export const POST_LAUNCH_FIELDS = [
  'Id', 'KPH_Checklist_Function__c', 'KPH_Checklist_Item__c', 'KPH_Accountable__c',
  'KPH_Due_Date__c', 'KPH_Status__c', 'KPH_Comments__c', 'KPH_Account__c',
];
const MM_CERTIFICATION_DATE_FIELD = 'MM_Certification_Date__c';

const sameId = (a, b) => Boolean(a && b) && checklistRecordKey(a) === checklistRecordKey(b);
const writeQueues = new Map();
const pendingByAccount = new Map();
// Only successful, field-level patches are retained to reconcile reads racing saves.
const committed = new Map();
let revision = 0;

export const toChecklistItem = (raw) => {
  const row = unwrap(raw);
  const description = String(row?.KPH_Checklist_Item__c || '').trim();
  if (!row?.Id || !description || !CHECKLIST_FUNCTIONS.includes(row.KPH_Checklist_Function__c)) return null;
  return {
    id: row.Id, accountId: row.KPH_Account__c,
    functionName: row.KPH_Checklist_Function__c, description,
    accountable: String(row.KPH_Accountable__c || '').trim(), dueDate: row.KPH_Due_Date__c || null,
    status: normalizeChecklistStatus(row.KPH_Status__c), comments: String(row.KPH_Comments__c ?? ''),
  };
};

const waitForAccountWrites = async (accountId) => {
  const key = checklistRecordKey(accountId);
  while (pendingByAccount.get(key)?.size) {
    await Promise.allSettled([...pendingByAccount.get(key)]);
  }
};

export const fetchPostLaunchChecklist = async (accountId) => {
  if (!accountId) throw new Error('No Account is linked to this plan. Open an account plan linked to an Account and try again.');
  const startedAt = revision;
  await waitForAccountWrites(accountId);
  const rows = await runQuery({
    object: POST_LAUNCH_OBJECT, fields: POST_LAUNCH_FIELDS,
    where: `${buildIdMatchWhere('KPH_Account__c', accountId)} AND KPH_Checklist_Function__c IN ${inClause(CHECKLIST_FUNCTIONS)}`,
    sort: ['KPH_Due_Date__c ASC', 'KPH_Checklist_Item__c ASC'],
  });
  await waitForAccountWrites(accountId);
  return sortChecklistItems(rows.map(toChecklistItem)
    .filter((row) => row && sameId(row.accountId, accountId))
    .map((row) => {
      const patches = committed.get(checklistRecordKey(row.id));
      if (!patches || !sameId(patches.accountId, accountId)) return row;
      const latest = { ...row };
      for (const [field, saved] of Object.entries(patches.fields)) {
        if (saved.revision > startedAt) latest[field] = saved.value;
      }
      return latest;
    }));
};

const fetchCertificationMilestone = async (accountId) => {
  const unavailable = { mmCertificationDate: null, mmCertificationDateStatus: 'unavailable' };
  const where = buildIdMatchWhere('Id', accountId);
  if (!where) return unavailable;
  try {
    // Isolate this new Account field so missing FLS/offline metadata cannot
    // prevent the existing checklist or shared Account header from loading.
    const rows = await runQuery({
      object: 'Account', fields: ['Id', MM_CERTIFICATION_DATE_FIELD], where, limit: 1,
    });
    const account = rows.map(unwrap).find((row) => sameId(row?.Id, accountId));
    if (!account || !Object.prototype.hasOwnProperty.call(account, MM_CERTIFICATION_DATE_FIELD)) return unavailable;
    const value = account[MM_CERTIFICATION_DATE_FIELD];
    if (value !== null && value !== '' && calendarDay(value) === null) return unavailable;
    return { mmCertificationDate: value || null, mmCertificationDateStatus: 'ready' };
  } catch {
    return unavailable;
  }
};

export const loadPostCallExecution = async () => {
  const selectedPlanId = await requireCurrentAccountPlanId();
  const context = await resolveShellContextForPlanId(selectedPlanId);
  const accountId = context.account?.id || context.plan?.accountId;
  const [checklistItems, milestones] = await Promise.all([
    fetchPostLaunchChecklist(accountId),
    fetchCertificationMilestone(accountId),
  ]);
  return { ...context, accountId, checklistItems, milestones };
};

export const savePostLaunchChecklistItem = (item, changes) => {
  if (!item?.id || !item?.accountId) return Promise.reject(new Error('This checklist record has no Account or record identifier. Reopen the checklist and try again.'));
  const keys = Object.keys(changes || {});
  if (!keys.length || keys.some((key) => !['status', 'comments'].includes(key))) {
    return Promise.reject(new Error('Only checklist status and comments can be updated.'));
  }
  if ('status' in changes && !CHECKLIST_STATUSES.includes(changes.status)) {
    return Promise.reject(new Error('Select Not Started or Completed.'));
  }
  if ('comments' in changes && (typeof changes.comments !== 'string' || changes.comments.length > CHECKLIST_COMMENT_LIMIT)) {
    return Promise.reject(new Error(`Comments must contain no more than ${CHECKLIST_COMMENT_LIMIT} characters.`));
  }
  const patch = { ...changes };
  const fields = {};
  if ('status' in patch) fields.KPH_Status__c = patch.status;
  if ('comments' in patch) fields.KPH_Comments__c = patch.comments;
  const key = checklistRecordKey(item.id);
  const accountKey = checklistRecordKey(item.accountId);
  const previous = writeQueues.get(key) || Promise.resolve();
  const request = previous.catch(() => {}).then(async () => {
    const result = await updateRecord(POST_LAUNCH_OBJECT, item.id, fields);
    if (result?.success === false || result?.data?.success === false) throw new Error('CRM could not save this checklist update. Please try again.');
    const saved = committed.get(key) || { accountId: item.accountId, fields: {} };
    for (const [field, value] of Object.entries(patch)) saved.fields[field] = { value, revision: ++revision };
    committed.set(key, saved);
    return patch;
  });
  writeQueues.set(key, request);
  if (!pendingByAccount.has(accountKey)) pendingByAccount.set(accountKey, new Set());
  pendingByAccount.get(accountKey).add(request);
  const cleanup = () => {
    if (writeQueues.get(key) === request) writeQueues.delete(key);
    const pending = pendingByAccount.get(accountKey);
    pending?.delete(request);
    if (!pending?.size) pendingByAccount.delete(accountKey);
  };
  // Both branches handle cleanup without creating an unhandled rejection.
  request.then(cleanup, cleanup);
  return request;
};

export const loadPostLaunchReach = async (planId, now = new Date()) => {
  if (!planId) throw new Error('Select an account plan to load treater reach.');
  const stakeholders = (await runQuery({
    object: 'KPH_Stakeholder_Map__c',
    fields: ['Id', 'KPH_Account_Plan__c', 'KPH_Account__c', 'KPH_MM_Target__c', 'KPH_MM_HCP_Classification__c', 'KPH_Is_Deleted__c'],
    where: `${buildIdMatchWhere('KPH_Account_Plan__c', planId)} AND (KPH_Is_Deleted__c = false OR KPH_Is_Deleted__c = null)`,
  })).map(unwrap).filter((row) => row && sameId(row.KPH_Account_Plan__c, planId));
  const ids = eligibleReachHcpIds(stakeholders);
  const calls = [];
  // Bound each query for accounts with large stakeholder maps; use both ID forms.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const variants = [...new Set(ids.slice(offset, offset + 100).flatMap((id) => salesforceIdVariants(id).length ? salesforceIdVariants(id) : [id]))];
    calls.push(...(await runQuery({
      object: 'Call2_vod__c', fields: ['Id', 'Account_vod__c', 'Call_Date_vod__c'],
      where: `Account_vod__c IN ${inClause(variants)}`,
    })).map(unwrap).filter(Boolean));
  }
  return calculateReach(stakeholders, calls, now);
};
