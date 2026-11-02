// Cross-Functional Plan of Action page composer.
//
// Display of the active DLBCL POA long-text fields living directly on
// Account_Plan_vod__c. MM POA fields are not queried while their cards are
// hidden from the view.

import {
  fetchTeamMembersByPlan,
  getCurrentUserId,
  getCurrentUserProfileName,
  POA_CONTEXT_FIELDS,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  toPoaBlocks,
  updatePoaField,
} from '@/lib/dataservice/accountPlan/shared';

const idsMatch = (a, b) => {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  return left === right || left.slice(0, 15) === right.slice(0, 15);
};

const loadCurrentPoaUser = async (planId) => {
  const [currentUserId, profileName] = await Promise.all([
    getCurrentUserId(),
    getCurrentUserProfileName(),
  ]);
  if (!currentUserId && !profileName) return null;

  const teamMembers = currentUserId ? await fetchTeamMembersByPlan(planId) : [];
  const teamMember =
    teamMembers.find((member) => member.isPrimary && idsMatch(member.userId, currentUserId)) ||
    teamMembers.find((member) => idsMatch(member.userId, currentUserId));

  return {
    id: currentUserId,
    teamMemberId: teamMember ? teamMember.id : null,
    name: teamMember ? teamMember.name : null,
    role: teamMember ? teamMember.role : null,
    functionName: teamMember ? teamMember.functionName : null,
    profileName,
    participation: teamMember ? teamMember.participation : null,
  };
};

export const loadCrossFunctionalPlan = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const [shellContext, currentUser] = await Promise.all([
    resolveShellContextForPlanId(planContextId, { planFields: POA_CONTEXT_FIELDS }),
    loadCurrentPoaUser(planContextId),
  ]);
  const { planId, plan, account } = shellContext;
  const { lastModifiedDate, blocks } = toPoaBlocks(shellContext.planRow);

  return {
    planId,
    plan,
    account,
    poaLastModifiedDate: lastModifiedDate,
    blocks,
    currentUser,
  };
};

export const savePoaBlock = (planId, block, value) =>
  updatePoaField(planId, block && block.field, value);
