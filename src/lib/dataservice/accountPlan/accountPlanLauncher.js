import {
  inClause,
  runQuery,
  unwrap,
} from '@/lib/dataservice/query';
import { getPicklistValueLabels } from '../query';
import { valuesFromPicklistLabels } from '../../helper/utils';

const ACCOUNT_PLAN_OBJECT = 'Account_Plan_vod__c';
const USER_OBJECT = 'User';
const ACCOUNT_OBJECT = 'Account';
const ACCOUNT_PROFILE_OBJECT = 'KPH_Ecosystem_Plan__c';
const ACCOUNT_PLAN_LAUNCHER_WHERE ="Account_vod__r.Hospital_Type__c = 'Authorized Treatment Center' AND Account_vod__r.Customer_Master_Status_vod__c = 'Valid_vod'";
const ACCOUNT_MM_ATC_PRIORITY_FIELD = 'KPH_MM_ATC_Priority__c';
const ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD = 'KPH_Market_Access_Prioritized_Account__c';
const ACCOUNT_PROFILE_ATC_COHORT_FIELD = 'KPH_ATC_Cohort__c';

export const ACCOUNT_PLAN_APPROVAL_FIELDS = [
  'KPH_Approval_Status__c',
  'KPH_Comments__c',
  'KPH_Submitted_Dates__c',
  'KPH_Approval_Due_Date__c',
  'KPH_Last_MPD_Review_Date__c',
  'KPH_Last_Account_Insight_Update__c',
  'KPH_Last_Critical_Acitivity_Update__c',
  'KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c',
  'KPH_Last_Internal_POD_Meeting_Update__c',
  'KPH_Manager_s_Email__c',
];

// Field set pulled from codex/account-plan-launcher-columns so the desktop list
// shows Owner first/last, Territory, Territory Description, Last MPD Review, and
// Submitted dates. The fetch scoping is intentionally left as-is (ATC + valid
// account content filter, Salesforce sharing scopes rows to the user).
export const ACCOUNT_PLAN_LAUNCHER_RELATIONSHIP_FIELDS = [
  'Id',
  'Name',
  'OwnerId',
  'Account_vod__c',
  'Owner.Name',
  'Owner.FirstName',
  'Owner.LastName',
  'KPH_ATC_EID__c',
  'KPH_ATC_Certified_Date__c',
  'KPH_Plan_status__c',
  'KPH_Territory_Description__c',
  'KPH_Territory__c',
  ...ACCOUNT_PLAN_APPROVAL_FIELDS,
];


const ACCOUNT_PLAN_LAUNCHER_FALLBACK_FIELDS = [
  'Id',
  'Name',
  'OwnerId',
  'Account_vod__c',
  'KPH_ATC_EID__c',
  'KPH_ATC_Certified_Date__c',
  'KPH_Plan_status__c',
  'KPH_Territory_Description__c',
  'KPH_Territory__c',
  ...ACCOUNT_PLAN_APPROVAL_FIELDS,
];

const USER_FIELDS = ['Id', 'Name', 'FirstName', 'LastName'];
const ACCOUNT_PRIORITY_FIELDS = [
  'Id',
  ACCOUNT_MM_ATC_PRIORITY_FIELD,
  ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD,
];
const ACCOUNT_PROFILE_COHORT_FIELDS = [
  'Id',
  'KPH_Account_Plan__c',
  ACCOUNT_PROFILE_ATC_COHORT_FIELD,
  'LastModifiedDate',
];


const uniqueValues = (values) =>
  Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));

const relatedName = (row, relationshipKey, dottedKey) => {
  const direct = row?.[dottedKey];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const relationship = row?.[relationshipKey];
  if (relationship && typeof relationship === 'object') {
    const name = relationship.Name || relationship.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
};

const relatedValue = (row, relationshipKey, fieldName, dottedKey) => {
  const direct = row?.[dottedKey];
  if (direct !== null && direct !== undefined && String(direct).trim()) return String(direct).trim();
  const relationship = row?.[relationshipKey];
  const value = relationship && typeof relationship === 'object' ? relationship[fieldName] : null;
  return value !== null && value !== undefined && String(value).trim() ? String(value).trim() : null;
};

const displayString = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};
const EMPTY_DISPLAY_VALUE = '-';

