import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const approvalModulePath = new URL('../src/lib/dataservice/accountPlan/approval.js', import.meta.url);
const approvalCommentsModulePath = new URL('../src/lib/approvalComments.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadApprovalModule = async ({
  processRows = [{ Id: 'pi-001', Status: 'Pending' }],
  userRows = [],
  recordTypeRows = [],
} = {}) => {
  globalThis.__mpdApprovalCalls = [];
  globalThis.__mpdApprovalQueries = [];
  globalThis.__mpdApprovalProcessRows = processRows;
  globalThis.__mpdApprovalUserRows = userRows;
  globalThis.__mpdApprovalRecordTypeRows = recordTypeRows;

  const queryStubUrl = dataModule(`
    export const buildIdMatchWhere = (field, id) => field + " = '" + id + "'";
    export const inClause = (values) => "(" + values.map((value) => "'" + value + "'").join(',') + ")";
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const runQuery = (params) => {
      globalThis.__mpdApprovalQueries.push(params);
      if (params.object === 'User') {
        return Promise.resolve(globalThis.__mpdApprovalUserRows || []);
      }
      if (params.object === 'RecordType') {
        return Promise.resolve(globalThis.__mpdApprovalRecordTypeRows || []);
      }
      return Promise.resolve(globalThis.__mpdApprovalProcessRows || []);
    };
    export const unwrap = (row) => Object.fromEntries(
      Object.entries(row || {}).map(([key, cell]) => [
        key,
        cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'value')
          ? cell.value
          : cell,
      ])
    );
    export const updateRecord = (object, id, fields) => {
      globalThis.__mpdApprovalCalls.push({ type: 'update', object, id, fields });
      return Promise.resolve({ id });
    };
    export const createRecord = (object, fields) => {
      globalThis.__mpdApprovalCalls.push({ type: 'create', object, fields });
      return Promise.resolve({ id: 'step-001' });
    };
  `);

  const source = (await readFile(approvalModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(
      /from ['"]@\/lib\/approvalComments['"]/g,
      `from '${approvalCommentsModulePath.href}'`
    );

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return {
    mod,
    calls: globalThis.__mpdApprovalCalls,
    queries: globalThis.__mpdApprovalQueries,
  };
};

test('submitMpdApproval marks the account plan submitted and saves comments in one request', async () => {
  const { mod, calls, queries } = await loadApprovalModule();

  await mod.submitMpdApproval({
    planId: 'plan-001',
    comments: ' Please review this plan. ',
  });

  assert.equal(queries.length, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    type: 'update',
    object: mod.ACCOUNT_PLAN_OBJECT,
    id: 'plan-001',
    fields: {
      [mod.ACCOUNT_PLAN_SUBMITTED_FIELD]: true,
      [mod.ACCOUNT_PLAN_COMMENTS_FIELD]: 'Please review this plan.',
    },
  });
});

test('submitMpdApproval does not require a pending process instance', async () => {
  const { mod, calls, queries } = await loadApprovalModule({ processRows: [] });

  await mod.submitMpdApproval({ planId: 'plan-001', comments: 'Need MPD approval.' });

  assert.equal(queries.length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].object, mod.ACCOUNT_PLAN_OBJECT);
});

test('submitMpdApproval rejects comments over 1000 characters before writing', async () => {
  const { mod, calls } = await loadApprovalModule();

  await assert.rejects(
    mod.submitMpdApproval({ planId: 'plan-001', comments: 'x'.repeat(1001) }),
    /Comment must be 1000 characters or fewer/
  );
  assert.equal(calls.length, 0);
});

test('recallAccountPlanApproval restores the submitted plan to Recalled and saves the user comment', async () => {
  const { mod, calls, queries } = await loadApprovalModule({
    processRows: [{
      Id: 'history-pending-latest',
      CreatedDate: '2026-09-16T10:00:00Z',
      KPH_Status__c: 'Pending',
    }],
  });

  const result = await mod.recallAccountPlanApproval({
    planId: 'plan-001',
    comments: '  Updating the account plan before resubmission.  ',
  });

  assert.deepEqual(queries, [{
    object: mod.APPROVAL_HISTORY_OBJECT,
    fields: ['Id', mod.APPROVAL_HISTORY_STATUS_FIELD, 'CreatedDate'],
    where: "(KPH_Account_Plan__c = 'plan-001') AND KPH_Status__c IN ('Pending','Reassigned')",
    sort: ['CreatedDate DESC'],
    limit: 1,
  }]);
  assert.deepEqual(calls, [{
    type: 'update',
    object: mod.APPROVAL_HISTORY_OBJECT,
    id: 'history-pending-latest',
    fields: {
      [mod.APPROVAL_HISTORY_APPROVAL_STEP_FIELD]: 'Recalled',
      [mod.APPROVAL_HISTORY_COMMENTS_FIELD]: 'Updating the account plan before resubmission.',
      [mod.APPROVAL_HISTORY_RECORD_TYPE_FIELD]: '012VI00000FPARnYAP',
      [mod.APPROVAL_HISTORY_STATUS_FIELD]: 'Removed',
    },
  }]);
  assert.deepEqual(result, {
    planId: 'plan-001',
    approvalHistoryId: 'history-pending-latest',
    approvalStatus: 'Recalled',
    isSubmitted: false,
    recordTypeId: '012VI00000FPARnYAP',
  });
});

test('recallAccountPlanApproval recalls the latest Reassigned approval history record', async () => {
  const { mod, calls } = await loadApprovalModule({
    processRows: [{
      Id: 'history-reassigned-latest',
      CreatedDate: '2026-09-21T09:00:00Z',
      KPH_Status__c: 'Reassigned',
    }],
  });

  await mod.recallAccountPlanApproval({
    planId: 'plan-001',
    comments: 'Recall after reassignment.',
  });

  assert.equal(calls[0]?.id, 'history-reassigned-latest');
  assert.equal(calls[0]?.fields?.KPH_Status__c, 'Removed');
});

test('recallAccountPlanApproval requires a comment and enforces the shared 1000 character limit', async () => {
  const { mod, calls } = await loadApprovalModule();

  await assert.rejects(
    mod.recallAccountPlanApproval({ planId: 'plan-001', comments: '   ' }),
    /Comment is required/
  );
  await assert.rejects(
    mod.recallAccountPlanApproval({ planId: 'plan-001', comments: 'x'.repeat(1001) }),
    /Comment must be 1000 characters or fewer/
  );
  assert.equal(calls.length, 0);
});

for (const [action, expectedStep, expectedStatus, expectedRecordTypeId] of [
  ['Approved', 'Approve', 'Approved', '012VI00000FPARlYAP'],
  ['Rejected', 'Reject', 'Rejected', '012VI00000FPARpYAP'],
]) {
  test(`updateManagerApprovalStep writes comments and ${expectedStatus} to the latest Pending history record`, async () => {
    const { mod, calls, queries } = await loadApprovalModule({
      processRows: [
        {
          Id: 'history-approved-newer',
          CreatedDate: '2026-08-05T12:00:00Z',
          KPH_Status__c: 'Approved',
        },
        {
          Id: 'history-pending-older',
          CreatedDate: '2026-08-03T12:00:00Z',
          KPH_Status__c: 'Pending',
        },
        {
          Id: 'history-pending-latest',
          CreatedDate: '2026-08-04T12:00:00Z',
          KPH_Status__c: 'Pending',
        },
      ],
    });

    const result = await mod.updateManagerApprovalStep({
      planId: 'plan-001',
      action,
      comments: '  Manager decision comment.  ',
    });

    assert.deepEqual(queries, [{
      object: 'KPH_Account_Plan_Approval_History__c',
      fields: ['Id', 'KPH_Status__c', 'CreatedDate'],
      where: "(KPH_Account_Plan__c = 'plan-001') AND KPH_Status__c IN ('Pending','Reassigned')",
      sort: ['CreatedDate DESC'],
      limit: 1,
    }]);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      type: 'update',
      object: 'KPH_Account_Plan_Approval_History__c',
      id: 'history-pending-latest',
      fields: {
        KPH_Approval_Step__c: expectedStep,
        KPH_Comments__c: 'Manager decision comment.',
        RecordTypeId: expectedRecordTypeId,
        KPH_Status__c: expectedStatus,
      },
    });
    assert.deepEqual(result, {
      planId: 'plan-001',
      approvalHistoryId: 'history-pending-latest',
      approvalStep: expectedStep,
      approvalStatus: expectedStatus,
      recordTypeId: expectedRecordTypeId,
    });
  });
}

