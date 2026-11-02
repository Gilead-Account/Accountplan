// Account Profile page composer.
//
// Pulls everything the three Account Profile tabs render:
//   • Profile             — KPH_Ecosystem_Plan__c (full set, not the Home slice)
//   • Referral & Dynamics — KPH_Ecosystem_Map_Dynamics__c (referrals) +
//                           KPH_Other_Healthcare_Networks__c (account-scoped) +
//                           regional dynamics fields on the profile record
//   • Account Insights    — KPH_Monthly_Executive_Summary__c
//
// CRUD wrappers (save/create/delete) are re-exported so the page can call
// them directly. Field maps live in `shared.js`.

import {
  ACCOUNT_INSIGHT_OBJECT,
  createAccountInsight,
  createHealthcareNetwork,
  createReferralAccount,
  ACCOUNT_PROFILE_OBJECT,
  deleteAccountInsight as softDeleteAccountInsight,
  deleteHealthcareNetwork as softDeleteHealthcareNetwork,
  deleteReferralAccount as softDeleteReferralAccount,
  fetchAccountProfile,
  fetchAccountProfileChildRecords,
  MM_PROFILE_FIELD_API_NAMES,
  REFERRAL_ACCOUNT_OBJECT,
  REGIONAL_DYNAMICS_DLBCL_FIELD,
  REGIONAL_DYNAMICS_MM_FIELD,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  searchSiteAccounts,
  summarizeReferralActivityMetrics,
  updateAccountInsight,
  updateAccountProfileField,
  updateHealthcareNetwork,
  updateReferralAccount,
} from '@/lib/dataservice/accountPlan/shared';
import { getPicklistValueLabels } from '@/lib/dataservice/query';

