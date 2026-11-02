// KPH_Approval_Status__c picklist values (exact CRM labels).
export const SUBMITTED_FOR_APPROVAL_STATUS = 'Submitted for Approval';
export const REASSIGNED_STATUS = 'Reassigned';
export const REVISE_AND_RESUBMIT_STATUS = 'Revise and Resubmit';

const statusKey = (value) => String(value || '').trim().toLowerCase();

export const isSubmittedForApprovalStatus = (value) =>
  statusKey(value) === statusKey(SUBMITTED_FOR_APPROVAL_STATUS);

export const isSubmittedOrReassignedApprovalStatus = (value) => {
  const normalizedStatus = statusKey(value);
  return normalizedStatus === statusKey(SUBMITTED_FOR_APPROVAL_STATUS) ||
    normalizedStatus === statusKey(REASSIGNED_STATUS);
};

export const isReviseAndResubmitStatus = (value) =>
  statusKey(value) === statusKey(REVISE_AND_RESUBMIT_STATUS);

// The plan is locked (read-only) while KPH_Approval_Status__c is awaiting a
// manager decision, including after reassignment. Every other status — Revise
// and Resubmit, Approved, Recalled, Submitted But Not Approved by MPD (and any
// unset/other value) — is editable.
export const isAccountPlanReadOnly = (plan) =>
  isSubmittedOrReassignedApprovalStatus(plan?.approvalStatus);
