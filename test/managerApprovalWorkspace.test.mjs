import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebarSource = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const sidebarCss = await readFile(new URL('../src/components/Sidebar.css', import.meta.url), 'utf8');
const modalSource = await readFile(new URL('../src/components/ManagerApprovalModals.jsx', import.meta.url), 'utf8');
const modalCss = await readFile(new URL('../src/components/ManagerApprovalModals.css', import.meta.url), 'utf8');
const lookupSource = await readFile(new URL('../src/pages/AccountProfile/AccountLookupField.jsx', import.meta.url), 'utf8');
const approvalSource = await readFile(new URL('../src/lib/dataservice/accountPlan/approval.js', import.meta.url), 'utf8');

test('CTAM manager Export and Submit menu exposes history and conditional review actions', () => {
  assert.match(sidebarSource, /MANAGER_APPROVAL_HISTORY_OPTION[\s\S]*?label: 'Approval History'/);
  assert.match(sidebarSource, /MANAGER_REVIEW_OPTION[\s\S]*?label: 'Review & Decide'/);
  assert.match(sidebarSource, /label: 'Approvals', isSection: true/);
  assert.match(sidebarSource, /label: 'Export & Submit', isSection: true/);
  assert.match(sidebarSource, /const visibleExportMenuOptions = isCtamManager/);
  assert.match(
    sidebarSource,
    /isSubmittedOrReassignedApprovalStatus\(plan\?\.approvalStatus\) \? \[MANAGER_REVIEW_OPTION\] : \[\]/
  );
  assert.match(sidebarSource, /option\.key === 'approval-history'/);
  assert.match(sidebarSource, /option\.key === 'review-approval'/);
  assert.match(sidebarSource, /option\.isSection/);
  assert.match(sidebarSource, /className="sidebar-export-section-label"/);
  assert.match(sidebarCss, /\.sidebar-export-section-label/);
  assert.match(sidebarCss, /\.sidebar-export-section\.is-export-section/);
  assert.match(appSource, /isCtamManager=\{isCtamManager\}/);
  assert.match(appSource, /onApprovalHistory=\{handleOpenApprovalHistory\}/);
  assert.match(appSource, /onReviewApproval=\{handleOpenManagerApprovalReview\}/);
  assert.match(appSource, /if \(!isCtamManager \|\| !isSubmittedOrReassignedApprovalStatus\(effectiveShellPlan\?\.approvalStatus\)\) return/);
});

