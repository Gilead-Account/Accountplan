// Critical Activities page composer.
//
// Returns the full activities list (not just the 30-day Home slice), the
// barrier/driver map needed to render "Related Barrier/Driver" names, plus
// pre-computed Open vs. Completed-in-last-90-days sections that mirror the
// legacy `criticalActivityTableSections`.

import {
  BARRIER_DRIVER_OBJECT,
  CRITICAL_ACTIVITY_OBJECT,
  createSalesforceIdLookup,
  fetchBarriersAndDrivers,
  fetchCriticalActivities,
  getSalesforceIdLookupEntry,
  isVisibleBarrierDriverIndication,
  normalizeBarrierDriverStatusForDisplay,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  toBarrierDriver,
  createCriticalActivity,
  deleteCriticalActivity,
  updateCriticalActivity,
  updateBarrierDriverStatus,
} from '@/lib/dataservice/accountPlan/shared';
import { getPicklistValueLabels } from '@/lib/dataservice/query';

const OPEN_STATUSES = new Set(['Open', 'Planned', 'In Progress']);
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
        return entry.value || entry.apiValue || entry.apiName || entry.name || entry.label || null;
      })
    );
  }
  if (typeof labels === 'object') return mergeWithDataValues([], Object.keys(labels));
  return [];
};

const fetchActivityPicklistOptions = (fieldApi) =>
  getPicklistValueLabels(CRITICAL_ACTIVITY_OBJECT, fieldApi)
    .then(valuesFromPicklistLabels)
    .catch(() => []);

const fetchBarrierDriverStatusPicklistOptions = () =>
  getPicklistValueLabels(BARRIER_DRIVER_OBJECT, 'KPH_Status__c')
    .then(valuesFromPicklistLabels)
    .catch(() => []);

const visibleIndications = (values) =>
  (values || []).filter(isVisibleBarrierDriverIndication);

export const fetchCriticalActivityPicklists = async () => {
  const [activityStatuses, activityIndications, accountableMembers, barrierStatuses] = await Promise.all([
    fetchActivityPicklistOptions('KPH_Status__c'),
    fetchActivityPicklistOptions('KPH_Indication__c'),
    fetchActivityPicklistOptions('KPH_Accountable_POD_Members__c'),
    fetchBarrierDriverStatusPicklistOptions(),
  ]);

  return {
    activityStatuses,
    activityIndications,
    accountableMembers,
    barrierStatuses,
  };
};

const isOpen = (activity) =>
  activity && OPEN_STATUSES.has(activity.status);

// "Closed within 90 days" mirrors the controller — completedDate falls within
// the last 90 calendar days. If the activity has no completedDate we fall
// back to its lastModifiedDate so completed-on-iPad-without-the-field still
// shows up.
const isCompletedRecently = (activity) => {
  if (!activity) return false;
  if (activity.status !== 'Complete' && activity.status !== 'Closed') return false;
  const ref = activity.completedDate || activity.lastModifiedDate;
  if (!ref) return false;
  const when = new Date(ref);
  if (Number.isNaN(when.getTime())) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 90);
  return when.getTime() >= cutoff.getTime();
};

export const loadCriticalActivities = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const [shellContext, activities, barrierResult, dynamicPicklists] = await Promise.all([
    resolveShellContextForPlanId(planContextId),
    fetchCriticalActivities(planContextId),
    fetchBarriersAndDrivers(planContextId),
    fetchCriticalActivityPicklists(),
  ]);
  const { planId, plan, account } = shellContext;
  const { rows: barrierRows, access: barrierDriverAccess } = barrierResult;

  const barriersDrivers = barrierRows
    .map((row) => toBarrierDriver(row, barrierDriverAccess))
    .filter(Boolean)
    .filter((record) => isVisibleBarrierDriverIndication(record.indication));
  const barrierById = createSalesforceIdLookup(barriersDrivers);
  const barrierDriverOptions = barriersDrivers.map((bd) => ({
    id: bd.id,
    type: bd.type,
    name: bd.name,
    indication: bd.indication,
    status: bd.status,
    recordTypeId: bd.recordTypeId,
  }));

  // Attach the related barrier/driver name onto each activity so the table
  // doesn't have to re-map per render.
  const visibleActivities = activities.filter((activity) =>
    isVisibleBarrierDriverIndication(activity?.indication) &&
    (!activity?.barrierDriverId || getSalesforceIdLookupEntry(barrierById, activity.barrierDriverId))
  );

  const enriched = visibleActivities.map((a) => {
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

  // Picklists come straight from CRM metadata only — no hardcoded fallback and
  // no union with values found on existing records. Values deleted from a
  // picklist in CRM are therefore never offered (selecting/saving them trips
  // the restricted-picklist "bad value" error).
  const picklists = {
    activityStatuses: dynamicPicklists.activityStatuses || [],
    activityIndications: visibleIndications(dynamicPicklists.activityIndications),
    accountableMembers: dynamicPicklists.accountableMembers || [],
    barrierStatuses: (dynamicPicklists.barrierStatuses || []).map(normalizeBarrierDriverStatusForDisplay),
  };

  return {
    planId,
    plan,
    account,
    activities: enriched,
    barrierDriverOptions,
    picklists,
    sections: [
      {
        key: 'open',
        title: 'Open and Planned Critical Activities',
        emptyMessage: 'No open or planned critical activities match the current filters.',
        rows: enriched.filter(isOpen),
      },
      {
        key: 'completed',
        title: 'Completed Critical Activities in the Last 90 Days',
        emptyMessage: 'No completed critical activities in the last 90 days match the current filters.',
        rows: enriched.filter(isCompletedRecently),
      },
    ],
  };
};

export const saveCriticalActivity = updateCriticalActivity;
export const addCriticalActivity = createCriticalActivity;
export const saveBarrierDriverStatus = updateBarrierDriverStatus;
export { deleteCriticalActivity };