const fetchUserNamesById = async (userIds) => {
  const ids = uniqueValues(userIds);
  if (!ids.length) return new Map();
  const rows = await runQuery({
    object: USER_OBJECT,
    fields: USER_FIELDS,
    where: `Id IN ${inClause(ids)}`,
    limit: ids.length,
  });
  return new Map(rows.map(unwrap).filter((row) => row?.Id).map((row) => [
    String(row.Id),
    {
      name: displayString(row.Name),
      firstName: displayString(row.FirstName),
      lastName: displayString(row.LastName),
    },
  ]));
};

const fetchAccountPriorityById = async (accountIds) => {
  const ids = uniqueValues(accountIds);
  if (!ids.length) return new Map();
  try {
    const rows = await runQuery({
      object: ACCOUNT_OBJECT,
      fields: ACCOUNT_PRIORITY_FIELDS,
      where: `Id IN ${inClause(ids)}`,
      limit: ids.length,
    });
    return new Map(rows.map(unwrap).filter((row) => row?.Id).map((row) => [
      String(row.Id),
      {
        mmAtcPriorityAccount: displayString(row[ACCOUNT_MM_ATC_PRIORITY_FIELD]),
        marketAccessPrioritizedAccount: displayString(row[ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD]),
        potentialAtc:row.KPH_Potential_ATC__c=== true || row.KPH_Potential_ATC__c=== 'true',
      },
    ]));
  } catch (error) {
    console.warn('[accountPlanLauncher] account priority query failed; continuing without priority fields.', error);
    return new Map();
  }
};

const fetchAtcCohortByPlanId = async (planIds) => {
  const ids = uniqueValues(planIds);
  if (!ids.length) return new Map();
  const rows = await runQuery({
    object: ACCOUNT_PROFILE_OBJECT,
    fields: ACCOUNT_PROFILE_COHORT_FIELDS,
    where: `KPH_Account_Plan__c IN ${inClause(ids)}`,
    sort: ['LastModifiedDate DESC'],
    limit: ids.length * 5,
  });
  const cohortsByPlanId = new Map();
  rows
    .map(unwrap)
    .filter(Boolean)
    .sort((left, right) =>
      String(right.LastModifiedDate || '').localeCompare(String(left.LastModifiedDate || ''))
    )
    .forEach((row) => {
      const planId = displayString(row.KPH_Account_Plan__c);
      if (!planId || cohortsByPlanId.has(planId)) return;
      cohortsByPlanId.set(planId, displayString(row[ACCOUNT_PROFILE_ATC_COHORT_FIELD]));
    });
  return cohortsByPlanId;
};

