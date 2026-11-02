// Home (Overview) page composer.
//
// Pulls everything the six Overview tiles render:
//   • Header strip       (KPH_Ecosystem_Plan__c)
//   • Customer Goals     (Account_Plan_vod__c)
//   • Kite Strategy      (aggregated from barriers/drivers)
//   • Barriers & Drivers (top 5 each via homeSummaryTables in the view layer)
//   • Critical Activities (urgent filter applied in the view layer)
//   • POD Users          (Account_Team_Member_vod__c by ecosystem plan id)
//
// Inline edit modals on Home (barrier/driver, critical activity, team member)
// share the same save helpers as their owning pages — re-exported below so
// `Overview/index.jsx` doesn't need to know which child page owns each writer.

import {
  aggregateStrategies,
  BARRIER_DRIVER_INDICATION_FIELD,
  BARRIER_DRIVER_CATEGORY_FIELDS,
  BARRIER_DRIVER_OBJECT,
  BARRIER_DRIVER_STRATEGY_FIELD,
  buildBarrierDriverCategoryPicklistInfo,
  buildBarrierDriverStrategyPicklistInfo,
  buildOpenActivityCountByBarrier,
  CRITICAL_ACTIVITY_OBJECT,
  createSalesforceIdLookup,
  createBarrierDriver,
  createCriticalActivity,
  deleteCriticalActivity,
  deleteTeamMember,
  fetchBarriersAndDrivers,
  fetchCriticalActivities,
  fetchHeaderFields,
  fetchPlanStrategies,
  fetchPodUsers,
  fetchReferralAccounts,
  fetchTeamMembersByPlan,
  getSalesforceIdLookupEntry,
  isVisibleBarrierDriverIndication,
  normalizeBarrierDriverStatusForDisplay,
  planStrategyMapById,
  PLAN_STRATEGY_OBJECT,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  searchUsers,
  sortTeamMembersByParticipation,
  summarizeReferralActivityMetrics,
  toBarrierDriver,
  toCustomerGoals,
  updateBarrierDriver,
  updateBarrierDriverStatus,
  updateCriticalActivity,
  updateCustomerGoals,
} from '@/lib/dataservice/accountPlan/shared';
import { optionsForControllerValue } from '@/lib/dataservice/accountPlan/dependentPicklists';
import { getPicklistValueLabels } from '@/lib/dataservice/query';

const TEAM_MEMBER_OBJECT = 'Account_Team_Member_vod__c';
const ACCOUNT_OBJECT = 'Account';
const ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD = 'KPH_Market_Access_Prioritized_Account__c';

// Fallback values are only used when the runtime cannot return picklist
// metadata, such as local preview or a field-level access miss.
const mergeUnique = (...lists) => {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const v of list || []) {
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
};

const picklistInfoFromLabels = (labels) => {
  const values = [];
  const labelByValue = {};
  const seen = new Set();
  const add = (value, label) => {
    if (value === null || value === undefined || value === '') return;
    const apiValue = String(value);
    if (!seen.has(apiValue)) {
      seen.add(apiValue);
      values.push(apiValue);
    }
    labelByValue[apiValue] = label === null || label === undefined || label === '' ? apiValue : String(label);
  };
  if (!labels) return { values, labels: labelByValue };
  if (Array.isArray(labels)) {
    for (const entry of labels) {
      if (!entry) continue;
      if (typeof entry === 'string') {
        add(entry, entry);
        continue;
      }
      if (typeof entry !== 'object') continue;
      const value = entry.value || entry.apiValue || entry.apiName || entry.name || entry.label || null;
      const label = entry.label || entry.displayLabel || entry.translatedLabel || entry.name || value;
      add(value, label);
    }
    return { values, labels: labelByValue };
  }
  if (typeof labels === 'object') {
    for (const [value, label] of Object.entries(labels)) add(value, label);
  }
  return { values, labels: labelByValue };
};

const valuesFromPicklistLabels = (labels) => picklistInfoFromLabels(labels).values;

const picklistLabelForValue = (labels, value) => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value);
  return labels?.[text] || text;
};

const fetchPicklistInfo = (objectApi, fieldApi) =>
  getPicklistValueLabels(objectApi, fieldApi)
    .then(picklistInfoFromLabels)
    .catch(() => ({ values: [], labels: {} }));

const fetchPicklistOptions = (objectApi, fieldApi) =>
  getPicklistValueLabels(objectApi, fieldApi)
    .then(valuesFromPicklistLabels)
    .catch(() => []);


const visibleIndications = (values) =>
  (values || []).filter(isVisibleBarrierDriverIndication);

