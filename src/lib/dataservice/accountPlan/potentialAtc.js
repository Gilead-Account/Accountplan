import {
  inClause,
  runQuery,
  unwrap,
} from '@/lib/dataservice/query';
import { getPicklistValueLabels, toBoolean } from '../query';
import { formatDateLabel, valuesFromPicklistLabels } from '../../helper/utils';

const ACCOUNT_PLAN_OBJECT = 'Account_Plan_vod__c';
const USER_OBJECT = 'User';
const EMPTY_DISPLAY_VALUE = '-';
const VALID_STATUS_CLAUSE ="Account_vod__r.Customer_Master_Status_vod__c ='Valid_vod'";

export const WHERE_ATC_HOSPITAL=`Account_vod__r.Hospital_Type__c = 'Authorized Treatment Center' AND ${VALID_STATUS_CLAUSE}`;
export const WHERE_POTENTAIL_ATC=`Account_vod__r.KPH_Potential_ATC__c = true AND ${VALID_STATUS_CLAUSE}`;

const POTENTIAL_ATC_WHERE_VARIANTS =[
  WHERE_POTENTAIL_ATC,
  `Account_vod__r.KPH_Potential_ATC__c = true AND ${VALID_STATUS_CLAUSE}`,
]
const CENTER_CLASSIFICATION_FIELD = 'KPH_Center_Classification__c';
const ACCOUNT_PHASE_FIELD ='KPH_Account_Phase__c';
const PLAN_STATUS_FIELD ='KPH_Plan_status__c';


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
  'KPH_Potential_ATC__c',
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

export const fetchCenterClassificationOptions=()=> fetchPicklistOptions(CENTER_CLASSIFICATION_FIELD);
export const fetchAccountPhaseOptions =() =>fetchPicklistOptions(ACCOUNT_PHASE_FIELD);
export const fetchPlanStatusOptions = () => fetchPicklistOptions(PLAN_STATUS_FIELD);

const BASE_FIELDS = [
  'Id',
  'Name',
  'OwnerId',
  'Account_vod__c',
  'KPH_Center_Classification__c',
  'KPH_Account_Phase__c',
  'KPH_ATC_EID__c',
  'KPH_ATC_Certified_Date__c',
  'KPH_Plan_status__c',
  'KPH_Territory_Description__c',
  'KPH_Territory__c',
  ...ACCOUNT_PLAN_APPROVAL_FIELDS,
  'Account_vod__r.KPH_Potential_ATC__c',
  'KPH_Dry_Run_Date__c'
];
export const RELATIONSHIP_FIELDS = [
  'Id',
  'Name',
  'OwnerId',
  'Account_vod__c',
  'Owner.Name',
  'Owner.FirstName',
  'Owner.LastName',
  ...BASE_FIELDS.slice(4),
];

export const FALLBACK_FIELDS =BASE_FIELDS;

export const displayString = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

export const relatedName = (row, relationshipKey, dottedKey) => {
  const direct = row?.[dottedKey];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const relationship = row?.[relationshipKey];
  if (relationship && typeof relationship === 'object') {
    const name = relationship.Name || relationship.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
};

export const relatedValue = (row, relationshipKey, fieldName, dottedKey) => {
  const direct = row?.[dottedKey];
  if (direct !== null && direct !== undefined && String(direct).trim()) return String(direct).trim();
  const relationship = row?.[relationshipKey];
  const value = relationship && typeof relationship === 'object' ? relationship[fieldName] : null;
  return value !== null && value !== undefined && String(value).trim() ? String(value).trim() : null;
};

export const uniqueValues = (values) =>
  Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));

