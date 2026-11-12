import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const appSource = await read('../src/App.jsx');
const sharedSource = await read('../src/lib/dataservice/accountPlan/shared.js');

test('shared data service exposes an Account Plan approval refresh snapshot', () => {
  assert.match(sharedSource, /export const APPROVAL_STATUS_FIELD = 'KPH_Approval_Status__c'/);
  assert.match(sharedSource, /export const APPROVAL_SUBMITTED_FIELD = 'KPH_Is_Submitted__c'/);
  assert.match(sharedSource, /export const fetchPlanApprovalStatus = async \(planId\)/);
  assert.match(sharedSource, /object:\s*'Account_Plan_vod__c'/);
  assert.match(sharedSource, /fields:\s*\['Id', APPROVAL_STATUS_FIELD, APPROVAL_SUBMITTED_FIELD, 'LastModifiedDate'\]/);
  assert.match(sharedSource, /approvalStatus:\s*r\[APPROVAL_STATUS_FIELD\]/);
  assert.match(sharedSource, /isSubmitted:\s*toBooleanFlag\(r\[APPROVAL_SUBMITTED_FIELD\]\)/);
});

test('App derives profile-aware read-only mode from a live approval status overlay', () => {
  assert.match(
    appSource,
    /import\s+\{[\s\S]*?fetchPlanApprovalStatus[\s\S]*?\}\s+from\s+'@\/lib\/dataservice\/accountPlan\/shared'/
  );
  assert.match(appSource, /const APPROVAL_STATUS_REFRESH_MS = 3000;/);
  assert.match(appSource, /const \[approvalStatusSnapshot, setApprovalStatusSnapshot\] = useState\(null\)/);
  assert.match(appSource, /const baseShellPlan = shellPlan/);
  assert.match(appSource, /const effectiveShellPlan = baseShellPlan/);
  assert.match(appSource, /isSubmitted:\s*hasLiveApprovalStatus[\s\S]*?approvalStatusSnapshot\.isSubmitted[\s\S]*?: baseShellPlan\.isSubmitted/);
  assert.match(
    appSource,
    /const isReadOnly = isAccountPlanReadOnlyForProfile\(effectiveShellPlan, currentUserProfileName\)/
  );
});

test('App refreshes approval status on load, polling, app resume, and in-app navigation', () => {
  assert.match(appSource, /const refreshApprovalStatus = useCallback\(/);
  assert.match(appSource, /refreshApprovalStatus\(\{ force: true \}\)/);
  assert.match(appSource, /window\.setInterval\(\(\) => \{\s*refreshApprovalStatus\(\);/);
  assert.match(appSource, /document\.addEventListener\('visibilitychange', handleResume\)/);
  assert.match(appSource, /window\.addEventListener\('focus', handleResume\)/);
  assert.match(appSource, /window\.addEventListener\('pageshow', handleResume\)/);
  assert.match(appSource, /}, \[activeKey, refreshApprovalStatus\]\);/);
});

test('App marks the plan read-only immediately after submit succeeds', () => {
  assert.match(appSource, /setApprovalStatusSnapshot\(\{\s*planId:\s*shellPlanId,\s*approvalStatus:/);
  assert.match(appSource, /isSubmitted:\s*true/);
  assert.match(appSource, /refreshApprovalStatus\(\{ force: true \}\)/);
});