const fetchHomePicklists = async () => {
  const [
    barrierStatuses,
    barrierIndications,
    strategyPicklist,
    strategyRanks,
    barrierCategoryPicklist,
    driverCategoryPicklist,
    impactLevels,
    activityStatuses,
    activityIndications,
    accountableMembers,
    participationOptions,
    marketAccessPrioritizedPicklist,
  ] = await Promise.all([
    fetchPicklistOptions(BARRIER_DRIVER_OBJECT, 'KPH_Status__c'),
    fetchPicklistOptions(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_INDICATION_FIELD),
    fetchPicklistInfo(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_STRATEGY_FIELD),
    fetchPicklistOptions(PLAN_STRATEGY_OBJECT, 'KPH_Strategy_Rank__c'),
    fetchPicklistInfo(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_CATEGORY_FIELDS.barrier),
    fetchPicklistInfo(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_CATEGORY_FIELDS.driver),
    fetchPicklistOptions(BARRIER_DRIVER_OBJECT, 'KPH_Rank_1__c'),
    fetchPicklistOptions(CRITICAL_ACTIVITY_OBJECT, 'KPH_Status__c'),
    fetchPicklistOptions(CRITICAL_ACTIVITY_OBJECT, 'KPH_Indication__c'),
    fetchPicklistOptions(CRITICAL_ACTIVITY_OBJECT, 'KPH_Accountable_POD_Members__c'),
    fetchPicklistOptions(TEAM_MEMBER_OBJECT, 'KPH_Participation__c'),
    fetchPicklistInfo(ACCOUNT_OBJECT, ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD),
  ]);
  const strategyOptions = mergeUnique(strategyPicklist.values);
  const strategyInfo = buildBarrierDriverStrategyPicklistInfo(
    strategyOptions,
    strategyPicklist.labels,
    barrierIndications
  );
  const strategyOptionsByIndication = strategyInfo.strategyOptionsByIndication;
  const strategiesForIndication = (indication) =>
    optionsForControllerValue(strategyOptionsByIndication, indication) ||
    (strategyInfo.hasIndicationFilters ? [] : strategyOptions);
  const driverCategoryInfo = buildBarrierDriverCategoryPicklistInfo(
    driverCategoryPicklist.values,
    driverCategoryPicklist.labels,
    barrierIndications
  );

  return {
    barrierStatuses,
    barrierIndications,
    dlbclStrategies: strategiesForIndication('DLBCL'),
    portfolioStrategies: strategiesForIndication('Portfolio'),
    mmStrategies: strategiesForIndication('MM'),
    barrierStrategies: strategyOptions,
    strategyLabels: strategyInfo.strategyLabels,
    strategyOptionsByIndication,
    hasStrategyIndicationFilters: strategyInfo.hasIndicationFilters,
    strategyRanks,
    categoryLabels: {
      ...(barrierCategoryPicklist.labels || {}),
      ...driverCategoryInfo.categoryLabels,
    },
    barrierCategoryOptionsByIndication: {},
    driverCategoryOptionsByIndication: driverCategoryInfo.categoryOptionsByIndication,
    dlbclBarrierCategories: barrierCategoryPicklist.values,
    dlbclDriverCategories: driverCategoryPicklist.values,
    barrierCategories: mergeUnique(barrierCategoryPicklist.values, driverCategoryPicklist.values),
    impactLevels,
    activityStatuses,
    activityIndications,
    accountableMembers,
    participationOptions,
    marketAccessPrioritizedLabels: marketAccessPrioritizedPicklist.labels,
    marketAccessPrioritizedOptions: marketAccessPrioritizedPicklist.values,
  };
};

