import {
  inClause,
  runQuery,
  unwrap,
} from '@/lib/dataservice/query';
import { getPicklistValueLabels } from '../query';
import { valuesFromPicklistLabels } from '../../helper/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Pre Authorization (Potential ATC) data service — iPad-offline safe.
//
// WHY THIS WAS CHANGED
//   iPad offline VQL cannot resolve cross-object references. The old version
//   used `Account_vod__r.KPH_Potential_ATC__c = true` in the WHERE clause and
//   `Account_vod__r.KPH_Potential_ATC__c` in the SELECT list, so the query was
//   rejected and the tab silently showed 0 rows.
//
// NEW APPROACH (three single-object queries, no dotted fields anywhere)
//   1. Account            -> ids where KPH_Potential_ATC__c is true and Valid
//   2. Account_Plan_vod__c -> plans where Account_vod__c IN (those ids)
//   3. User               -> owner names by OwnerId
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNT_PLAN_OBJECT = 'Account_Plan_vod__c';
const ACCOUNT_OBJECT = 'Account';
const USER_OBJECT = 'User';
const EMPTY_DISPLAY_VALUE = '-';

const ACCOUNT_VALID_CLAUSE = "Customer_Master_Status_vod__c = 'Valid_vod'";

// Offline VQL can store booleans differently from online. Try each form until
// one returns rows.
const POTENTIAL_ATC_CANDIDATES = [
  'KPH_Potential_ATC__c = true',
  "KPH_Potential_ATC__c = 'true'",
  'KPH_Potential_ATC__c = 1',
];

const CENTER_CLASSIFICATION_FIELD = 'KPH_Center_Classification__c';
const ACCOUNT_PHASE_FIELD = 'KPH_Account_Phase__c';
const PLAN_STATUS_FIELD = 'KPH_Plan_status__c';

// NOTE: 'KPH_Potential_ATC__c' was removed from this list. It is an Account
// field; if it is not also a field on Account_Plan_vod__c, including it makes
// the plan query fail. Add it back only if it exists on Account_Plan_vod__c.
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

// No dotted (relationship) fields — safe on iPad offline.
export const PLAN_FIELDS = [
  'Id',
  'Name',
  'OwnerId',
  'Account_vod__c',
  CENTER_CLASSIFICATION_FIELD,
  ACCOUNT_PHASE_FIELD,
  'KPH_ATC_EID__c',
  'KPH_ATC_Certified_Date__c',
  PLAN_STATUS_FIELD,
  'KPH_Territory_Description__c',
  'KPH_Territory__c',
  ...ACCOUNT_PLAN_APPROVAL_FIELDS,
];

export const fetchPicklistOptions = async (fieldApiName) => {
  try {
    const values = await getPicklistValueLabels(
      ACCOUNT_PLAN_OBJECT,
      fieldApiName
    );

    return valuesFromPicklistLabels(values);
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const fetchDynamicPicklists = async (fields) => {
  const result = {};

  await Promise.all(
    fields.map(async (field) => {
      result[field.fieldApiName] =
        await fetchPicklistOptions(field.fieldApiName);
    })
  );

  return result;
};

export const fetchCenterClassificationOptions = () => fetchPicklistOptions(CENTER_CLASSIFICATION_FIELD);
export const fetchAccountPhaseOptions = () => fetchPicklistOptions(ACCOUNT_PHASE_FIELD);
export const fetchPlanStatusOptions = () => fetchPicklistOptions(PLAN_STATUS_FIELD);

export const displayString = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

export const uniqueValues = (values) =>
  Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));

const chunk = (arr, size = 200) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const queryByIds = async ({ object, fields, ids, idField = 'Id', extraWhere }) => {
  const unique = uniqueValues(ids);
  if (!unique.length) return [];
  const results = await Promise.all(
    chunk(unique).map((part) =>
      runQuery({
        object,
        fields,
        where: `${idField} IN ${inClause(part)}${extraWhere ? ` AND ${extraWhere}` : ''}`,
      })
    )
  );
  return results.flat();
};

export const fetchUserNamesById = async (userIds) => {
  const ids = uniqueValues(userIds);
  if (!ids.length) return new Map();
  const rows = await runQuery({
    object: USER_OBJECT,
    fields: ['Id', 'Name', 'FirstName', 'LastName'],
    where: `Id IN ${inClause(ids)}`,
  });
  const map = new Map();
  rows.forEach((row) => {
    const u = unwrap(row);
    if (u?.Id) {
      map.set(String(u.Id), {
        name: u.Name,
        firstName: u.FirstName,
        lastName: u.LastName,
      });
    }
  });
  return map;
};

const toAccountPlanRow = (row, { userNamesById = new Map() } = {}) => {
  const r = unwrap(row);
  if (!r?.Id) return null;
  const ownerUser = userNamesById.get(String(r.OwnerId || '')) || {};
  const ownerName = ownerUser.name || displayString(r.OwnerId) || null;
  return {
    id: r.Id,
    name: displayString(r.Name) || 'Unnamed Account Plan',
    eid: displayString(r.KPH_ATC_EID__c) || EMPTY_DISPLAY_VALUE,
    ownerName: ownerName || EMPTY_DISPLAY_VALUE,
    ownerFirstName:
      ownerUser.firstName ||
      ownerName?.split(/\s+/)[0] ||
      EMPTY_DISPLAY_VALUE,
    ownerLastName:
      ownerUser.lastName ||
      ownerName?.split(/\s+/).slice(1).join(' ') ||
      EMPTY_DISPLAY_VALUE,
    centerClassification: displayString(r.KPH_Center_Classification__c),
    planStatus: displayString(r.KPH_Plan_status__c),
    accountPhase: displayString(r.KPH_Account_Phase__c),
    // Every row returned here came from the Potential ATC account filter.
    potentialAtc: true,
    atcCertifiedDate: r.KPH_ATC_Certified_Date__c || null,
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
    raw: r,
  };
};

const sortLauncherRows = (rows) =>
  [...(rows || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

// Step 1: Account ids flagged Potential ATC (single-object query, iPad safe).
const fetchPotentialAtcAccountIds = async () => {
  for (const flagClause of POTENTIAL_ATC_CANDIDATES) {
    try {
      const rows = await runQuery({
        object: ACCOUNT_OBJECT,
        fields: ['Id'],
        where: `${flagClause} AND ${ACCOUNT_VALID_CLAUSE}`,
      });
      const ids = rows.map(unwrap).map((r) => r?.Id).filter(Boolean);
      if (ids.length) return ids;
    } catch (err) {
      console.warn('[potentialAtc] account query variant failed:', flagClause, err);
    }
  }
  return [];
};

export const fetchPotentialAtc = async () => {
  // Step 1: Potential ATC accounts
  const accountIds = await fetchPotentialAtcAccountIds();
  if (!accountIds.length) return [];

  // Step 2: Account Plans for those accounts
  const rows = await queryByIds({
    object: ACCOUNT_PLAN_OBJECT,
    fields: PLAN_FIELDS,
    ids: accountIds,
    idField: 'Account_vod__c',
  });

  // Step 3: owner names
  const userNamesById = await fetchUserNamesById(rows.map((row) => unwrap(row).OwnerId));

  return sortLauncherRows(
    rows
      .map((row) => toAccountPlanRow(row, { userNamesById }))
      .filter(Boolean)
  );
};

export const isPotentialAtcAccount = (plan) => plan?.potentialAtc === true;
