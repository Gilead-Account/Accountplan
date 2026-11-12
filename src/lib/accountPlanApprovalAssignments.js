import { isSubmittedOrReassignedApprovalStatus } from './accountPlanReadOnly.js';

const INVALID_EMAIL_SUFFIX = /(?:\.invalid)+$/i;

export const normalizeApprovalEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(INVALID_EMAIL_SUFFIX, '');

export const isAccountPlanPendingManagerApproval = (plan, currentUserEmail) => {
  const managerEmail = normalizeApprovalEmail(plan?.managerEmail);
  const userEmail = normalizeApprovalEmail(currentUserEmail);

  return Boolean(
    managerEmail &&
    userEmail &&
    managerEmail === userEmail &&
    isSubmittedOrReassignedApprovalStatus(plan?.approvalStatus)
  );
};
