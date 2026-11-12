import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAccountPlanPendingManagerApproval,
  normalizeApprovalEmail,
} from '../src/lib/accountPlanApprovalAssignments.js';

test('approval email normalization handles Salesforce invalid-address suffixes', () => {
  assert.equal(normalizeApprovalEmail(' EAPPELT@KITEPHARMA.COM.INVALID '), 'eappelt@kitepharma.com');
  assert.equal(normalizeApprovalEmail('eappelt@kitepharma.com.invalid.invalid'), 'eappelt@kitepharma.com');
  assert.equal(normalizeApprovalEmail('eappelt@kitepharma.com'), 'eappelt@kitepharma.com');
  assert.equal(normalizeApprovalEmail(null), '');
});

test('approval list includes submitted plans assigned to the current manager email', () => {
  const submittedPlan = {
    approvalStatus: 'Submitted for Approval',
    managerEmail: 'eappelt@kitepharma.com.invalid',
  };

  assert.equal(
    isAccountPlanPendingManagerApproval(submittedPlan, 'eappelt@kitepharma.com'),
    true
  );
  assert.equal(
    isAccountPlanPendingManagerApproval(
      { ...submittedPlan, approvalStatus: 'Draft' },
      'eappelt@kitepharma.com'
    ),
    false
  );
  assert.equal(
    isAccountPlanPendingManagerApproval(submittedPlan, 'another.manager@kitepharma.com'),
    false
  );
  assert.equal(isAccountPlanPendingManagerApproval(submittedPlan, null), false);
});

test('approval list includes reassigned plans assigned to the current manager email', () => {
  const reassignedPlan = {
    approvalStatus: 'Reassigned',
    managerEmail: 'eappelt@kitepharma.com.invalid',
  };

  assert.equal(
    isAccountPlanPendingManagerApproval(reassignedPlan, 'eappelt@kitepharma.com'),
    true
  );
  assert.equal(
    isAccountPlanPendingManagerApproval(reassignedPlan, 'another.manager@kitepharma.com'),
    false
  );
  assert.equal(
    isAccountPlanPendingManagerApproval(
      { ...reassignedPlan, approvalStatus: 'Approved' },
      'eappelt@kitepharma.com'
    ),
    false
  );
});
