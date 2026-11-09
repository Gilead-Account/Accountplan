// Stakeholders page composer.
// Pulls the plan's stakeholders (KPH_Stakeholder_Map__c). Team members live on
// their own page now and have their own loader.

import {
  createStakeholder,
  createStakeholderAccount,
  deleteStakeholder,
  fetchAccountRecordTypes,
  fetchParentAddresses,
  fetchStakeholders,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  searchSiteAccounts,
  searchStakeholderAccounts,
  updateStakeholder,
} from '@/lib/dataservice/accountPlan/shared';
import { getPicklistValueLabels, runQuery, unwrap } from '@/lib/dataservice/query';

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

// Fallback: distinct values already present on records.
const fetchDistinctFieldValues = async (objectApi, fieldApi) => {
  try {
    const rows = await runQuery({
      object: objectApi,
      fields: [fieldApi],
      where: `${fieldApi} != null`,
      limit: 2000,
    });
    const values = mergeWithDataValues(
      [],
      (rows || []).map((row) => unwrap(row)?.[fieldApi])
    );
    return values.sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
    );
  } catch (error) {
    console.warn('[picklist] distinct fallback failed', objectApi, fieldApi, error);
    return [];
  }
};

// Picklists on objects other than KPH_Stakeholder_Map__c (Account fields used
// by the Create Stakeholder modal).
const fetchObjectPicklistOptions = async (objectApi, fieldApi) => {
  try {
    const labels = await getPicklistValueLabels(objectApi, fieldApi);
    const values = valuesFromPicklistLabels(labels);
    console.info('[picklist]', `${objectApi}.${fieldApi}`, 'raw:', labels, 'parsed:', values);
    if (values.length) return values;
  } catch (error) {
    console.warn('[picklist] failed', objectApi, fieldApi, error);
  }
  return fetchDistinctFieldValues(objectApi, fieldApi);
};

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
    salutationOptions,
    credentialOptions,
    countryOptions,
    accountRecordTypeOptions,
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
    fetchObjectPicklistOptions('Account', 'Salutation'),
    fetchObjectPicklistOptions('Account', 'Credentials_vod__c'),
    fetchObjectPicklistOptions('Account', 'KPH_Country__c'),
    fetchAccountRecordTypes(),
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
    salutationOptions,
    credentialOptions,
    countryOptions,
    accountRecordTypeOptions,
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
    salutationOptions: dynamicPicklists.salutationOptions || [],
    credentialOptions: dynamicPicklists.credentialOptions || [],
    countryOptions: dynamicPicklists.countryOptions || [],
    accountRecordTypeOptions: dynamicPicklists.accountRecordTypeOptions || [],
  };

  return { planId, plan, account, stakeholders, picklists };
};

export {
  createStakeholder,
  createStakeholderAccount,
  deleteStakeholder,
  fetchAccountRecordTypes,
  fetchParentAddresses,
  searchSiteAccounts,
  searchStakeholderAccounts,
  updateStakeholder,
};