test('updateManagerApprovalStep reassigns the latest Pending history record to the selected manager', async () => {
  const { mod, calls, queries } = await loadApprovalModule({
    processRows: [{
      Id: 'history-pending-latest',
      CreatedDate: '2026-08-04T12:00:00Z',
      KPH_Status__c: 'Pending',
    }],
    recordTypeRows: [{ Id: { value: '012-reassigned' } }],
  });

  const result = await mod.updateManagerApprovalStep({
    planId: 'plan-001',
    action: 'Reassigned',
    comments: '  Route this to the regional manager.  ',
    assigneeId: '005-manager-002',
  });

  assert.deepEqual(queries, [
    {
      object: 'KPH_Account_Plan_Approval_History__c',
      fields: ['Id', 'KPH_Status__c', 'CreatedDate'],
      where: "(KPH_Account_Plan__c = 'plan-001') AND KPH_Status__c IN ('Pending','Reassigned')",
      sort: ['CreatedDate DESC'],
      limit: 1,
    },
    {
      object: 'RecordType',
      fields: ['Id'],
      where: "Name = 'Reassigned'",
      limit: 1,
    },
  ]);
  assert.deepEqual(calls, [{
    type: 'update',
    object: 'KPH_Account_Plan_Approval_History__c',
    id: 'history-pending-latest',
    fields: {
      KPH_Approval_Step__c: 'Reassign',
      KPH_Assigned_To__c: '005-manager-002',
      KPH_Comments__c: 'Route this to the regional manager.',
      RecordTypeId: '012-reassigned',
      KPH_Status__c: 'Reassigned',
    },
  }]);
  assert.deepEqual(result, {
    planId: 'plan-001',
    approvalHistoryId: 'history-pending-latest',
    approvalStep: 'Reassign',
    approvalStatus: 'Reassigned',
    recordTypeId: '012-reassigned',
    assigneeId: '005-manager-002',
  });
});

