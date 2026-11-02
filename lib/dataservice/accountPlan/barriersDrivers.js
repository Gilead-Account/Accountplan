// Barriers & Drivers page composer.
//
// Same source object as the Home summary (KPH_Barriers_and_Tactical_Actions__c),
// but presented in full detail: every row, every column, plus per-row activity
// list (not just the count). Also pulls team members so the "Accountable"
// dropdown in the critical-activity modal can offer real POD names.

import {
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
  fetchBarriersAndDrivers,
  fetchCriticalActivities,
  fetchPlanStrategies,
  getSalesforceIdLookupEntry,
  isOpenBarrierDriverStatus,
  isVisibleBarrierDriverIndication,
  normalizeBarrierDriverStatusForDisplay,
  planStrategyMapById,
  PLAN_STRATEGY_OBJECT,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  toBarrierDriver,
  updateBarrierDriver,
  updateBarrierDriverStatus,
  updateCriticalActivity,
} from '@/lib/dataservice/accountPlan/shared';
import * as sharedApi from '@/lib/dataservice/accountPlan/shared';
import {
  fetchDependencyOptionsFromObjectMetadata,
  optionsForControllerValue,
} from '@/lib/dataservice/accountPlan/dependentPicklists';
import { getPicklistValueLabels } from '@/lib/dataservice/query';

const OPEN_STATUSES = new Set(['Open', 'Planned', 'In Progress']);
const COMPLETED_STATUSES = new Set(['Complete', 'Completed', 'Closed']);

const isOpenActivity = (activity) =>
  activity && activity.isDeactivated !== true && OPEN_STATUSES.has(activity.status);

const isCompletedRecently = (activity) => {
  if (!activity || activity.isDeactivated === true) return false;
  if (!COMPLETED_STATUSES.has(activity.status)) return false;
  const ref = activity.completedDate || activity.lastModifiedDate;
  if (!ref) return false;
  const when = new Date(ref);
  if (Number.isNaN(when.getTime())) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 90);
  return when.getTime() >= cutoff.getTime();
};

// Fallback values are only used when the runtime cannot return picklist
// metadata, such as local preview or a field-level access miss.
const mergeWithDataValues = (base, valuesFromData) => {
  const seen = new Set();
  const out = [];
  for (const v of [...base, ...valuesFromData]) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
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
    // Veeva returns a value -> translated-label map. Use the API value so
    // create/update writes the exact picklist value back to CRM.
    for (const [value, label] of Object.entries(labels)) add(value, label);
  }
  return { values, labels: labelByValue };
};

const valuesFromPicklistLabels = (labels) => picklistInfoFromLabels(labels).values;

const fetchPicklistInfo = (objectApi, fieldApi) =>
  getPicklistValueLabels(objectApi, fieldApi)
    .then(picklistInfoFromLabels)
    .catch(() => ({ values: [], labels: {} }));

const fetchPicklistOptions = (objectApi, fieldApi) =>
  getPicklistValueLabels(objectApi, fieldApi)
    .then(valuesFromPicklistLabels)
    .catch(() => []);

const normalizeCategories = (values) =>
  mergeWithDataValues([], (values || []).filter(Boolean));

const visibleIndications = (values) =>
  (values || []).filter(isVisibleBarrierDriverIndication);

const categoryPicklistGroup = (picklist, indications) => {
  const options = normalizeCategories(picklist.values);
  const info = buildBarrierDriverCategoryPicklistInfo(options, picklist.labels, indications);
  return {
    options,
    labels: info.categoryLabels,
    optionsByIndication: info.categoryOptionsByIndication,
    hasIndicationFilters: info.hasIndicationFilters,
  };
};

const unrestrictedCategoryPicklistGroup = (picklist) => {
  const options = normalizeCategories(picklist.values);
  return {
    options,
    labels: picklist.labels || {},
    optionsByIndication: {},
    hasIndicationFilters: false,
  };
};