const chunk = (arr, size =200)=>{
  const out =[];
  for(let i = 0; i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}

const queryByIds = async({ object, fields, ids, idField ='Id', extraWhere})=>{
  const unique = uniqueValues(ids);
  if(!unique.length) return [];
  const results = await Promise.all(
    chunk(unique).map((part)=>
      runQuery({
        object,
        fields,
        where:`${idField} IN ${inClause(part)} ${extraWhere ? ` AND ${extraWhere}` : ''}`,
      })
    )
  )
  return results.flat();
}

export const fetchUserNamesById = async (userIds) => {
  const rows = await queryByIds({
    object: USER_OBJECT,
    fields: ['Id', 'Name', 'FirstName', 'LastName'],
    ids :userIds,
  });
  const map = new Map();
  rows.forEach((row)=>{
    const u = unwrap(row);
    if(u?.Id){
      map.set(String(u.Id),{
        name:u.Name,
        firstName:u.FirstName,
        lastName:u.LastName,
      });
    }
  })
 return map;
}; 

export const needsUserNameLookup = (rows) =>
  rows.some((row) => {
    const r = unwrap(row);
    if (!r) return false;
    const missingOwnerFirstName = r.OwnerId && !relatedValue(r, 'Owner', 'FirstName', 'Owner.FirstName');
    const missingOwnerLastName = r.OwnerId && !relatedValue(r, 'Owner', 'LastName', 'Owner.LastName');
    return missingOwnerFirstName || missingOwnerLastName;
  });

  export const formatDate = (value) => {
  if (!value) return '--'
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if(m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
};
const toAccountPlanRow = (row, {userNamesById = new Map()} = {}) => {
  const r = unwrap(row);
  if (!r?.Id) return null;
  const ownerUser = userNamesById.get(String(r.OwnerId || '')) || {};
  const ownerName = relatedName(r, 'Owner', 'Owner.Name') || ownerUser.name || displayString(r.OwnerId) || null;
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
    centerClassification: displayString(r.KPH_Center_Classification__c),
    planStatus: displayString(r.KPH_Plan_status__c),
    accountPhase: displayString(r.KPH_Account_Phase__c),
    dryRunDate: formatDate(r.KPH_Dry_Run_Date__c),
    potentialAtc:toBoolean(r['Account_vod__r.KPH_Potential_ATC__c'] ?? r.Account_vod__r?.KPH_Potential_ATC__c??true), 
    atcCertifiedDate: r.KPH_ATC_Certified_Date__c || null,
    territory: displayString(r.KPH_Territory__c) || EMPTY_DISPLAY_VALUE,
    territoryDescription: displayString(r.KPH_Territory_Description__c) || EMPTY_DISPLAY_VALUE,
    raw:r,
  };
};

const sortLauncherRows = (rows) =>
  [...(rows || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

const fetchPlans = async ({ allowRelationshipFields = true, where = WHERE_ATC_HOSPITAL } = {}) =>
  runQuery({
    object: ACCOUNT_PLAN_OBJECT,
    fields: allowRelationshipFields
      ? RELATIONSHIP_FIELDS
      : FALLBACK_FIELDS,
    where,
    sort: ['Name ASC'],
    ...(allowRelationshipFields ? { allowDottedFields: true } : {}),
  });

  const fetchPotentialAtcPlans = async(where)=>{
    try{
      return{ rows: await fetchPlans({allowRelationshipFields:true, where}), usedFallbackQuery:false};
    }
    catch(error){
      return{ rows: await fetchPlans({allowRelationshipFields:false, where}), usedFallbackQuery:true};
    }
  }
  
export const fetchPotentialAtc = async () => {
  let rows;
  let usedFallbackQuery = false;
  try {
    rows = await fetchPlans({ allowRelationshipFields: true, where: WHERE_POTENTAIL_ATC, });
  } catch (error) {
    console.warn('[accountPlanLauncher] relationship-field query failed; retrying with User lookup.', error);
    usedFallbackQuery = true;
    rows = await fetchPlans({ allowRelationshipFields: false , where: WHERE_POTENTAIL_ATC,});
  }
  const shouldFetchUserNames = usedFallbackQuery || needsUserNameLookup(rows);
  const userNamesById = shouldFetchUserNames
   ?await fetchUserNamesById(rows.map((row) => unwrap(row).OwnerId))
   :new Map();
  return sortLauncherRows(
    rows
      .map((row) => toAccountPlanRow(row, {userNamesById})).filter(Boolean)
  );
};


export const isPotentialAtcAccount = (plan) =>plan?.potentialAtc === true;