const PROFILE_YESNO_OPTIONS = [
  { value: '', label: '-' },
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

const REFERRAL_INDICATION_FIELD = 'Indication__c';
const ACCOUNT_INSIGHT_INDICATION_FIELD = 'Indication__c';
const REFERRAL_CATEGORY_FIELD = 'KPH_Insight_Category__c';
const ACCOUNT_CATEGORY_INDICATION_FIELD = 'KPH_Insight_Category__c';

const ATTRIBUTE_DEFS = [
  { key: 'atcCohort', label: 'ATC Cohort DLBCL', type: 'text', source: 'profile', field: 'atcCohort' },
  { key: 'atcSegment', label: 'ATC Segment DLBCL', type: 'text', source: 'profile', field: 'atcSegment' },
  { key: 'mmAtcPriority', label: 'MM ATC Priority', type: 'text', source: 'account', field: 'mmAtcPriority' },
  { key: 'kltSprint', label: 'LT Focus/ Sprint Account', type: 'boolean', source: 'profile', field: 'kltSprintAccount' },
  { key: 'aallTarget', label: 'aALL Target', type: 'boolean', source: 'profile', field: 'aallTarget' },
  { key: 'qVsQCartVolumeTrend', label: 'Q vs Q CAR-T Volume Trend', type: 'text', source: 'profile', field: 'cartVolumeTrend' },
  { key: 'referralVolume', label: 'Referral Volume DLBCL', type: 'text', source: 'profile', field: 'referralVolume' },
  { key: 'secondLinePlusVolume', label: '2L+ DLBCL Treated patient', type: 'text', source: 'profile', field: 'secondLinePlusVolume' },
];

const REIMBURSEMENT_DEFS = [
  { key: 'payerMix', label: 'Payer Mix', type: 'text', source: 'profile', field: 'payerMix' },
  { key: 'payerType', label: 'Payer Type', type: 'text', source: 'profile', field: 'payerType' },
  { key: 'topPayers', label: 'Top 3 Payers', type: 'text', source: 'profile', field: 'topPayersName' },
];

// DLBCL Profile questions map 1:1 to a Veeva field on KPH_Ecosystem_Plan__c.
// `crmField` is the SF API name — used by the inline editor's save handler so
// each saved answer is persisted to the right column.
const DLBCL_PROFILE_QUESTIONS = [
  { key: 'capacityImpact', label: 'Is capacity having an impact on CART?', type: 'yesno', field: 'dlbclCapacityImpact', crmField: 'KPH_Is_capacity_having_an_impact_on_CART__c' },
  { key: 'opBusinessPct', label: 'What % of CART business is done OP?', type: 'text', field: 'dlbclOpBusinessPct', crmField: 'KPH_What_of_CART_business_is_done_OP__c' },
  { key: 'financialConstraint', label: 'Financial / reimbursement constraint?', type: 'yesno', field: 'dlbclFinancialConstraint', crmField: 'KPH_Financial_and_or_reimbursement__c' },
  { key: 'preferOpSetting', label: 'Does ATC prefer CART administration in OP?', type: 'text', field: 'dlbclPreferOpSetting', crmField: 'KPH_Does_ATC_prefer_CART_administration__c' },
  { key: 'opSettingReasons', label: 'If yes, what are the reasons?', type: 'multipicklist', field: 'dlbclOpSettingReasons', crmField: 'KPH_If_Yes_to_above_reasons__c', dependsOn: 'preferOpSetting', showWhenParentHasValue: true },
  { key: 'bispecificTiming', label: 'Bispecifics for DLBCL being used?', type: 'yesno', field: 'dlbclBispecificTiming', crmField: 'KPH_Bispecifics_for_DLBCL_being_used__c' },
  { key: 'bispecificImpact', label: 'Does bispecific use in DLBCL impact CART?', type: 'text', field: 'dlbclBispecificImpact', crmField: 'KPH_Bispecific_use_in_DLBCL_impact_CART__c' },
  { key: 'opUseDetails', label: 'If ATC is using OP, do they...?', type: 'text', field: 'dlbclOpUseDetails', crmField: 'KPH_If_ATC_is_using_OP_do_they__c' },
  { key: 'breyanziCompetition', label: 'Direct competition from Breyanzi?', type: 'yesno', field: 'dlbclBreyanziCompetition', crmField: 'KPH_Is_there_direct_competition_from__c' },
  { key: 'breyanziIndication', label: 'If yes, in what indication?', type: 'multipicklist', field: 'dlbclBreyanziIndication', crmField: 'KPH_If_yes_in_what_indication__c', dependsOn: 'breyanziCompetition' },
];

const sourceLookup = ({ plan, account, profile }) => ({ plan, account, profile });

const valueFromDef = (def, sources) => {
  if (Object.prototype.hasOwnProperty.call(def, 'staticValue')) return def.staticValue;
  const src = sources[def.source];
  if (!src) return null;
  return src[def.field];
};

const buildAttributeRows = (sources) =>
  ATTRIBUTE_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    helpKey: def.key,
    value: valueFromDef(def, sources),
  }));

const buildReimbursementRows = (sources) =>
  REIMBURSEMENT_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    helpKey: def.key,
    value: valueFromDef(def, sources),
  }));

const picklistOptionsFromLabels = (labels) => {
  if (!labels) return [];
  if (Array.isArray(labels)) {
    return labels
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') return { value: entry, label: entry };
        if (typeof entry !== 'object') return null;
        const value =
          entry.value ||
          entry.apiValue ||
          entry.apiName ||
          entry.name ||
          entry.label ||
          null;
        if (value === null || value === undefined || value === '') return null;
        return {
          value: String(value),
          label: String(entry.label || entry.displayLabel || entry.name || value),
        };
      })
      .filter(Boolean);
  }
  if (typeof labels === 'object') {
    // Veeva returns a value -> translated-label map. Save the API value, but
    // display the translated label when one is available.
    return Object.entries(labels)
      .map(([value, label]) => {
        if (value === null || value === undefined || value === '') return null;
        return {
          value: String(value),
          label: String(label || value),
        };
      })
      .filter(Boolean);
  }
  return [];
};

