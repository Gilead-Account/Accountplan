// Stakeholders page composer.
// Pulls the plan's stakeholders (KPH_Stakeholder_Map__c). Team members live on
// their own page now and have their own loader.

import {
  createStakeholder,
  deleteStakeholder,
  fetchStakeholders,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  searchSiteAccounts,
  searchStakeholderAccounts,
  updateStakeholder,
} from '@/lib/dataservice/accountPlan/shared';
import { getPicklistValueLabels } from '@/lib/dataservice/query';

const STAKEHOLDER_OBJECT = 'KPH_Stakeholder_Map__c';

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

const mergeOptionGroups = (...groups) =>
  groups.reduce((options, group) => mergeWithDataValues(options, group), []);

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
  getPicklistValueLabels(STAKEHOLDER_OBJECT, fieldApi)
    .then(valuesFromPicklistLabels)
    .catch(() => []);

const fetchStakeholderPicklists = async () => {
  const [
    dlbclClinicalInfluence,
    dlbclFinancialInfluence,
    dlbclOperationalInfluence,
    mmClinicalInfluence,
    mmFinancialInfluence,
    mmOperationalInfluence,
    dlbclPriority,
    roleOptions,
    estimatedAnnualRrmmTreatmentVolumeOptions,
    physicianIdentifiedHighestUnmetNeedsOptions,
  ] = await Promise.all([
    fetchPicklistOptions('KPH_DLBCL_Clinical_Influence__c'),
    fetchPicklistOptions('KPH_DLBCL_Financial_Influence__c'),
    fetchPicklistOptions('KPH_DLBCL_Operational_Influence__c'),
    fetchPicklistOptions('KPH_MM_Clinical_Influence__c'),
    fetchPicklistOptions('KPH_MM_Financial_Influence__c'),
    fetchPicklistOptions('KPH_MM_Operational_Influence__c'),
    fetchPicklistOptions('KPH_Priority__c'),
    fetchPicklistOptions('KPH_Title__c'),
    fetchPicklistOptions('KPH_Estimated_Annual_RRMM_Treatment_Vol__c'),
    fetchPicklistOptions('Physician_Identified_Highest_Unmet_Needs__c'),
  ]);

  return {
    influenceOptions: mergeOptionGroups(
      dlbclClinicalInfluence,
      dlbclFinancialInfluence,
      dlbclOperationalInfluence,
      mmClinicalInfluence,
      mmFinancialInfluence,
      mmOperationalInfluence
    ),
    priorityOptions: dlbclPriority,
    roleOptions,
    estimatedAnnualRrmmTreatmentVolumeOptions,
    physicianIdentifiedHighestUnmetNeedsOptions,
  };
};

export const loadStakeholders = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const [shellContext, stakeholders, dynamicPicklists] = await Promise.all([
    resolveShellContextForPlanId(planContextId),
    fetchStakeholders(planContextId),
    fetchStakeholderPicklists(),
  ]);
  const { planId, plan, account } = shellContext;
  const dataInfluence = stakeholders.flatMap((s) => [
    s.dlbclClinicalInfluence,
    s.dlbclFinancialInfluence,
    s.dlbclOperationalInfluence,
    s.mmClinicalInfluence,
    s.mmFinancialInfluence,
    s.mmOperationalInfluence,
  ]).filter(Boolean);
  const dataPriority = stakeholders.map((s) => s.dlbclPriority).filter(Boolean);
  const dataEstimatedAnnualRrmmTreatmentVolume = stakeholders
    .map((s) => s.estimatedAnnualRrmmTreatmentVolume)
    .filter(Boolean);
  const dataPhysicianIdentifiedHighestUnmetNeeds = stakeholders.flatMap((s) =>
    Array.isArray(s.physicianIdentifiedHighestUnmetNeedsRrmm)
      ? s.physicianIdentifiedHighestUnmetNeedsRrmm
      : []
  );
  const picklists = {
    influenceOptions: mergeWithDataValues(dynamicPicklists.influenceOptions, dataInfluence),
    priorityOptions: mergeWithDataValues(dynamicPicklists.priorityOptions, dataPriority),
    roleOptions: dynamicPicklists.roleOptions || [],
    estimatedAnnualRrmmTreatmentVolumeOptions: mergeWithDataValues(
      dynamicPicklists.estimatedAnnualRrmmTreatmentVolumeOptions,
      dataEstimatedAnnualRrmmTreatmentVolume
    ),
    physicianIdentifiedHighestUnmetNeedsOptions: mergeWithDataValues(
      dynamicPicklists.physicianIdentifiedHighestUnmetNeedsOptions,
      dataPhysicianIdentifiedHighestUnmetNeeds
    ),
  };

  return { planId, plan, account, stakeholders, picklists };
};

export {
  createStakeholder,
  deleteStakeholder,
  searchSiteAccounts,
  searchStakeholderAccounts,
  updateStakeholder,
};