test('updateManagerApprovalStep allows a manager decision on a Reassigned history record', async () => {
  const { mod, calls } = await loadApprovalModule({
    processRows: [{
      Id: 'history-reassigned-latest',
      CreatedDate: '2026-09-21T09:00:00Z',
      KPH_Status__c: 'Reassigned',
    }],
  });

  await mod.updateManagerApprovalStep({
    planId: 'plan-001',
    action: 'Approved',
    comments: 'Approved after reassignment.',
  });

  assert.equal(calls[0]?.id, 'history-reassigned-latest');
  assert.equal(calls[0]?.fields?.KPH_Status__c, 'Approved');
});

test('updateManagerApprovalStep requires a selected manager for reassignment', async () => {
  const { mod, calls, queries } = await loadApprovalModule();

  await assert.rejects(
    mod.updateManagerApprovalStep({
      planId: 'plan-001',
      action: 'Reassigned',
      comments: 'Move this approval.',
      assigneeId: '',
    }),
    /Select a CTAM Manager/
  );
  assert.equal(queries.length, 0);
  assert.equal(calls.length, 0);
});

test('fetchCtamManagerUsers filters users by the exact Veeva profile id field', async () => {
  const { mod, queries } = await loadApprovalModule({
    userRows: [
      { Id: { value: '005-manager-002' }, Name: { value: 'Jordan Patel' } },
      { Id: { value: '005-manager-001' }, Name: { value: 'Morgan Lee' } },
    ],
  });

  const users = await mod.fetchCtamManagerUsers();

  assert.deepEqual(queries, [{
    object: 'User',
    fields: ['Id', 'Name'],
    where: "Profile_Id_vod__c = '00e41000000XrXcAAK'",
    sort: ['Name ASC'],
  }]);
  assert.deepEqual(users, [
    { id: '005-manager-002', name: 'Jordan Patel' },
    { id: '005-manager-001', name: 'Morgan Lee' },
  ]);
});

test('updateManagerApprovalStep requires comments for approval and rejection', async () => {
  const { mod, calls, queries } = await loadApprovalModule();

  await assert.rejects(
    mod.updateManagerApprovalStep({ planId: 'plan-001', action: 'Approved', comments: '   ' }),
    /Comment is required for approval and rejection decisions/
  );
  assert.equal(queries.length, 0);
  assert.equal(calls.length, 0);
});

