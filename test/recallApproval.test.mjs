import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const appSource = await read('../src/App.jsx');
const sidebarSource = await read('../src/components/Sidebar.jsx');
const modalSource = await read('../src/components/RecallApprovalModal.jsx');
const modalCss = await read('../src/styles/edit-modal.css');

test('submitted or reassigned normal users receive Recall in a flat menu without manager section headings', () => {
  assert.match(sidebarSource, /const RECALL_APPROVAL_OPTION = \{ key: 'recall-approval', label: 'Recall' \}/);
  assert.match(sidebarSource, /canRecallApproval\s*=\s*false/);
  assert.match(
    sidebarSource,
    /:\s*canRecallApproval\s*\?\s*\[\s*RECALL_APPROVAL_OPTION,\s*\.\.\.standardExportMenuOptions,\s*\]/
  );
  assert.doesNotMatch(
    sidebarSource,
    /:\s*canRecallApproval\s*\?\s*\[[\s\S]*?MANAGER_APPROVAL_SECTION[\s\S]*?RECALL_APPROVAL_OPTION/
  );
  assert.match(sidebarSource, /option\.key === 'recall-approval'/);
  assert.match(sidebarSource, /onRecallApproval\?\.\(\)/);
  assert.match(appSource, /const canRecallApproval = !isMpdApprovalDisabled[\s\S]*?isSubmittedOrReassignedApprovalStatus\(effectiveShellPlan\?\.approvalStatus\)/);
  assert.match(appSource, /canRecallApproval=\{canRecallApproval\}/);
  assert.match(appSource, /onRecallApproval=\{handleOpenRecallApproval\}/);
});

test('Recall opens a compact accessible comments modal and submits through the approval service', () => {
  assert.match(appSource, /import RecallApprovalModal from '@\/components\/RecallApprovalModal'/);
  assert.match(appSource, /recallAccountPlanApproval/);
  assert.match(appSource, /await recallAccountPlanApproval\(\{ planId: shellPlanId, comments \}\)/);
  assert.match(appSource, /approvalStatus:\s*ACCOUNT_PLAN_RECALLED_STATUS/);
  assert.match(appSource, /isSubmitted:\s*false/);
  assert.match(appSource, /<RecallApprovalModal/);
  assert.match(modalSource, /role="dialog"/);
  assert.match(modalSource, /aria-modal="true"/);
  assert.match(modalSource, /noValidate/);
  assert.match(modalSource, /<h3[^>]*>Recall Account Plan<\/h3>/);
  assert.match(modalSource, /Comments/);
  assert.match(modalSource, /<textarea/);
  assert.match(modalSource, /required/);
  assert.match(modalSource, /maxLength=\{APPROVAL_COMMENT_MAX_LENGTH\}/);
  assert.match(modalSource, /\{comments\.length\}\/\{APPROVAL_COMMENT_MAX_LENGTH\}/);
  assert.match(modalSource, /Comment is required\./);
  assert.match(modalSource, /isRecalling \? 'Recalling\.\.\.' : 'Recall Account Plan'/);
  assert.match(modalCss, /\.recall-approval-modal/);
  assert.match(modalCss, /\.recall-approval-context/);
  assert.match(modalCss, /@media \(prefers-reduced-motion: reduce\)/);
});
