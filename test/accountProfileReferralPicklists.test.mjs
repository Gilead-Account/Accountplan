import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const accountProfileModulePath = new URL('../src/lib/dataservice/accountPlan/accountProfile.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadAccountProfileModule = async ({
  labels = {},
  referralAccounts = [],
  accountInsights = [],
  profile = { id: 'profile-001' },
} = {}) => {
  globalThis.__accountProfilePicklistCalls = [];
  globalThis.__accountProfileFetchCalls = [];
  globalThis.__accountProfilePicklistLabels = labels;
  globalThis.__accountProfileReferralAccounts = referralAccounts;
  globalThis.__accountProfileAccountInsights = accountInsights;
  globalThis.__accountProfileRecord = profile;

  const sharedStubUrl = dataModule(`
    export const ACCOUNT_PROFILE_OBJECT = 'KPH_Ecosystem_Plan__c';
    export const ACCOUNT_INSIGHT_OBJECT = 'KPH_Monthly_Executive_Summary__c';
    export const REFERRAL_ACCOUNT_OBJECT = 'KPH_Ecosystem_Map_Dynamics__c';
    export const REGIONAL_DYNAMICS_DLBCL_FIELD = 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c';
    export const REGIONAL_DYNAMICS_MM_FIELD = 'KPH_Region_Dynamics_to_be_Aware_of_MM__c';
    export const MM_PROFILE_FIELD_API_NAMES = {
      factAccredited: 'KPH_FACT_Accredited__c',
      anitoCelTrialSite: 'KPH_Anito_Cel_Trial_Site__c',
      cartProgramStructure: 'KPH_CAR_T_Program_Structure__c',
      ptTimingNextReview: 'KPH_P_T_Timing_Next_Review__c',
    };
    export const createAccountInsight = () => Promise.resolve({});
    export const createHealthcareNetwork = () => Promise.resolve({});
    export const createReferralAccount = () => Promise.resolve({});
    export const deleteAccountInsight = () => Promise.resolve({});
    export const deleteHealthcareNetwork = () => Promise.resolve({});
    export const deleteReferralAccount = () => Promise.resolve({});
    export const fetchAccountProfile = () => Promise.resolve(globalThis.__accountProfileRecord);
    export const fetchAccountProfileChildRecords = (...args) => {
      globalThis.__accountProfileFetchCalls.push({ fn: 'fetchAccountProfileChildRecords', args });
      return Promise.resolve({
        referralAccounts: globalThis.__accountProfileReferralAccounts,
        accountInsights: globalThis.__accountProfileAccountInsights || [],
        healthcareNetworks: [],
      });
    };
    export const summarizeReferralActivityMetrics = (rows) => ({
      referralVolume: String((rows || []).reduce((sum, row) => sum + (Number(row.referralCount) || 0), 0)),
      secondLinePlusVolume: String((rows || []).reduce((sum, row) => sum + (Number(row.treatedPatients) || 0), 0)),
    });
    export const requireCurrentAccountPlanId = () => Promise.resolve('plan-001');
    export const resolveShellContextForPlanId = () => Promise.resolve({
      planId: 'plan-001',
      plan: { id: 'plan-001' },
      account: { id: 'account-001', name: 'Mock Account' },
    });
    export const resolveShellContext = resolveShellContextForPlanId;
    export const searchSiteAccounts = () => Promise.resolve([]);
    export const updateAccountInsight = () => Promise.resolve({});
    export const updateAccountProfileField = () => Promise.resolve({});
    export const updateHealthcareNetwork = () => Promise.resolve({});
    export const updateReferralAccount = () => Promise.resolve({});
  `);
  const queryStubUrl = dataModule(`
    export const deleteRecord = () => Promise.resolve({});
    export const getPicklistValueLabels = (object, field) => {
      globalThis.__accountProfilePicklistCalls.push({ object, field });
      return Promise.resolve(
        (globalThis.__accountProfilePicklistLabels[object] &&
          globalThis.__accountProfilePicklistLabels[object][field]) ||
        {}
      );
    };
  `);

  const source = (await readFile(accountProfileModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/shared['"]/g, `from '${sharedStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`);

  const moduleUrl = `${dataModule(source)}#${Date.now()}-${Math.random()}`;
  const mod = await import(moduleUrl);

  return {
    mod,
    calls: globalThis.__accountProfilePicklistCalls,
    fetchCalls: globalThis.__accountProfileFetchCalls,
  };
};

test('loadAccountProfile fetches referral indication options from CRM picklist metadata', async () => {
  const { mod, calls } = await loadAccountProfileModule({
    labels: {
      KPH_Ecosystem_Map_Dynamics__c: {
        Indication__c: {
          Portfolio: 'Portfolio',
          'DLBCL Only': 'DLBCL Only',
          'MM Only': 'MM Only',
        },
      },
    },
  });

  const data = await mod.loadAccountProfile();

  assert.ok(
    calls.some(
      (call) =>
        call.object === 'KPH_Ecosystem_Map_Dynamics__c' &&
        call.field === 'Indication__c'
    )
  );
  assert.deepEqual(data.referralIndicationOptions, [
    { value: '', label: '-' },
    { value: 'Portfolio', label: 'Portfolio' },
    { value: 'DLBCL Only', label: 'DLBCL Only' },
    { value: 'MM Only', label: 'MM Only' },
  ]);
});

test('loadAccountProfile keeps saved referral indication values when CRM metadata omits them', async () => {
  const { mod } = await loadAccountProfileModule({
    labels: {
      KPH_Ecosystem_Map_Dynamics__c: {
        Indication__c: {
          Portfolio: 'Portfolio',
        },
      },
    },
    referralAccounts: [{ id: 'ref-001', indication: 'Legacy Indication' }],
  });

  const data = await mod.loadAccountProfile();

  assert.deepEqual(data.referralIndicationOptions, [
    { value: '', label: '-' },
    { value: 'Portfolio', label: 'Portfolio' },
    { value: 'Legacy Indication', label: 'Legacy Indication' },
  ]);
});

test('loadAccountProfile fetches account insight indication options from CRM picklist metadata', async () => {
  const { mod, calls } = await loadAccountProfileModule({
    labels: {
      KPH_Monthly_Executive_Summary__c: {
        Indication__c: {
          DLBCL: 'DLBCL',
          MM: 'MM',
        },
      },
    },
    accountInsights: [{ id: 'insight-001', indication: 'Legacy Insight' }],
  });

  const data = await mod.loadAccountProfile();

  assert.ok(
    calls.some(
      (call) =>
        call.object === 'KPH_Monthly_Executive_Summary__c' &&
        call.field === 'Indication__c'
    )
  );
  assert.deepEqual(data.accountInsightIndicationOptions, [
    { value: '', label: '-' },
    { value: 'DLBCL', label: 'DLBCL' },
    { value: 'MM', label: 'MM' },
    { value: 'Legacy Insight', label: 'Legacy Insight' },
  ]);
});

test('loadAccountProfile fetches every MM Profile picklist from CRM metadata only', async () => {
  const { mod, calls } = await loadAccountProfileModule({
    labels: {
      KPH_Ecosystem_Plan__c: {
        KPH_FACT_Accredited__c: {
          Y: 'Yes',
          N: 'No',
        },
        KPH_Anito_Cel_Trial_Site__c: {
          'CRM Trial A': 'CRM Trial A',
          'CRM Trial B': 'Translated Trial B',
        },
        KPH_CAR_T_Program_Structure__c: {
          Dedicated: 'Dedicated',
          Shared: 'Shared with BMT',
        },
        KPH_P_T_Timing_Next_Review__c: {
          'CRM Monthly': 'CRM Monthly',
          'CRM Quarterly': 'CRM Quarterly',
        },
      },
    },
  });

  const data = await mod.loadAccountProfile();

  [
    'KPH_FACT_Accredited__c',
    'KPH_Anito_Cel_Trial_Site__c',
    'KPH_CAR_T_Program_Structure__c',
  ].forEach((field) => {
    assert.ok(calls.some((call) => call.object === 'KPH_Ecosystem_Plan__c' && call.field === field));
  });
  assert.equal(
    calls.some(
      (call) =>
        call.object === 'KPH_Ecosystem_Plan__c' &&
        call.field === 'KPH_P_T_Timing_Next_Review__c'
    ),
    false
  );
  assert.deepEqual(data.mmProfilePicklists, {
    KPH_FACT_Accredited__c: [
      { value: 'Y', label: 'Yes' },
      { value: 'N', label: 'No' },
    ],
    KPH_Anito_Cel_Trial_Site__c: [
      { value: 'CRM Trial A', label: 'CRM Trial A' },
      { value: 'CRM Trial B', label: 'Translated Trial B' },
    ],
    KPH_CAR_T_Program_Structure__c: [
      { value: 'Dedicated', label: 'Dedicated' },
      { value: 'Shared', label: 'Shared with BMT' },
    ],
  });
});

test('loadAccountProfile keeps DLBCL question dropdowns limited to CRM picklist metadata', async () => {
  const { mod, calls } = await loadAccountProfileModule({
    labels: {
      KPH_Ecosystem_Plan__c: {
        KPH_Is_capacity_having_an_impact_on_CART__c: {
          CRM_Yes: 'CRM Yes',
        },
        KPH_What_of_CART_business_is_done_OP__c: {
          '0-25%': '0-25%',
          '26-50%': '26-50%',
        },
      },
    },
    profile: {
      id: 'profile-001',
      dlbclCapacityImpact: 'Legacy Yes',
      dlbclOpBusinessPct: 'Legacy Percent',
    },
  });

  const data = await mod.loadAccountProfile();
  const questions = data.profileQuestionColumns.flat();

  assert.ok(
    calls.some(
      (call) =>
        call.object === 'KPH_Ecosystem_Plan__c' &&
        call.field === 'KPH_Is_capacity_having_an_impact_on_CART__c'
    )
  );
  assert.deepEqual(
    questions.find((row) => row.key === 'capacityImpact')?.options,
    [{ value: 'CRM_Yes', label: 'CRM Yes' }]
  );
  assert.deepEqual(
    questions.find((row) => row.key === 'opBusinessPct')?.options,
    [
      { value: '0-25%', label: '0-25%' },
      { value: '26-50%', label: '26-50%' },
    ]
  );
});

test('loadAccountProfile marks If yes reasons as a DLBCL multi-select picklist', async () => {
  const { mod } = await loadAccountProfileModule({
    labels: {
      KPH_Ecosystem_Plan__c: {
        KPH_If_Yes_to_above_reasons__c: {
          'Patient experience': 'Patient experience',
          'Capacity constraints': 'Capacity constraints',
        },
        KPH_If_yes_in_what_indication__c: {
          DLBCL: 'DLBCL',
          MM: 'MM',
        },
      },
    },
    profile: {
      id: 'profile-001',
      dlbclOpSettingReasons: 'Patient experience;Capacity constraints',
      dlbclBreyanziIndication: 'DLBCL;MM',
    },
  });

  const data = await mod.loadAccountProfile();
  const reasons = data.profileQuestionColumns.flat().find((row) => row.key === 'opSettingReasons');
  const indication = data.profileQuestionColumns.flat().find((row) => row.key === 'breyanziIndication');

  assert.equal(reasons?.label, 'If yes, what are the reasons?');
  assert.equal(reasons?.crmField, 'KPH_If_Yes_to_above_reasons__c');
  assert.equal(reasons?.inputType, 'multipicklist');
  assert.equal(reasons?.isMultiSelect, true);
  assert.equal(reasons?.showWhenParentHasValue, true);
  assert.deepEqual(reasons?.options, [
    { value: 'Patient experience', label: 'Patient experience' },
    { value: 'Capacity constraints', label: 'Capacity constraints' },
  ]);
  assert.equal(indication?.label, 'If yes, in what indication?');
  assert.equal(indication?.crmField, 'KPH_If_yes_in_what_indication__c');
  assert.equal(indication?.inputType, 'multipicklist');
  assert.equal(indication?.isMultiSelect, true);
  assert.equal(indication?.showWhenParentHasValue, false);
  assert.deepEqual(indication?.options, [
    { value: 'DLBCL', label: 'DLBCL' },
    { value: 'MM', label: 'MM' },
  ]);
});

test('loadAccountProfile uses referral mapping count fields for volume cards', async () => {
  const { mod } = await loadAccountProfileModule({
    profile: {
      id: 'profile-001',
      referralVolume: '24',
      secondLinePlusVolume: '8',
      aallTarget: false,
      cartVolumeTrend: 'Field-sourced QoQ trend',
    },
    referralAccounts: [
      { id: 'ref-001', referralCount: 7, treatedPatients: 3 },
      { id: 'ref-002', referralCount: '4', treatedPatients: '2' },
    ],
  });

  const data = await mod.loadAccountProfile();

  assert.deepEqual(
    data.accountAttributeRows.map((row) => row.label),
    [
      'ATC Cohort DLBCL',
      'ATC Segment DLBCL',
      'MM ATC Priority',
      'LT Focus/ Sprint Account',
      'aALL Target',
      'Q vs Q CAR-T Volume Trend',
      'Referral Volume DLBCL',
      '2L+ DLBCL Treated patient',
    ]
  );
  assert.equal(
    data.accountAttributeRows.find((row) => row.key === 'aallTarget')?.value,
    false
  );
  assert.equal(
    data.accountAttributeRows.find((row) => row.key === 'qVsQCartVolumeTrend')?.value,
    'Field-sourced QoQ trend'
  );
  assert.equal(
    data.accountAttributeRows.find((row) => row.key === 'referralVolume')?.value,
    '11'
  );
  assert.equal(
    data.accountAttributeRows.find((row) => row.key === 'secondLinePlusVolume')?.value,
    '5'
  );
});

test('loadAccountProfile filters child account profile sections by Ecosystem Plan id', async () => {
  const { mod, fetchCalls } = await loadAccountProfileModule({
    profile: { id: 'profile-001' },
  });

  await mod.loadAccountProfile();

  assert.deepEqual(
    fetchCalls.find((call) => call.fn === 'fetchAccountProfileChildRecords')?.args,
    ['plan-001', 'profile-001']
  );
});

test('loadAccountProfile saves regional dynamics back to the field that supplied existing data', async () => {
  const { mod } = await loadAccountProfileModule({
    profile: {
      id: 'profile-001',
      regionDynamicsDlbcl: 'Existing DLBCL notes',
      regionDynamicsDlbclField: 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c',
      regionDynamicsMm: '',
      regionDynamicsMmField: 'KPH_Region_Dynamics_to_be_Aware_of_MM__c',
    },
  });

  const data = await mod.loadAccountProfile();

  assert.equal(
    data.regionalDynamicsFieldMap.DLBCL,
    'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c'
  );
  assert.equal(
    data.regionalDynamicsFieldMap.MM,
    'KPH_Region_Dynamics_to_be_Aware_of_MM__c'
  );
});