const mergePicklistOptions = (...optionGroups) => {
  const seen = new Set();
  const out = [];
  const addOption = (option) => {
    if (!option) return;
    const rawValue =
      typeof option === 'object' && option !== null && 'value' in option ? option.value : option;
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    const value = String(rawValue);
    if (seen.has(value)) return;
    seen.add(value);
    const rawLabel =
      typeof option === 'object' && option !== null && option.label ? option.label : value;
    out.push({ value, label: String(rawLabel) });
  };

  for (const group of optionGroups) {
    if (Array.isArray(group)) {
      group.forEach(addOption);
    } else {
      addOption(group);
    }
  }
  return [{ value: '', label: '-' }, ...out];
};

const fetchProfileQuestionPicklists = async () => {
  const entries = await Promise.all(
    DLBCL_PROFILE_QUESTIONS.map((def) =>
      getPicklistValueLabels(ACCOUNT_PROFILE_OBJECT, def.crmField)
        .then((labels) => [def.crmField, picklistOptionsFromLabels(labels)])
        .catch(() => [def.crmField, []])
    )
  );
  return Object.fromEntries(entries);
};

const fetchReferralIndicationPicklist = () =>
  getPicklistValueLabels(REFERRAL_ACCOUNT_OBJECT, REFERRAL_INDICATION_FIELD)
    .then(picklistOptionsFromLabels)
    .catch(() => []);

 const fetchReferralCategoryPicklist = () =>
  getPicklistValueLabels(REFERRAL_ACCOUNT_OBJECT, REFERRAL_CATEGORY_FIELD)
    .then(picklistOptionsFromLabels)
    .catch(() => []);   

const fetchAccountInsightIndicationPicklist = () =>
  getPicklistValueLabels(ACCOUNT_INSIGHT_OBJECT, ACCOUNT_INSIGHT_INDICATION_FIELD)
    .then(picklistOptionsFromLabels)
    .catch(() => []);

const fetchAccountInsightCategoryPicklist = () =>
  getPicklistValueLabels(ACCOUNT_INSIGHT_OBJECT, ACCOUNT_CATEGORY_INDICATION_FIELD)
    .then(picklistOptionsFromLabels)
    .catch(() => []);


const MM_PROFILE_PICKLIST_FIELDS = [
  MM_PROFILE_FIELD_API_NAMES.factAccredited,
  MM_PROFILE_FIELD_API_NAMES.anitoCelTrialSite,
  MM_PROFILE_FIELD_API_NAMES.cartProgramStructure,
];

const fetchMmProfilePicklists = async () => Object.fromEntries(
  await Promise.all(MM_PROFILE_PICKLIST_FIELDS.map(async (field) => [
    field,
    await getPicklistValueLabels(ACCOUNT_PROFILE_OBJECT, field)
      .then(picklistOptionsFromLabels)
      .catch(() => []),
  ]))
);

const buildProfileQuestionColumns = (profile, picklists = {}) => {
  const half = Math.ceil(DLBCL_PROFILE_QUESTIONS.length / 2);
  const toItem = (def) => {
    const value = profile ? profile[def.field] : null;
    return {
      key: def.key,
      label: def.label,
      type: def.type,
      inputType: def.type === 'multipicklist' ? 'multipicklist' : 'picklist',
      field: def.field,
      crmField: def.crmField,
      value,
      dependsOn: def.dependsOn || null,
      showWhenParentHasValue: Boolean(def.showWhenParentHasValue),
      isMultiSelect: def.type === 'multipicklist',
      options: picklists[def.crmField] || [],
    };
  };
  return [
    DLBCL_PROFILE_QUESTIONS.slice(0, half).map(toItem),
    DLBCL_PROFILE_QUESTIONS.slice(half).map(toItem),
  ];
};