test('updateManagerApprovalStep rejects comments over 1000 characters before querying or writing', async () => {
  const { mod, calls, queries } = await loadApprovalModule();

  await assert.rejects(
    mod.updateManagerApprovalStep({
      planId: 'plan-001',
      action: 'Approved',
      comments: 'x'.repeat(1001),
    }),
    /Comment must be 1000 characters or fewer/
  );
  assert.equal(queries.length, 0);
  assert.equal(calls.length, 0);
});

test('updateManagerApprovalStep fails without updating when no Pending or Reassigned history record exists', async () => {
  const { mod, calls, queries } = await loadApprovalModule({
    processRows: [{
      Id: 'history-rejected',
      CreatedDate: '2026-08-05T12:00:00Z',
      KPH_Status__c: 'Rejected',
    }],
  });

  await assert.rejects(
    mod.updateManagerApprovalStep({ planId: 'plan-001', action: 'Approved', comments: 'Approved.' }),
    /No Pending or Reassigned approval history record was found/
  );
  assert.equal(queries.length, 1);
  assert.equal(calls.length, 0);
});

test('updateManagerApprovalStep rejects unsupported decisions without writing', async () => {
  const { mod, calls } = await loadApprovalModule();

  await assert.rejects(
    mod.updateManagerApprovalStep({ planId: 'plan-001', action: 'Unknown' }),
    /Unsupported manager approval action/
  );
  assert.equal(calls.length, 0);
});

test('fetchAccountPlanApprovalHistory resolves assigned and actual approver IDs through User.Name', async () => {
  const { mod, queries } = await loadApprovalModule({
    processRows: [
      {
        KPH_Comments__c: 'Earlier review',
        CreatedDate: '2026-07-14T13:40:00Z',
        KPH_Assigned_To__c: 'user-001',
        KPH_Actual_Approver__c: 'approver-001',
        KPH_Status__c: 'Rejected',
      },
      {
        KPH_Comments__c: 'Latest review',
        CreatedDate: '2026-08-04T10:30:00Z',
        KPH_Assigned_To__c: 'user-002',
        KPH_Actual_Approver__c: 'approver-002',
        KPH_Status__c: 'Approved',
      },
    ],
    userRows: [
      { Id: 'user-001', Name: 'Priya Kumar' },
      { Id: 'approver-001', Name: 'Morgan Lee' },
      { Id: 'user-002', Name: 'Morgan Lee' },
      { Id: 'approver-002', Name: 'Jordan Patel' },
    ],
  });

  const result = await mod.fetchAccountPlanApprovalHistory('plan-001');

  assert.deepEqual(queries, [
    {
      object: 'KPH_Account_Plan_Approval_History__c',
      fields: [
        'Id',
        'KPH_Comments__c',
        'CreatedDate',
        'KPH_Assigned_To__c',
        'KPH_Actual_Approver__c',
        'KPH_Status__c',
      ],
      where: "KPH_Account_Plan__c = 'plan-001'",
      sort: ['CreatedDate DESC'],
    },
    {
      object: 'User',
      fields: ['Id', 'Name'],
      where: "Id IN ('user-001','approver-001','user-002','approver-002')",
      sort: ['Name ASC'],
    },
  ]);
  assert.deepEqual(result.map(({ assignedTo, actualApprover, status, comments, createdDate }) => ({
    assignedTo,
    actualApprover,
    status,
    comments,
    createdDate,
  })), [
    {
      assignedTo: 'Morgan Lee',
      actualApprover: 'Jordan Patel',
      status: 'Approved',
      comments: 'Latest review',
      createdDate: '2026-08-04T10:30:00Z',
    },
    {
      assignedTo: 'Priya Kumar',
      actualApprover: 'Morgan Lee',
      status: 'Rejected',
      comments: 'Earlier review',
      createdDate: '2026-07-14T13:40:00Z',
    },
  ]);
});

test('fetchAccountPlanApprovalHistory requires an Account Plan id before querying', async () => {
  const { mod, queries } = await loadApprovalModule();

  await assert.rejects(mod.fetchAccountPlanApprovalHistory(''), /Missing account plan id/);
  assert.equal(queries.length, 0);
});

