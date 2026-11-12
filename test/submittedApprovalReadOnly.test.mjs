import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const appSource = await read('../src/App.jsx');
const sharedSource = await read('../src/lib/dataservice/accountPlan/shared.js');
const fixtureSource = await read('../src/lib/mockData/fixtures.js');

test('account plan approval status is loaded and normalized for read-only checks', async () => {
  const helper = await import('../src/lib/accountPlanReadOnly.js');

  assert.equal(helper.SUBMITTED_FOR_APPROVAL_STATUS, 'Submitted for Approval');
  assert.equal(helper.REASSIGNED_STATUS, 'Reassigned');
  assert.equal(helper.REVISE_AND_RESUBMIT_STATUS, 'Revise and Resubmit');
  assert.equal(helper.isSubmittedForApprovalStatus('Submitted for Approval'), true);
  assert.equal(helper.isSubmittedForApprovalStatus(' submitted for approval '), true);
  assert.equal(helper.isSubmittedForApprovalStatus('Draft'), false);
  assert.equal(helper.isSubmittedOrReassignedApprovalStatus('Submitted for Approval'), true);
  assert.equal(helper.isSubmittedOrReassignedApprovalStatus(' reassigned '), true);
  assert.equal(helper.isSubmittedOrReassignedApprovalStatus('Approved'), false);
  assert.equal(helper.isReviseAndResubmitStatus('Revise and Resubmit'), true);
  assert.equal(helper.isReviseAndResubmitStatus(' revise and resubmit '), true);
  assert.equal(helper.isReviseAndResubmitStatus('Approved'), false);
  // Submitted and reassigned plans stay locked while awaiting a manager decision.
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Submitted for Approval' }), true);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: ' submitted for approval ' }), true);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Reassigned' }), true);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: ' reassigned ' }), true);
  // Every other KPH_Approval_Status__c value is editable — even if isSubmitted is set.
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Revise and Resubmit' }), false);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Approved' }), false);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Recalled' }), false);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Submitted But Not Approved by MPD' }), false);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Approved', isSubmitted: true }), false);
  assert.equal(helper.isAccountPlanReadOnly({ approvalStatus: 'Draft' }), false);
  assert.equal(helper.isAccountPlanReadOnly({ planStatus: 'Submitted for Approval' }), false);
});

test('shared account plan mapping carries approval status and submitted flag', () => {
  assert.match(sharedSource, /'KPH_Approval_Status__c'/);
  assert.match(sharedSource, /'KPH_Is_Submitted__c'/);
  assert.match(sharedSource, /approvalStatus:\s*r\.KPH_Approval_Status__c/);
  assert.match(sharedSource, /isSubmitted:\s*toBooleanFlag\(r\.KPH_Is_Submitted__c\)/);
  assert.match(fixtureSource, /KPH_Approval_Status__c:\s*'Draft'/);
  assert.match(fixtureSource, /KPH_Is_Submitted__c:\s*false/);
});

test('App keeps submitted plans editable for the exact CTAM manager profile', async () => {
  const access = await import('../src/lib/approvalProfileAccess.js');

  assert.equal(
    access.isAccountPlanReadOnlyForProfile(
      { approvalStatus: 'Submitted for Approval' },
      'KPH-CTAM Manager'
    ),
    false
  );
  assert.equal(
    access.isAccountPlanReadOnlyForProfile(
      { approvalStatus: 'Reassigned' },
      'KPH-CTAM Manager'
    ),
    false
  );
  assert.equal(
    access.isAccountPlanReadOnlyForProfile(
      { approvalStatus: 'Submitted for Approval' },
      'KPH-Cell Therapy Account Manager'
    ),
    true
  );
  assert.equal(
    access.isAccountPlanReadOnlyForProfile(
      { approvalStatus: 'Reassigned' },
      'KPH-Cell Therapy Account Manager'
    ),
    true
  );
  assert.equal(
    access.isAccountPlanReadOnlyForProfile(
      { approvalStatus: 'Draft' },
      'KPH-Cell Therapy Account Manager'
    ),
    false
  );
  assert.match(appSource, /const\s+isReadOnly\s*=\s*isAccountPlanReadOnlyForProfile\(effectiveShellPlan,\s*currentUserProfileName\)/);
  assert.match(appSource, /if\s*\(!isCtamManager\s*\|\|\s*!isSubmittedOrReassignedApprovalStatus\(effectiveShellPlan\?\.approvalStatus\)\)\s*return/);

  for (const component of [
    'Sidebar',
    'Overview',
    'BarriersDrivers',
    'AccountProfile',
    'Stakeholders',
    'TeamMembers',
    'CriticalActivities',
    'CrossFunctionalPlan',
  ]) {
    const componentBlock = new RegExp(`<${component}[\\s\\S]*?isReadOnly=\\{isReadOnly\\}[\\s\\S]*?\\/?>`);
    assert.match(appSource, componentBlock, `${component} should receive isReadOnly`);
  }
});

test('Sidebar shows submitted status instead of MPD review date only from approval status', async () => {
  const sidebarSource = await read('../src/components/Sidebar.jsx');

  assert.match(
    sidebarSource,
    /import\s+\{[\s\S]*?isSubmittedForApprovalStatus,[\s\S]*?SUBMITTED_FOR_APPROVAL_STATUS,[\s\S]*?\}\s+from\s+'@\/lib\/accountPlanReadOnly'/
  );
  assert.match(sidebarSource, /isSubmittedForApprovalStatus\(plan\?\.approvalStatus\)/);
  assert.match(sidebarSource, /isReviseAndResubmitStatus\(plan\?\.approvalStatus\)/);
  assert.match(sidebarSource, /\?\s*SUBMITTED_FOR_APPROVAL_STATUS/);
  assert.match(sidebarSource, /\?\s*REVISE_AND_RESUBMIT_STATUS\s*:\s*formatDate\(lastMpd,\s*'Not entered'\)/);
  assert.match(sidebarSource, /Last MPD Review Date/);
});

test('submitted read-only flag disables add/edit affordances in page sources', async () => {
  const checks = [
    ['../src/components/Sidebar.jsx', /isReadOnly\s*=\s*false/, /disabled=\{[^}]*isReadOnly/],
    ['../src/pages/Overview/index.jsx', /isReadOnly\s*=\s*false/, /onEdit=\{isReadOnly \? null : handleEditGoals\}/],
    ['../src/pages/BarriersDrivers/index.jsx', /isReadOnly\s*=\s*false/, /disabled=\{isReadOnly \|\| activeAddLimitReached\}/],
    ['../src/pages/CriticalActivities/index.jsx', /isReadOnly\s*=\s*false/, /disabled=\{isReadOnly\}/],
    ['../src/pages/AccountProfile/index.jsx', /isReadOnly\s*=\s*false/, /isReadOnly=\{isReadOnly\}/],
    ['../src/pages/Stakeholders/index.jsx', /isReadOnly\s*=\s*false/, /onAdd=\{isReadOnly \? null : openAddStakeholder\}/],
    ['../src/pages/TeamMembers/index.jsx', /isReadOnly\s*=\s*false/, /onClick=\{openAddMember\}/],
    ['../src/pages/CrossFunctionalPlan/index.jsx', /isReadOnly\s*=\s*false/, /canEdit=\{!isReadOnly && canEditPoaBlock/],
  ];

  for (const [path, propPattern, disabledPattern] of checks) {
    const source = await read(path);
    assert.match(source, propPattern, `${path} should accept isReadOnly`);
    assert.match(source, disabledPattern, `${path} should use isReadOnly`);
  }
});