export const loadAccountProfile = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const shellContextPromise = resolveShellContextForPlanId(planContextId);
  const profilePromise = fetchAccountProfile(planContextId);
  const childRecordsPromise = profilePromise.then((profileRecord) => {
    const profileRecordId = profileRecord?.id || null;
    return fetchAccountProfileChildRecords(planContextId, profileRecordId);
  });

  const [
    shellContext,
    profile,
    profileQuestionPicklists,
    referralIndicationPicklist,
    referralCategoryPicklist,
    accountInsightIndicationPicklist,
    accountInsightCategoryPicklist,
    mmProfilePicklists,
    childRecords,
  ] = await Promise.all([
    shellContextPromise,
    profilePromise,
    fetchProfileQuestionPicklists(),
    fetchReferralIndicationPicklist(),
    fetchReferralCategoryPicklist (),
    fetchAccountInsightIndicationPicklist(),
    fetchAccountInsightCategoryPicklist(),
    fetchMmProfilePicklists(),
    childRecordsPromise,
  ]);
  const { planId, plan, account } = shellContext;
  const profileId = profile?.id || null;
  const {
    referralAccounts,
    accountInsights,
    healthcareNetworks,
  } = childRecords;

  const referralMetrics = summarizeReferralActivityMetrics(referralAccounts);
  const profileWithReferralMetrics = profile ? { ...profile, ...referralMetrics } : referralMetrics;
  const sources = sourceLookup({ plan, account, profile: profileWithReferralMetrics });
  const referralDataIndications = referralAccounts.map((row) => row.indication).filter(Boolean);
  const referralDataCategorys = referralAccounts.map((row) => row.insightCategory).filter(Boolean);
  const accountInsightDataIndications = accountInsights.map((row) => row.indication).filter(Boolean);
  const accountInsightDataCategorys = accountInsights.map((row) => row.insightCategory).filter(Boolean);

  return {
    planId,
    plan,
    account,
    profile,
    profileId,
    accountAttributeRows: buildAttributeRows(sources),
    reimbursementRows: buildReimbursementRows(sources),
    profileQuestionColumns: buildProfileQuestionColumns(profile, profileQuestionPicklists),
    mmProfile: profile?.mmProfile || {},
    mmProfilePicklists,
    profileQuestionYesNoOptions: PROFILE_YESNO_OPTIONS,
    referralIndicationOptions: mergePicklistOptions(
      referralIndicationPicklist,
      referralDataIndications
    ),
     referralCategoryOptions: mergePicklistOptions(
      referralCategoryPicklist,
      referralDataCategorys
    ),
    accountInsightIndicationOptions: mergePicklistOptions(
      accountInsightIndicationPicklist,
      accountInsightDataIndications
    ),
    accountInsightCategoryOptions: mergePicklistOptions(
      accountInsightCategoryPicklist,
      accountInsightDataCategorys
    ),
    referralAccounts,
    healthcareNetworks,
    regionalDynamics: {
      DLBCL: profile?.regionDynamicsDlbcl || '',
      MM: profile?.regionDynamicsMm || '',
    },
    regionalDynamicsFieldMap: {
      DLBCL: profile?.regionDynamicsDlbclField || REGIONAL_DYNAMICS_DLBCL_FIELD,
      MM: profile?.regionDynamicsMmField || REGIONAL_DYNAMICS_MM_FIELD,
    },
    accountInsights,
  };
};

// CRUD wrappers re-exported so the page can call them by name.
export const saveProfileAnswer = updateAccountProfileField;
export const saveReferralAccount = updateReferralAccount;
export const addReferralAccount = createReferralAccount;
export const deleteReferralAccount = softDeleteReferralAccount;
export const searchReferralSiteAccounts = searchSiteAccounts;
export const saveHealthcareNetwork = updateHealthcareNetwork;
export const addHealthcareNetwork = createHealthcareNetwork;
export const deleteHealthcareNetwork = softDeleteHealthcareNetwork;
export const searchHealthcareNetworkAccounts = searchSiteAccounts;
export const saveAccountInsight = updateAccountInsight;
export const addAccountInsight = createAccountInsight;
export const deleteAccountInsight = softDeleteAccountInsight;