test('fetchAccountPlanApprovalReview loads and maps the latest review fields for one Account Plan', async () => {
  const { mod, queries } = await loadApprovalModule({
    processRows: [{
      Id: 'plan-001',
      Name: 'FY26 Account Plan',
      KPH_Approval_Status__c: 'Submitted for Approval',
      KPH_Comments__c: 'Ready for review.',
      KPH_Submitted_Dates__c: '2026-08-04',
      KPH_Approval_Due_Date__c: '2026-08-12',
      KPH_Last_MPD_Review_Date__c: '2026-07-28',
      KPH_Last_Account_Insight_Update__c: '2026-07-29',
      KPH_Last_Critical_Acitivity_Update__c: '2026-07-30',
      KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c: '2026-07-31',
      KPH_Last_Internal_POD_Meeting_Update__c: '2026-08-01',
    }],
  });

  const result = await mod.fetchAccountPlanApprovalReview('plan-001');

  assert.deepEqual(queries, [{
    object: 'Account_Plan_vod__c',
    fields: [
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
    ],
    where: "Id = 'plan-001'",
    limit: 1,
  }]);
  assert.deepEqual(result, {
    id: 'plan-001',
    name: 'FY26 Account Plan',
    approvalStatus: 'Submitted for Approval',
    comments: 'Ready for review.',
    submittedDate: '2026-08-04',
    approvalDueDate: '2026-08-12',
    lastMpdReviewDate: '2026-07-28',
    lastAccountInsightUpdate: '2026-07-29',
    lastAdditionalCriticalActivityUpdate: '2026-07-30',
    lastBarrierTacticalActionUpdate: '2026-07-31',
    lastInternalPodMeetingUpdate: '2026-08-01',
  });
});

test('fetchAccountPlanApprovalReview requires an Account Plan id before querying', async () => {
  const { mod, queries } = await loadApprovalModule();

  await assert.rejects(mod.fetchAccountPlanApprovalReview(''), /Missing account plan id/);
  assert.equal(queries.length, 0);
});

test('fetchAccountPlanApprovalReview maps the nested iPad runQuery response shape', async () => {
  const cell = (value, display, dataType = 'date') => ({ value, display, dataType });
  const { mod } = await loadApprovalModule({
    processRows: [{
      Id: cell('a0C6T000012cTaQUAU', 'a0C6T000012cTaQUAU', 'string'),
      Name: cell('TUFTS MEDICAL CENTER Account Plan', 'TUFTS MEDICAL CENTER Account Plan', 'string'),
      KPH_Approval_Status__c: cell('Submitted for Approval', 'Submitted for Approval', 'string'),
      KPH_Comments__c: cell('Test1223', 'Test1223', 'string'),
      KPH_Submitted_Dates__c: cell('2026-08-11T18:30:00.000Z', '2026-8-12'),
      KPH_Approval_Due_Date__c: cell('2026-08-18T18:30:00.000Z', '2026-8-19'),
      KPH_Last_MPD_Review_Date__c: cell('2026-08-11T18:30:00.000Z', '2026-8-12'),
      KPH_Last_Account_Insight_Update__c: cell('2026-07-30T18:30:00.000Z', '2026-7-31'),
      KPH_Last_Critical_Acitivity_Update__c: cell('2026-08-11T18:30:00.000Z', '2026-8-12'),
      KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c: cell('2026-07-28T18:30:00.000Z', '2026-7-29'),
    }],
  });

  const review = await mod.fetchAccountPlanApprovalReview('a0C6T000012cTaQUAU');

  assert.equal(review.approvalStatus, 'Submitted for Approval');
  assert.equal(review.comments, 'Test1223');
  assert.equal(review.submittedDate, '2026-08-11T18:30:00.000Z');
  assert.equal(review.approvalDueDate, '2026-08-18T18:30:00.000Z');
  assert.equal(review.lastMpdReviewDate, '2026-08-11T18:30:00.000Z');
  assert.equal(review.lastAccountInsightUpdate, '2026-07-30T18:30:00.000Z');
  assert.equal(review.lastAdditionalCriticalActivityUpdate, '2026-08-11T18:30:00.000Z');
  assert.equal(review.lastBarrierTacticalActionUpdate, '2026-07-28T18:30:00.000Z');
});
