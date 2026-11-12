import {
  buildIdMatchWhere,
  inClause,
  runQuery,
  salesforceIdVariants,
  unwrap,
  updateRecord,
} from '@/lib/dataservice/query';
import { assertApprovalCommentLength } from '@/lib/approvalComments';

export const ACCOUNT_PLAN_OBJECT = 'Account_Plan_vod__c';
export const ACCOUNT_PLAN_SUBMITTED_FIELD = 'KPH_Is_Submitted__c';
export const ACCOUNT_PLAN_COMMENTS_FIELD = 'KPH_Comments__c';
export const ACCOUNT_PLAN_APPROVAL_STATUS_FIELD = 'KPH_Approval_Status__c';
export const ACCOUNT_PLAN_RECALLED_STATUS = 'Recalled';
export const ACCOUNT_PLAN_RECALLED_CRM_VALUE = 'Removed';
export const ACCOUNT_PLAN_RECALLED_RECORD_TYPE_ID = '012VI00000FPARnYAP';
export const APPROVAL_HISTORY_OBJECT = 'KPH_Account_Plan_Approval_History__c';
export const APPROVAL_HISTORY_ACCOUNT_PLAN_FIELD = 'KPH_Account_Plan__c';
export const APPROVAL_HISTORY_APPROVAL_STEP_FIELD = 'KPH_Approval_Step__c';
export const APPROVAL_HISTORY_ASSIGNED_TO_FIELD = 'KPH_Assigned_To__c';
export const APPROVAL_HISTORY_COMMENTS_FIELD = 'KPH_Comments__c';
export const APPROVAL_HISTORY_RECORD_TYPE_FIELD = 'RecordTypeId';
export const APPROVAL_HISTORY_STATUS_FIELD = 'KPH_Status__c';
export const APPROVAL_HISTORY_PENDING_STATUS = 'Pending';
export const APPROVAL_HISTORY_REASSIGNED_STATUS = 'Reassigned';
export const APPROVAL_HISTORY_ACTIONABLE_STATUSES = Object.freeze([
  APPROVAL_HISTORY_PENDING_STATUS,
  APPROVAL_HISTORY_REASSIGNED_STATUS,
]);
export const CTAM_MANAGER_PROFILE_ID = '00e41000000XrXcAAK';
export const REASSIGNED_RECORD_TYPE_NAME = 'Reassigned';
export const APPROVAL_HISTORY_FIELDS = Object.freeze([
  'Id',
  'KPH_Comments__c',
  'CreatedDate',
  'KPH_Assigned_To__c',
  'KPH_Actual_Approver__c',
  APPROVAL_HISTORY_STATUS_FIELD,
]);
export const ACCOUNT_PLAN_APPROVAL_REVIEW_FIELDS = Object.freeze([
  'Id',
  'Name',
  'KPH_Approval_Status__c',
  'KPH_Comments__c',
  'KPH_Submitted_Dates__c',
  'KPH_Approval_Due_Date__c',
  'KPH_Last_MPD_Review_Date__c',
  'KPH_Last_Account_Insight_Update__c',
  'KPH_Last_Critical_Acitivity_Update__c',
  'KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c',
  'KPH_Last_Internal_POD_Meeting_Update__c',
]);

export const MANAGER_APPROVAL_STEP_BY_ACTION = Object.freeze({
  Approved: 'Approve',
  Rejected: 'Reject',
  Reassigned: 'Reassign',
});
export const MANAGER_APPROVAL_STATUS_BY_ACTION = Object.freeze({
  Approved: 'Approved',
  Rejected: 'Rejected',
  Reassigned: 'Reassigned',
});
export const MANAGER_APPROVAL_RECORD_TYPE_ID_BY_ACTION = Object.freeze({
  Approved: '012VI00000FPARlYAP',
  Rejected: '012VI00000FPARpYAP',
});

const readableError = (error) =>
  (error && (error.message || error.errorMessage || error.msg)) ||
  (typeof error === 'string' ? error : null) ||
  'unknown error';

export const fetchCtamManagerUsers = async () => {
  const rows = await runQuery({
    object: 'User',
    fields: ['Id', 'Name'],
    where: `Profile_Id_vod__c = '${CTAM_MANAGER_PROFILE_ID}'`,
    sort: ['Name ASC'],
  });

  return (rows || [])
    .map((row) => {
      const user = unwrap(row) || {};
      const id = String(user.Id || '').trim();
      const name = String(user.Name || '').trim();
      return id && name ? { id, name } : null;
    })
    .filter(Boolean);
};

const resolveManagerApprovalRecordTypeId = async (action) => {
  const configuredId = MANAGER_APPROVAL_RECORD_TYPE_ID_BY_ACTION[action];
  if (configuredId) return configuredId;
  if (action !== 'Reassigned') return null;

  const rows = await runQuery({
    object: 'RecordType',
    fields: ['Id'],
    where: `Name = '${REASSIGNED_RECORD_TYPE_NAME}'`,
    limit: 1,
  });
  const recordType = unwrap(rows?.[0]) || {};
  if (!recordType.Id) {
    throw new Error(`No RecordType named "${REASSIGNED_RECORD_TYPE_NAME}" was found.`);
  }
  return recordType.Id;
};