const fetchBarrierDriverPicklists = async () => {
  const [
    statuses,
    indications,
    strategyPicklist,
    strategyRanks,
    barrierCategories,
    driverCategories,
    impactLevels,
  ] = await Promise.all([
    fetchPicklistOptions(BARRIER_DRIVER_OBJECT, 'KPH_Status__c'),
    fetchPicklistOptions(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_INDICATION_FIELD),
    fetchPicklistInfo(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_STRATEGY_FIELD),
    fetchPicklistOptions(PLAN_STRATEGY_OBJECT, 'KPH_Strategy_Rank__c'),
    fetchPicklistInfo(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_CATEGORY_FIELDS.barrier),
    fetchPicklistInfo(BARRIER_DRIVER_OBJECT, BARRIER_DRIVER_CATEGORY_FIELDS.driver),
    fetchPicklistOptions(BARRIER_DRIVER_OBJECT, 'KPH_Rank_1__c'),
  ]);

  const barrierCategoryGroup = unrestrictedCategoryPicklistGroup(barrierCategories);
  const driverCategoryGroup = categoryPicklistGroup(driverCategories, indications);
  const categoryGroups = {
    dlbclBarrierCategories: barrierCategoryGroup.options,
    dlbclDriverCategories: driverCategoryGroup.options,
  };
  const barrierCategoryOptionsByIndication = {};
  const driverCategoryOptionsByIndication = driverCategoryGroup.optionsByIndication || {};
  const categoryLabels = {
    ...barrierCategoryGroup.labels,
    ...driverCategoryGroup.labels,
  };
  const strategyOptions = mergeWithDataValues([], strategyPicklist.values);
  const strategyInfo = buildBarrierDriverStrategyPicklistInfo(
    strategyOptions,
    strategyPicklist.labels,
    indications
  );
  const metadataStrategyOptionsByIndication = strategyInfo.hasIndicationFilters
    ? {}
    : await fetchDependencyOptionsFromObjectMetadata({
      objectApi: BARRIER_DRIVER_OBJECT,
      fieldApi: BARRIER_DRIVER_STRATEGY_FIELD,
      controllingFieldApi: BARRIER_DRIVER_INDICATION_FIELD,
      allOptions: strategyOptions,
    }).catch(() => ({}));
  const strategyOptionsByIndication = strategyInfo.hasIndicationFilters
    ? strategyInfo.strategyOptionsByIndication
    : (metadataStrategyOptionsByIndication || {});
  const hasStrategyIndicationFilters =
    strategyInfo.hasIndicationFilters ||
    Object.values(strategyOptionsByIndication || {}).some((options) => Array.isArray(options) && options.length);
  const strategiesForIndication = (indication) =>
    optionsForControllerValue(strategyOptionsByIndication, indication) ||
    (hasStrategyIndicationFilters ? [] : strategyOptions);

  return {
    barrierStatuses: statuses,
    barrierDriverIndications: indications,
    dlbclStrategies: strategiesForIndication('DLBCL'),
    portfolioStrategies: strategiesForIndication('Portfolio'),
    mmStrategies: strategiesForIndication('MM'),
    barrierStrategies: strategyOptions,
    strategyLabels: strategyInfo.strategyLabels,
    strategyOptionsByIndication,
    hasStrategyIndicationFilters,
    strategyRanks,
    ...categoryGroups,
    categoryLabels,
    barrierCategoryOptionsByIndication,
    driverCategoryOptionsByIndication,
    barrierCategories: mergeWithDataValues(
      categoryGroups.dlbclBarrierCategories,
      categoryGroups.dlbclDriverCategories
    ),
    impactLevels,
  };
};

const fetchCriticalActivityPicklists = async () => {
  const [activityStatuses, activityIndications, accountableMembers] = await Promise.all([
    fetchPicklistOptions(CRITICAL_ACTIVITY_OBJECT, 'KPH_Status__c'),
    fetchPicklistOptions(CRITICAL_ACTIVITY_OBJECT, 'KPH_Indication__c'),
    fetchPicklistOptions(CRITICAL_ACTIVITY_OBJECT, 'KPH_Accountable_POD_Members__c'),
  ]);

  return {
    activityStatuses,
    activityIndications,
    accountableMembers,
  };
};


export { normalizeBarrierDriverStatusForDisplay } from '@/lib/dataservice/accountPlan/shared';

