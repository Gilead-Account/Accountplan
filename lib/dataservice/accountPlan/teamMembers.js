// Team Members page composer.
//
// Same object as the Home POD panel (Account_Team_Member_vod__c) but linked
// via Account_Plan_vod__c instead of KPH_Ecosystem_Plan__c.

import {
  createTeamMember,
  deleteTeamMember,
  fetchTeamMembersByPlan,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  searchUsers,
  sortTeamMembersByParticipation,
  updateTeamMember,
} from '@/lib/dataservice/accountPlan/shared';
import { getPicklistValueLabels } from '@/lib/dataservice/query';

const TEAM_MEMBER_OBJECT = 'Account_Team_Member_vod__c';
const FALLBACK_PICKLISTS = {
  participationOptions: ['Core', 'Lead', 'Extended'],
  statusOptions: ['Active', 'Inactive'],
};

const mergeWithDataValues = (base, valuesFromData) => {
  const seen = new Set();
  const out = [];
  for (const v of [...(base || []), ...(valuesFromData || [])]) {
    if (!v || v === 'All' || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const valuesFromPicklistLabels = (labels) => {
  if (!labels) return [];
  if (Array.isArray(labels)) {
    return mergeWithDataValues(
      [],
      labels.map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        if (typeof entry !== 'object') return null;
        return entry.value || entry.apiValue || entry.apiName || entry.label || entry.name || null;
      })
    );
  }
  if (typeof labels === 'object') return mergeWithDataValues([], Object.keys(labels));
  return [];
};

const fetchPicklistOptions = (fieldApi) =>
  getPicklistValueLabels(TEAM_MEMBER_OBJECT, fieldApi)
    .then(valuesFromPicklistLabels)
    .catch(() => []);

export const loadTeamMembers = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const [shellContext, teamMembers, participationPicklist, statusPicklist] = await Promise.all([
    resolveShellContextForPlanId(planContextId),
    fetchTeamMembersByPlan(planContextId),
    fetchPicklistOptions('KPH_Participation__c'),
    fetchPicklistOptions('Account_Team_Member_Active__c'),
  ]);
  const { planId, plan, account } = shellContext;
  const dataParticipation = teamMembers.map((member) => member.participation).filter(Boolean);
  const dataStatuses = teamMembers.map((member) => (member.isPrimary ? 'Active' : 'Inactive')).filter(Boolean);
  const picklists = {
    participationOptions: mergeWithDataValues(
      participationPicklist.length ? participationPicklist : FALLBACK_PICKLISTS.participationOptions,
      dataParticipation
    ),
    statusOptions: mergeWithDataValues(
      statusPicklist.length ? statusPicklist : FALLBACK_PICKLISTS.statusOptions,
      dataStatuses
    ),
  };

  // TODO: page-specific shaping — group by participation/role, separate
  // active vs inactive, etc.
  return {
    planId,
    plan,
    account,
    teamMembers,
    picklists,
  };
};

export {
  createTeamMember,
  deleteTeamMember,
  searchUsers,
  sortTeamMembersByParticipation,
  updateTeamMember,
};