const idVariants = (value) => {
  const id = String(value || '').trim();
  if (!id) return [];
  const variants = salesforceIdVariants(id);
  return variants.length ? variants : [id];
};

const userNameForId = (userNamesById, userId) => {
  for (const candidate of idVariants(userId)) {
    const name = userNamesById.get(candidate);
    if (name) return name;
  }
  return '';
};

const fetchUserNamesForApprovalHistory = async (rows) => {
  const userIds = Array.from(new Set(
    (rows || []).flatMap((row) => {
      const record = unwrap(row) || {};
      return [record.KPH_Assigned_To__c, record.KPH_Actual_Approver__c]
        .flatMap(idVariants);
    })
  ));
  if (!userIds.length) return new Map();

  const userRows = await runQuery({
    object: 'User',
    fields: ['Id', 'Name'],
    where: `Id IN ${inClause(userIds)}`,
    sort: ['Name ASC'],
  });
  const userNamesById = new Map();
  for (const row of userRows || []) {
    const user = unwrap(row) || {};
    const name = String(user.Name || '').trim();
    if (!user.Id || !name) continue;
    for (const candidate of idVariants(user.Id)) {
      userNamesById.set(candidate, name);
    }
  }
  return userNamesById;
};

const toApprovalHistoryEntry = (row, index, userNamesById = new Map()) => {
  const record = unwrap(row) || {};
  const createdDate = record.CreatedDate || '';
  const assignedToId = record.KPH_Assigned_To__c || '';
  const actualApproverId = record.KPH_Actual_Approver__c || '';
  return {
    id: record.Id || `${actualApproverId || assignedToId || 'approval-history'}-${createdDate || 'undated'}-${index}`,
    assignedToId,
    assignedTo: userNameForId(userNamesById, assignedToId),
    actualApproverId,
    actualApprover: userNameForId(userNamesById, actualApproverId),
    status: record.KPH_Status__c || '',
    comments: record.KPH_Comments__c || '',
    createdDate,
  };
};

const toAccountPlanApprovalReview = (row) => {
  const record = unwrap(row) || {};
  if (!record.Id) return null;
  return {
    id: record.Id,
    name: record.Name || 'Account Plan',
    approvalStatus: record.KPH_Approval_Status__c || null,
    comments: record.KPH_Comments__c || null,
    submittedDate: record.KPH_Submitted_Dates__c || null,
    approvalDueDate: record.KPH_Approval_Due_Date__c || null,
    lastMpdReviewDate: record.KPH_Last_MPD_Review_Date__c || null,
    lastAccountInsightUpdate: record.KPH_Last_Account_Insight_Update__c || null,
    lastAdditionalCriticalActivityUpdate: record.KPH_Last_Critical_Acitivity_Update__c || null,
    lastBarrierTacticalActionUpdate: record.KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c || null,
    lastInternalPodMeetingUpdate: record.KPH_Last_Internal_POD_Meeting_Update__c || null,
  };
};

const accountPlanApprovalReviewQuery = (planId) => ({
  object: ACCOUNT_PLAN_OBJECT,
  fields: ACCOUNT_PLAN_APPROVAL_REVIEW_FIELDS,
  where: buildIdMatchWhere('Id', planId),
  limit: 1,
});

export const fetchAccountPlanApprovalReview = async (planId) => {
  if (!planId) throw new Error('Missing account plan id.');

  try {
    const rows = await runQuery(accountPlanApprovalReviewQuery(planId));
    const review = toAccountPlanApprovalReview(rows[0]);
    if (!review) throw new Error('No approval review data was found for this Account Plan.');
    return review;
  } catch (error) {
    throw new Error(`Could not load approval review: ${readableError(error)}`);
  }
};

export const fetchAccountPlanApprovalHistory = async (planId) => {
  if (!planId) throw new Error('Missing account plan id.');

  try {
    const rows = await runQuery({
      object: APPROVAL_HISTORY_OBJECT,
      fields: APPROVAL_HISTORY_FIELDS,
      where: buildIdMatchWhere(APPROVAL_HISTORY_ACCOUNT_PLAN_FIELD, planId),
      sort: ['CreatedDate DESC'],
    });
    const userNamesById = await fetchUserNamesForApprovalHistory(rows);

    return rows
      .map((row, index) => toApprovalHistoryEntry(row, index, userNamesById))
      .sort((left, right) => {
        const leftTime = Date.parse(left.createdDate) || 0;
        const rightTime = Date.parse(right.createdDate) || 0;
        return rightTime - leftTime;
      });
  } catch (error) {
    throw new Error(`Could not load approval history: ${readableError(error)}`);
  }
};