export const loadHome = async () => {
  const planId = await requireCurrentAccountPlanId();
  const shellContextPromise = resolveShellContextForPlanId(planId);

  // Fan out everything that only depends on the current plan id. Shell context
  // still resolves the plan/account for the sidebar, but it no longer blocks
  // the page-specific reads.
  const [shellContext, headerResult, barrierResult, activities, teamMembers, planStrategies, dynamicPicklists] = await Promise.all([
    shellContextPromise,
    fetchHeaderFields(planId),
    fetchBarriersAndDrivers(planId),
    fetchCriticalActivities(planId),
    fetchTeamMembersByPlan(planId),
    fetchPlanStrategies(planId),
    fetchHomePicklists(),
  ]);
  const { planRow, plan, account } = shellContext;
  const { rows: barrierRows, access: barrierDriverAccess } = barrierResult;

  // These both depend on the Ecosystem Plan id from the header query, but not
  // on each other.
  const [referralAccounts, podUsers] = await Promise.all([
    fetchReferralAccounts(planId, headerResult.ecosystemPlanId),
    fetchPodUsers(headerResult.ecosystemPlanId),
  ]);
  const header = {
    ...(headerResult.header || {}),
    ...summarizeReferralActivityMetrics(referralAccounts),
    // MM ATC Priority lives on the Account record (KPH_MM_ATC_Priority__c).
    mmAtcPriority: account?.mmAtcPriority || null,
    marketAccessPrioritizedAccount: picklistLabelForValue(
      dynamicPicklists.marketAccessPrioritizedLabels,
      account?.marketAccessPrioritizedAccount
    ),
  };

  // Derive the shapes the React components consume.
  const customerGoals = toCustomerGoals(planRow);
  const strategyLabels = dynamicPicklists.strategyLabels || {};
  const strategies = aggregateStrategies(barrierRows, strategyLabels);
  const planStrategyById = planStrategyMapById(planStrategies);
  const categoryLabels = dynamicPicklists.categoryLabels || {};
  const barriersDrivers = barrierRows
    .map((row) => toBarrierDriver(row, barrierDriverAccess, planStrategyById, { strategyLabels, categoryLabels }))
    .filter(Boolean)
    .filter((record) => isVisibleBarrierDriverIndication(record.indication));
  const barriers = barriersDrivers.filter((r) => r.type === 'Barrier');
  const drivers = barriersDrivers.filter((r) => r.type === 'Driver');
  const barrierById = createSalesforceIdLookup(barriersDrivers);
  const visibleActivities = activities.filter((activity) =>
    isVisibleBarrierDriverIndication(activity?.indication) &&
    (!activity?.barrierDriverId || getSalesforceIdLookupEntry(barrierById, activity.barrierDriverId))
  );

  // Enrich activities with parentName/parentType so the home edit modal can
  // show the linked barrier/driver without re-mapping per render.
  const enrichedActivities = visibleActivities.map((a) => {
    const parent = a.barrierDriverId ? getSalesforceIdLookupEntry(barrierById, a.barrierDriverId) : null;
    return {
      ...a,
      indication: parent ? (parent.indication || a.indication || '') : (a.indication || ''),
      barrierDriverId: parent ? parent.id : a.barrierDriverId,
      parentName: parent ? parent.name : (a.barrierDriverId ? 'Linked record unavailable' : 'Plan-level'),
      parentType: parent ? parent.type : (a.parentType || null),
      parentRecordTypeId: parent ? (parent.recordTypeId || null) : null,
    };
  });
  const openActivityCountByBarrier = buildOpenActivityCountByBarrier(enrichedActivities);

  // Lightweight picklists for the home edit modals — strictly from CRM metadata
  // only. No hardcoded fallback and never unioned with values on existing
  // records. ("type" is the record type, not a CRM picklist.)
  const strategyOptions = dynamicPicklists.barrierStrategies || [];
  const dlbclStrategies = dynamicPicklists.dlbclStrategies || strategyOptions;
  const portfolioStrategies = dynamicPicklists.portfolioStrategies || strategyOptions;
  const mmStrategies = dynamicPicklists.mmStrategies || strategyOptions;
  const dlbclBarrierCategories = dynamicPicklists.dlbclBarrierCategories || [];
  const dlbclDriverCategories = dynamicPicklists.dlbclDriverCategories || [];
  const categoryOptions = mergeUnique(
    dlbclBarrierCategories,
    dlbclDriverCategories
  );

  const picklists = {
    barrierTypes: ['Barrier', 'Driver'],
    barrierStatuses: (dynamicPicklists.barrierStatuses || []).map(normalizeBarrierDriverStatusForDisplay),
    barrierDriverIndications: visibleIndications(dynamicPicklists.barrierIndications),
    barrierStrategies: strategyOptions,
    strategyLabels,
    categoryLabels,
    dlbclStrategies,
    portfolioStrategies,
    mmStrategies,
    strategyOptionsByIndication: dynamicPicklists.strategyOptionsByIndication || {},
    strategyRanks: dynamicPicklists.strategyRanks || [],
    barrierCategoryOptionsByIndication: dynamicPicklists.barrierCategoryOptionsByIndication || {},
    driverCategoryOptionsByIndication: dynamicPicklists.driverCategoryOptionsByIndication || {},
    barrierCategories: categoryOptions,
    dlbclBarrierCategories,
    dlbclDriverCategories,
    impactLevels: dynamicPicklists.impactLevels || [],
    activityStatuses: dynamicPicklists.activityStatuses || [],
    activityIndications: visibleIndications(dynamicPicklists.activityIndications),
    accountableMembers: dynamicPicklists.accountableMembers || [],
    participationOptions: dynamicPicklists.participationOptions || [],
    marketAccessPrioritizedOptions: dynamicPicklists.marketAccessPrioritizedOptions || [],
  };

  return {
    planId,
    plan,
    account,
    header,
    customerGoals,
    strategies,
    barriers,
    drivers,
    criticalActivities: enrichedActivities,
    openActivityCountByBarrier,
    podUsers,
    teamMembers,
    picklists,
  };
};

export const saveCustomerGoals = updateCustomerGoals;
export const saveBarrierDriver = updateBarrierDriver;
export const saveBarrierDriverStatus = updateBarrierDriverStatus;
export const addBarrierDriver = createBarrierDriver;
export const saveCriticalActivity = updateCriticalActivity;
export const addCriticalActivity = createCriticalActivity;
export { deleteCriticalActivity };
export { deleteTeamMember, searchUsers, sortTeamMembersByParticipation };