test('manager review modal omits the Last Internal POD Meeting date', () => {
  const fieldsBlock = modalSource.match(/const REVIEW_FIELDS = \[([\s\S]*?)\];/)?.[1] || '';
  const labels = [...fieldsBlock.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(labels, [
    'Approval Status',
    'Comments',
    'Submitted Date',
    'Approval Due Date',
    'Last MPD Review Date',
    'Last Account Insight Update',
    'Last Additional Critical Activity Update',
    'Last Barrier & Tactical Action Update',
  ]);
  assert.match(modalSource, /className="manager-review-dossier"/);
  assert.match(modalSource, /<dl className="manager-review-grid">/);
  assert.doesNotMatch(modalSource, /manager-review-table/);
  assert.doesNotMatch(modalSource, /<th>Field<\/th><th>Current Value<\/th>/);
  assert.match(
    modalCss,
    /\.manager-review-grid\.is-activity\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/
  );
  assert.match(
    modalCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.manager-review-summary,[\s\S]*?\.manager-review-grid\.is-activity\s*\{\s*grid-template-columns:\s*1fr/
  );
  assert.match(
    modalCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.manager-approval-foot > div\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(appSource, /setSelectedLauncherPlan\(plan\)/);
  assert.match(appSource, /baseShellPlan = shellPlan[\s\S]*?selectedLauncherPlanForShell/);
});

test('Account Plan selection starts approval-review loading in the background without blocking the first click', () => {
  const selectionBlock = appSource.match(/const handleSelectLauncherPlan = \(plan\) => \{([\s\S]*?)\n  \};/)?.[1] || '';

  assert.ok(selectionBlock.indexOf('setSelectedLauncherPlan(plan)') >= 0);
  assert.ok(selectionBlock.indexOf('loadManagerApprovalReviewInBackground(plan)') >= 0);
  assert.ok(
    selectionBlock.indexOf('setSelectedLauncherPlan(plan)') <
      selectionBlock.indexOf('loadManagerApprovalReviewInBackground(plan)')
  );
  assert.doesNotMatch(selectionBlock, /await /);
  assert.match(appSource, /managerApprovalReviewTimerRef\.current = window\.setTimeout\([\s\S]*?, 0\)/);
  assert.match(appSource, /fetchAccountPlanApprovalReview\(planId\)/);
  assert.match(appSource, /loadManagerApprovalReview\(plan\.id\)/);
  assert.match(appSource, /managerApprovalReviewRequestRef/);
  assert.match(appSource, /current\?\.id === planId/);
  assert.match(appSource, /refreshStatus=\{managerApprovalReviewStatus\}/);
});

test('Review and Decide fetches and prefers fresh review data on iPad without changing desktop preload', () => {
  const openBlock = appSource.match(/const handleOpenManagerApprovalReview = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || '';

  assert.match(openBlock, /loadManagerApprovalReview\(shellPlanId\)/);
  assert.match(appSource, /const \[managerApprovalReview, setManagerApprovalReview\] = useState\(null\)/);
  assert.match(
    appSource,
    /const managerApprovalReviewPlan = effectiveShellPlan[\s\S]*?\{ \.\.\.effectiveShellPlan, \.\.\.managerApprovalReview \}/
  );
  assert.match(appSource, /<ManagerApprovalReviewModal[\s\S]*?plan=\{managerApprovalReviewPlan\}/);
  assert.match(appSource, /const loadManagerApprovalReviewInBackground = \(plan\) => \{[\s\S]*?loadManagerApprovalReview\(plan\.id\)/);
});

test('manager decision flow updates the latest Pending approval history record', () => {
  const actionFooter = modalSource.match(/<footer className="manager-approval-foot is-review-actions">([\s\S]*?)<\/footer>/)?.[1] || '';

  assert.match(modalSource, /Comment is required for approval and Revise & Resubmit decisions\./);
  assert.equal((actionFooter.match(/<button\b/g) || []).length, 3);
  assert.match(actionFooter, />Approve<\/button>/);
  assert.match(actionFooter, />Revise & Resubmit<\/button>/);
  assert.match(actionFooter, />Reassign<\/button>/);
  assert.doesNotMatch(actionFooter, />Reject<\/button>/);
  assert.match(modalSource, /manager-decision-confirm-overlay/);
  assert.match(modalSource, /manager-decision-confirm-modal/);
  assert.match(modalSource, /aria-labelledby="manager-decision-confirm-title"/);
  assert.match(modalSource, /Approve Account Plan/);
  assert.match(modalSource, /Revise & Resubmit Account Plan/);
  assert.doesNotMatch(modalSource, /Last Internal POD Meeting Update/);
  assert.doesNotMatch(modalSource, /key:\s*'lastInternalPodMeetingUpdate'/);
  assert.match(modalSource, /maxLength=\{APPROVAL_COMMENT_MAX_LENGTH\}/);
  assert.match(modalSource, /\{comments\.length\}\/\{APPROVAL_COMMENT_MAX_LENGTH\}/);
  assert.match(modalSource, /aria-live="polite"/);
  assert.match(modalCss, /\.manager-action-button\.is-approve/);
  assert.match(modalCss, /\.manager-action-button\.is-reject/);
  assert.match(modalCss, /\.manager-action-button\.is-reassign/);
  assert.match(modalCss, /\.manager-reassign-user-lookup \.lookup-match/);
  assert.match(modalCss, /\.manager-decision-confirm-overlay[\s\S]*?position:\s*fixed/);
  assert.match(modalCss, /\.manager-decision-confirm-modal/);
  assert.match(modalSource, /import AccountLookupField/);
  assert.match(modalSource, /<AccountLookupField[\s\S]*?label="Reassign to"/);
  assert.match(modalSource, /highlightMatches/);
  assert.match(modalSource, /searchReassignUsers/);
  assert.match(modalSource, /user\.name\.toLowerCase\(\)\.includes\(normalizedQuery\)/);
  assert.doesNotMatch(modalSource, /<select/);
  assert.match(lookupSource, /const highlightLookupMatch/);
  assert.match(lookupSource, /<strong className="lookup-match"/);
  assert.match(modalSource, /Only eligible managers are shown in this list\./);
  assert.match(modalSource, /Select a CTAM Manager\./);
  assert.doesNotMatch(modalSource, /UI preview only\. CRM reassignment is not connected yet\./);
  assert.doesNotMatch(appSource, /searchUsers=\{searchUsers\}/);
  assert.match(appSource, /MOCK_APPROVAL_REASSIGN_USERS/);
  assert.match(appSource, /fetchCtamManagerUsers\(\)/);
  assert.match(appSource, /reassignUsers=\{managerReassignUsers\}/);
  assert.match(appSource, /onReassign=\{\(\{ assignee, comments \}\) => handleManagerApprovalDecision/);
  assert.match(approvalSource, /APPROVAL_HISTORY_APPROVAL_STEP_FIELD = 'KPH_Approval_Step__c'/);
  assert.match(approvalSource, /APPROVAL_HISTORY_COMMENTS_FIELD = 'KPH_Comments__c'/);
  assert.match(approvalSource, /APPROVAL_HISTORY_RECORD_TYPE_FIELD = 'RecordTypeId'/);
  assert.match(approvalSource, /APPROVAL_HISTORY_STATUS_FIELD = 'KPH_Status__c'/);
  assert.match(approvalSource, /APPROVAL_HISTORY_PENDING_STATUS = 'Pending'/);
  assert.match(approvalSource, /Approved:\s*'Approve'/);
  assert.match(approvalSource, /Rejected:\s*'Reject'/);
  assert.match(approvalSource, /Reassigned:\s*'Reassign'/);
  assert.match(approvalSource, /MANAGER_APPROVAL_STATUS_BY_ACTION[\s\S]*?Approved:\s*'Approved'[\s\S]*?Rejected:\s*'Rejected'[\s\S]*?Reassigned:\s*'Reassigned'/);
  assert.match(approvalSource, /Approved:\s*'012VI00000FPARlYAP'/);
  assert.match(approvalSource, /Rejected:\s*'012VI00000FPARpYAP'/);
  assert.match(approvalSource, /\[APPROVAL_HISTORY_APPROVAL_STEP_FIELD\]: approvalStep/);
  assert.match(approvalSource, /\[APPROVAL_HISTORY_COMMENTS_FIELD\]: trimmedComments/);
  assert.match(approvalSource, /\[APPROVAL_HISTORY_RECORD_TYPE_FIELD\]: recordTypeId/);
  assert.match(approvalSource, /\[APPROVAL_HISTORY_STATUS_FIELD\]: approvalStatus/);
  assert.match(approvalSource, /fields\[APPROVAL_HISTORY_ASSIGNED_TO_FIELD\] = selectedAssigneeId/);
  assert.match(approvalSource, /object:\s*'RecordType'[\s\S]*?fields:\s*\['Id'\][\s\S]*?where:\s*`Name = '\$\{REASSIGNED_RECORD_TYPE_NAME\}'`/);
  assert.match(appSource, /await updateManagerApprovalStep\(\{[\s\S]*?planId: shellPlanId,[\s\S]*?action,[\s\S]*?comments,[\s\S]*?assigneeId/);
  assert.match(appSource, /isSaving=\{managerDecisionStatus === 'saving'\}/);
  assert.match(modalSource, /\{isSaving \? 'Saving\.\.\.' : decisionMeta\.confirmLabel\}/);
});

test('approval history uses an accessible table and compact responsive modal styling', () => {
  assert.match(modalSource, /title="Approval History"/);
  assert.match(modalSource, /className="manager-history-table"/);
  assert.match(modalSource, /Created Date/);
  assert.match(modalSource, /Status/);
  assert.match(modalSource, /Assigned To/);
  assert.match(modalSource, /Actual Approver/);
  assert.match(modalSource, /Comments/);
  assert.match(modalSource, /className="manager-history-summary" aria-live="polite"/);
  assert.match(modalSource, /manager-history-summary-dot/);
  assert.doesNotMatch(modalSource, /<strong>\{isLoading \? '\.\.\.' : entries\.length\}<\/strong>/);
  assert.match(modalSource, /aria-modal="true"/);
  assert.match(modalCss, /\.manager-approval-modal/);
  assert.match(modalCss, /\.manager-history-table-wrap[\s\S]*?overflow-x:\s*auto/);
  assert.match(modalCss, /\.manager-history-summary[\s\S]*?border-radius:\s*999px/);
  assert.match(modalCss, /@media \(max-width: 720px\)/);
  assert.match(modalCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test('approval comments stay contained and readable through the 1000 character limit', () => {
  assert.match(modalSource, /className="manager-history-comment"/);
  assert.match(modalCss, /\.manager-history-table\s*\{[\s\S]*?table-layout:\s*fixed/);
  assert.match(
    modalCss,
    /\.manager-history-comment,[\s\S]*?\.manager-review-comments-card p,[\s\S]*?\.manager-decision-field textarea\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;[\s\S]*?white-space:\s*pre-wrap;/
  );
});

test('approval workspace modals rely on the header close control without bottom Close buttons', () => {
  assert.doesNotMatch(modalSource, />Close<\/button>/);
  assert.doesNotMatch(modalSource, /manager-review-close/);
  assert.match(modalSource, /className="stakeholder-edit-close"[\s\S]*?aria-label="Close"/);
  assert.match(modalSource, /className="manager-approval-foot is-review-actions"/);
});

test('approval history resolves assigned and actual approver IDs with a separate User query', () => {
  assert.match(approvalSource, /APPROVAL_HISTORY_OBJECT = 'KPH_Account_Plan_Approval_History__c'/);
  assert.match(approvalSource, /APPROVAL_HISTORY_ACCOUNT_PLAN_FIELD = 'KPH_Account_Plan__c'/);
  assert.match(approvalSource, /'KPH_Comments__c'/);
  assert.match(approvalSource, /'CreatedDate'/);
  assert.match(approvalSource, /'KPH_Assigned_To__c'/);
  assert.match(approvalSource, /'KPH_Actual_Approver__c'/);
  assert.match(approvalSource, /'KPH_Status__c'/);
  assert.doesNotMatch(approvalSource, /KPH_Assigned_To__r\.Name/);
  assert.doesNotMatch(approvalSource, /KPH_Actual_Approver__r\.Name/);
  assert.match(approvalSource, /object: 'User'/);
  assert.match(approvalSource, /fields: \['Id', 'Name'\]/);
  assert.match(approvalSource, /assignedTo: userNameForId\(userNamesById, assignedToId\)/);
  assert.match(approvalSource, /actualApprover: userNameForId\(userNamesById, actualApproverId\)/);
  assert.match(approvalSource, /sort: \['CreatedDate DESC'\]/);
  assert.match(appSource, /fetchAccountPlanApprovalHistory\(shellPlanId\)/);
  assert.match(appSource, /status=\{managerApprovalHistoryStatus\}/);
  assert.doesNotMatch(appSource, /buildMockApprovalHistory/);
});