const fetchLatestActionableApprovalHistoryRecord = async (planId) => {
  const planWhere = buildIdMatchWhere(APPROVAL_HISTORY_ACCOUNT_PLAN_FIELD, planId);
  const rows = await runQuery({
    object: APPROVAL_HISTORY_OBJECT,
    fields: ['Id', APPROVAL_HISTORY_STATUS_FIELD, 'CreatedDate'],
    where: `(${planWhere}) AND ${APPROVAL_HISTORY_STATUS_FIELD} IN ${inClause(APPROVAL_HISTORY_ACTIONABLE_STATUSES)}`,
    sort: ['CreatedDate DESC'],
    limit: 1,
  });

  return rows
    .map((row) => unwrap(row) || {})
    .filter((record) => APPROVAL_HISTORY_ACTIONABLE_STATUSES.includes(record[APPROVAL_HISTORY_STATUS_FIELD]))
    .sort((left, right) => {
      const leftTime = Date.parse(left.CreatedDate) || 0;
      const rightTime = Date.parse(right.CreatedDate) || 0;
      return rightTime - leftTime;
    })[0] || null;
};

export const submitMpdApproval = async ({ planId, comments }) => {
  const trimmedComments = assertApprovalCommentLength(comments);
  if (!planId) throw new Error('Missing account plan id.');
  if (!trimmedComments) throw new Error('Comment is required.');

  try {
    await updateRecord(ACCOUNT_PLAN_OBJECT, planId, {
      [ACCOUNT_PLAN_SUBMITTED_FIELD]: true,
      [ACCOUNT_PLAN_COMMENTS_FIELD]: trimmedComments,
    });
  } catch (error) {
    throw new Error(`Could not submit MPD approval: ${readableError(error)}`);
  }

  return {
    planId,
  };
};

export const recallAccountPlanApproval = async ({ planId, comments }) => {
  const trimmedComments = assertApprovalCommentLength(comments);
  if (!planId) throw new Error('Missing account plan id.');
  if (!trimmedComments) throw new Error('Comment is required.');

  try {
    const latestActionableRecord = await fetchLatestActionableApprovalHistoryRecord(planId);
    if (!latestActionableRecord?.Id) {
      throw new Error('No Pending or Reassigned approval history record was found for this Account Plan.');
    }

    await updateRecord(APPROVAL_HISTORY_OBJECT, latestActionableRecord.Id, {
      [APPROVAL_HISTORY_APPROVAL_STEP_FIELD]: ACCOUNT_PLAN_RECALLED_STATUS,
      [APPROVAL_HISTORY_COMMENTS_FIELD]: trimmedComments,
      [APPROVAL_HISTORY_RECORD_TYPE_FIELD]: ACCOUNT_PLAN_RECALLED_RECORD_TYPE_ID,
      [APPROVAL_HISTORY_STATUS_FIELD]: ACCOUNT_PLAN_RECALLED_CRM_VALUE,
    });

    return {
      planId,
      approvalHistoryId: latestActionableRecord.Id,
      approvalStatus: ACCOUNT_PLAN_RECALLED_STATUS,
      isSubmitted: false,
      recordTypeId: ACCOUNT_PLAN_RECALLED_RECORD_TYPE_ID,
    };
  } catch (error) {
    throw new Error(`Could not recall Account Plan approval: ${readableError(error)}`);
  }
};

export const updateManagerApprovalStep = async ({ planId, action, comments, assigneeId }) => {
  if (!planId) throw new Error('Missing account plan id.');
  const approvalStep = MANAGER_APPROVAL_STEP_BY_ACTION[action];
  if (!approvalStep) throw new Error(`Unsupported manager approval action: ${action || 'blank'}.`);
  const approvalStatus = MANAGER_APPROVAL_STATUS_BY_ACTION[action] || null;
  const trimmedComments = assertApprovalCommentLength(comments);
  if (approvalStatus && !trimmedComments) {
    throw new Error('Comment is required for approval and rejection decisions.');
  }
  const selectedAssigneeId = String(assigneeId || '').trim();
  if (action === 'Reassigned' && !selectedAssigneeId) {
    throw new Error('Select a CTAM Manager.');
  }

  try {
    const latestActionableRecord = await fetchLatestActionableApprovalHistoryRecord(planId);

    if (!latestActionableRecord?.Id) {
      throw new Error('No Pending or Reassigned approval history record was found for this Account Plan.');
    }

    const recordTypeId = await resolveManagerApprovalRecordTypeId(action);
    const fields = {
      [APPROVAL_HISTORY_APPROVAL_STEP_FIELD]: approvalStep,
      [APPROVAL_HISTORY_COMMENTS_FIELD]: trimmedComments,
      [APPROVAL_HISTORY_RECORD_TYPE_FIELD]: recordTypeId,
      [APPROVAL_HISTORY_STATUS_FIELD]: approvalStatus,
    };
    if (action === 'Reassigned') {
      fields[APPROVAL_HISTORY_ASSIGNED_TO_FIELD] = selectedAssigneeId;
    }
    await updateRecord(APPROVAL_HISTORY_OBJECT, latestActionableRecord.Id, fields);

    return {
      planId,
      approvalHistoryId: latestActionableRecord.Id,
      approvalStep,
      approvalStatus,
      recordTypeId,
      ...(action === 'Reassigned' ? { assigneeId: selectedAssigneeId } : {}),
    };
  } catch (error) {
    throw new Error(`Could not save manager approval decision: ${readableError(error)}`);
  }
};