export const loadBarriersDrivers = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const [shellContext, { rows: barrierRows, access }, activities, planStrategies, dynamicPicklists, activityPicklists] = await Promise.all([
    resolveShellContextForPlanId(planContextId),
    fetchBarriersAndDrivers(planContextId),
    fetchCriticalActivities(planContextId),
    fetchPlanStrategies(planContextId),
    fetchBarrierDriverPicklists(),
    fetchCriticalActivityPicklists(),
  ]);
  const { planId, plan, account } = shellContext;

  const planStrategyById = planStrategyMapById(planStrategies);
  const strategyLabels = dynamicPicklists.strategyLabels || {};
  const categoryLabels = dynamicPicklists.categoryLabels || {};
  const barriersDrivers = barrierRows
    .map((row) => toBarrierDriver(row, access, planStrategyById, { strategyLabels, categoryLabels }))
    .filter(Boolean)
    .filter((record) => isVisibleBarrierDriverIndication(record.indication));
  const barrierById = createSalesforceIdLookup(barriersDrivers);
  const visibleActivities = activities.filter((activity) =>
    isVisibleBarrierDriverIndication(activity?.indication) &&
    (!activity?.barrierDriverId || getSalesforceIdLookupEntry(barrierById, activity.barrierDriverId))
  );

  // Enrich activities with parentName / parentType so the page doesn't
  // need to re-map per render.
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

  // Picklists come from CRM metadata and are never unioned with values found on
  // existing records, so a value deleted from a picklist in CRM is never offered
  // ("bad value for restricted picklist field").
  // (Barrier/Driver "type" is the record type, not a CRM picklist, so its options
  // are intrinsic app values.)
  const strategyOptions = dynamicPicklists.barrierStrategies || [];
  const dlbclStrategies = dynamicPicklists.dlbclStrategies || strategyOptions;
  const portfolioStrategies = dynamicPicklists.portfolioStrategies || strategyOptions;
  const mmStrategies = dynamicPicklists.mmStrategies || strategyOptions;
  const dlbclBarrierCategories = dynamicPicklists.dlbclBarrierCategories || [];
  const dlbclDriverCategories = dynamicPicklists.dlbclDriverCategories || [];

  const picklists = {
    barrierTypes: ['Barrier', 'Driver'],
    barrierTypeFilters: ['All', 'Barriers', 'Drivers'],
    barrierStatuses: (dynamicPicklists.barrierStatuses || []).map(normalizeBarrierDriverStatusForDisplay),
    barrierDriverIndications: visibleIndications(dynamicPicklists.barrierDriverIndications),
    dlbclStrategies,
    portfolioStrategies,
    mmStrategies,
    barrierStrategies: strategyOptions,
    strategyLabels,
    strategyOptionsByIndication: dynamicPicklists.strategyOptionsByIndication || {},
    hasStrategyIndicationFilters: dynamicPicklists.hasStrategyIndicationFilters === true,
    strategyRanks: dynamicPicklists.strategyRanks || [],
    categoryLabels,
    barrierCategoryOptionsByIndication: dynamicPicklists.barrierCategoryOptionsByIndication || {},
    driverCategoryOptionsByIndication: dynamicPicklists.driverCategoryOptionsByIndication || {},
    dlbclBarrierCategories,
    dlbclDriverCategories,
    // Combine the CRM category lists (dedupe) for the unfiltered category filter.
    barrierCategories: mergeWithDataValues(
      dlbclBarrierCategories,
      dlbclDriverCategories
    ),
    impactLevels: dynamicPicklists.impactLevels || [],
    activityStatuses: activityPicklists.activityStatuses || [],
    activityIndications: visibleIndications(activityPicklists.activityIndications),
    accountableMembers: activityPicklists.accountableMembers || [],
  };

  const openBarriers = barriersDrivers.filter((r) => r.type === 'Barrier' && isOpenBarrierDriverStatus(r.status));
  const openDrivers = barriersDrivers.filter((r) => r.type === 'Driver' && isOpenBarrierDriverStatus(r.status));
  const openActivities = enrichedActivities.filter(isOpenActivity);
  const completedRecent = enrichedActivities.filter(isCompletedRecently);

  return {
    planId,
    plan,
    account,
    barriers: barriersDrivers.filter((r) => r.type === 'Barrier'),
    drivers: barriersDrivers.filter((r) => r.type === 'Driver'),
    activities: enrichedActivities,
    openActivityCountByBarrier,
    picklists,
    barrierDriverAccess: access,
    kpis: {
      openBarriers: openBarriers.length,
      openDrivers: openDrivers.length,
      openActivities: openActivities.length,
      completedRecent: completedRecent.length,
    },
    activitySections: [
      {
        key: 'open',
        title: 'Open and Planned Critical Activities',
        emptyMessage: 'No open or planned critical activities match the current filters.',
        rows: openActivities,
      },
      {
        key: 'completed',
        title: 'Completed Critical Activities in the Last 90 Days',
        emptyMessage: 'No completed critical activities in the last 90 days match the current filters.',
        rows: completedRecent,
      },
    ],
  };
};

export const saveBarrierDriver = updateBarrierDriver;
export const saveBarrierDriverStatus = updateBarrierDriverStatus;
export const addBarrierDriver = createBarrierDriver;
export const saveCriticalActivity = updateCriticalActivity;
export const addCriticalActivity = createCriticalActivity;
export const deleteBarrierDriverWithDependencies = (...args) =>
  sharedApi.deleteBarrierDriverWithDependencies(...args);
export const fetchCriticalActivitiesForBarrierDriver = (...args) =>
  sharedApi.fetchCriticalActivitiesForBarrierDriver(...args);
export { deleteCriticalActivity };