const toAccountPlanLauncherRow = (
  row,
  userNamesById = new Map(),
  accountPriorityById = new Map(),
  atcCohortByPlanId = new Map()
) => {
  const r = unwrap(row);
  if (!r?.Id) return null;
  const ownerUser = userNamesById.get(String(r.OwnerId || '')) || {};
  const ownerName = relatedName(r, 'Owner', 'Owner.Name') || ownerUser.name || displayString(r.OwnerId);
  const accountPriority = accountPriorityById.get(String(r.Account_vod__c ||r.Account_vod__r || '')) || {};
  return {
    id: r.Id,
    name: displayString(r.Name) || 'Unnamed Account Plan',
    eid: displayString(r.KPH_ATC_EID__c) || EMPTY_DISPLAY_VALUE,
    ownerName: ownerName || EMPTY_DISPLAY_VALUE,
    ownerFirstName:
      relatedValue(r, 'Owner', 'FirstName', 'Owner.FirstName') ||
      ownerUser.firstName ||
      ownerName?.split(/\s+/)[0] ||
      EMPTY_DISPLAY_VALUE,
    ownerLastName:
      relatedValue(r, 'Owner', 'LastName', 'Owner.LastName') ||
      ownerUser.lastName ||
      ownerName?.split(/\s+/).slice(1).join(' ') ||
      EMPTY_DISPLAY_VALUE,
    marketAccessPrioritizedAccount: accountPriority.marketAccessPrioritizedAccount || EMPTY_DISPLAY_VALUE,
    mmAtcPriorityAccount: accountPriority.mmAtcPriorityAccount || EMPTY_DISPLAY_VALUE,
    atcCohortDlbcl: atcCohortByPlanId.get(String(r.Id)) || EMPTY_DISPLAY_VALUE,
    atcCertifiedDate: r.KPH_ATC_Certified_Date__c || null,
    planStatus: displayString(r.KPH_Plan_status__c) || EMPTY_DISPLAY_VALUE,
    territory: displayString(r.KPH_Territory__c) || EMPTY_DISPLAY_VALUE,
    territoryDescription: displayString(r.KPH_Territory_Description__c) || EMPTY_DISPLAY_VALUE,
    lastMpdReviewDate: r.KPH_Last_MPD_Review_Date__c || null,
    submittedDate: r.KPH_Submitted_Dates__c || null,
    approvalStatus: displayString(r.KPH_Approval_Status__c),
    comments: displayString(r.KPH_Comments__c),
    approvalDueDate: r.KPH_Approval_Due_Date__c || null,
    lastAccountInsightUpdate: r.KPH_Last_Account_Insight_Update__c || null,
    lastAdditionalCriticalActivityUpdate: r.KPH_Last_Critical_Acitivity_Update__c || null,
    lastBarrierTacticalActionUpdate: r.KPH_LAST_BARRIER_TACTICAL_ACTION_UPDATE__c || null,
    lastInternalPodMeetingUpdate: r.KPH_Last_Internal_POD_Meeting_Update__c || null,
    managerEmail: displayString(r.KPH_Manager_s_Email__c),
  };
};

const needsUserNameLookup = (rows) =>
  rows.some((row) => {
    const r = unwrap(row);
    if (!r) return false;
    const missingOwnerFirstName = r.OwnerId && !relatedValue(r, 'Owner', 'FirstName', 'Owner.FirstName');
    const missingOwnerLastName = r.OwnerId && !relatedValue(r, 'Owner', 'LastName', 'Owner.LastName');
    return missingOwnerFirstName || missingOwnerLastName;
  });

const sortLauncherRows = (rows) =>
  [...(rows || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));


// Fetch is unchanged from react_v4: ATC + valid content filter only; no owner /
// team-member scoping. Salesforce sharing decides which rows the user sees.
const fetchLauncherAccountPlans = async ({ allowRelationshipFields = true } = {}) =>
  runQuery({
    object: ACCOUNT_PLAN_OBJECT,
    fields: allowRelationshipFields
      ? ACCOUNT_PLAN_LAUNCHER_RELATIONSHIP_FIELDS
      : ACCOUNT_PLAN_LAUNCHER_FALLBACK_FIELDS,
    where: ACCOUNT_PLAN_LAUNCHER_WHERE,
    sort: ['Name ASC'],
    ...(allowRelationshipFields ? { allowDottedFields: true } : {}),
  });

export const fetchCurrentUserAccountPlans = async () => {
  let rows;
  let usedFallbackQuery = false;
  try {
    rows = await fetchLauncherAccountPlans({ allowRelationshipFields: true });
  } catch (error) {
    console.warn('[accountPlanLauncher] relationship-field query failed; retrying with User lookup.', error);
    usedFallbackQuery = true;
    rows = await fetchLauncherAccountPlans({ allowRelationshipFields: false });
  }

  const shouldFetchUserNames = usedFallbackQuery || needsUserNameLookup(rows);
  const [userNamesById, accountPriorityById, atcCohortByPlanId] = await Promise.all([
    shouldFetchUserNames
      ? fetchUserNamesById(rows.flatMap((row) => {
          const r = unwrap(row);
          return [r?.OwnerId];
        }))
      : Promise.resolve(new Map()),
    fetchAccountPriorityById(rows.flatMap((row) => {
      const r = unwrap(row);
      return [r?.Account_vod__c];
    })),
    fetchAtcCohortByPlanId(rows.flatMap((row) => {
      const r = unwrap(row);
      return [r?.Id];
    })),
  ]);

  return sortLauncherRows(
    rows
      .map((row) => toAccountPlanLauncherRow(row, userNamesById, accountPriorityById, atcCohortByPlanId))
      .filter(Boolean)
  );
};