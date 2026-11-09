// Implements the same surface as window.ds (Veeva's MyInsights data service)
// so the React app can run on a local vite dev server with no Veeva runtime.
//
// Mirrors site_crm_v1/src/lib/mockData/mockAdapter.js but with fixtures
// shaped for an Account Plan / Overview screen.

import { fixtures, filterByWhere, PLAN_ID } from '@/lib/mockData/fixtures';

const wrap = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = { value };
  }
  return out;
};

const resolveQuery = ({ object, where }) => {
  const rows = fixtures[object];
  if (!rows) {
    console.warn('[mockAdapter] no fixture for object', object);
    return [];
  }
  return filterByWhere(rows, where);
};

const picklistLabels = {
  KPH_Ecosystem_Plan__c: {
    KPH_Is_capacity_having_an_impact_on_CART__c: {
      Yes: 'Yes',
      No: 'No',
    },
    KPH_What_of_CART_business_is_done_OP__c: {
      '0%': '0%',
      '<25%': '<25%',
      '25-50%': '25-50%',
      '50-75%': '50-75%',
      '>75%': '>75%',
      '~60%': '~60%',
    },
    KPH_Financial_and_or_reimbursement__c: {
      Yes: 'Yes',
      No: 'No',
    },
    KPH_Does_ATC_prefer_CART_administration__c: {
      Inpatient: 'Inpatient',
      Outpatient: 'Outpatient',
      'No preference': 'No preference',
    },
    KPH_If_Yes_to_above_reasons__c: {
      'Patient experience': 'Patient experience',
      'Capacity constraints': 'Capacity constraints',
      'Payer / reimbursement': 'Payer / reimbursement',
      'Operational workflow': 'Operational workflow',
      'Improved patient experience, payer pull-through.':
        'Improved patient experience, payer pull-through.',
    },
    KPH_Bispecifics_for_DLBCL_being_used__c: {
      Yes: 'Yes',
      No: 'No',
    },
    KPH_Bispecific_use_in_DLBCL_impact_CART__c: {
      'No impact': 'No impact',
      'Some impact': 'Some impact',
      'Significant impact': 'Significant impact',
      'Some impact in 3L sequencing.': 'Some impact in 3L sequencing.',
    },
    KPH_If_ATC_is_using_OP_do_they__c: {
      'Use OP protocol': 'Use OP protocol',
      'Use inpatient monitoring': 'Use inpatient monitoring',
      'Not applicable': 'Not applicable',
      'Use Z1C6 management protocol; selective on fitness/tumor bulk.':
        'Use Z1C6 management protocol; selective on fitness/tumor bulk.',
    },
    KPH_Is_there_direct_competition_from__c: {
      Yes: 'Yes',
      No: 'No',
    },
    KPH_If_yes_in_what_indication__c: {
      DLBCL: 'DLBCL',
      MM: 'MM',
      aALL: 'aALL',
      Other: 'Other',
    },
  },
  KPH_Barriers_and_Tactical_Actions__c: {
    KPH_Status__c: {
      'Identified - Not Started': 'Identified - Not Started',
      'In Progress': 'In Progress',
      'Near Outcome': 'Near Outcome',
      Closed: 'Closed',
    },
    KPH_Indication__c: {
      DLBCL: 'DLBCL',
      MM: 'MM',
      Portfolio: 'Portfolio',
    },
    KPH_Strategy__c: {
      'Grow Class | Shift Patients Earlier to CAR-T': 'Grow Class | Shift Patients Earlier to CAR-T',
      'Grow Class | Expand Referral Networks': 'Grow Class | Expand Referral Networks',
      'Grow Class | Improve Patient Identification': 'Grow Class | Improve Patient Identification',
      'Win Brand | Establish YESCARTA as Preferred Choice': 'Win Brand | Establish YESCARTA as Preferred Choice',
      'Win Brand | Build Confidence in Safety/ AE': 'Win Brand | Build Confidence in Safety/ AE',
      'Win Brand | Scale Outpatient Treatment Adoption': 'Win Brand | Scale Outpatient Treatment Adoption',
      'Lead/Grow Brand Share': 'Lead/Grow Brand Share',
      'Expand Class Share': 'Expand Class Share',
      'MM Pre-Launch Readiness': 'MM Pre-Launch Readiness',
      'Pre-Activation-Build Account Readiness':'Pre-Activations–Build Account Readiness',
    },
    KPH_Barrier_Type__c: {
      Capacity: 'Capacity',
      Operational: 'Operational',
      Financial: 'Financial',
      Access: 'Access',
      Administration:'Administration',
      Other:'Other'
    },
    KPH_Driver_Type__c: {
      'Clinical | DLBCL,Portfolio': 'Clinical',
      'Operational | DLBCL,Portfolio': 'Operational',
      'Financial | DLBCL,Portfolio': 'Financial',
      'Clinical | MM': 'Clinical',
      'Operational | MM': 'Operational',
      'Access | MM': 'Access',
      'Administration | DLBCL,Portfolio,MM': 'Administration',
      'Other | DLBCL,Portfolio,MM': 'Other',
    },
    KPH_Rank_1__c: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
    },
  },
  KPH_Strategy__c: {
    KPH_Strategy__c: {
      'Grow Class | Shift Patients Earlier to CAR-T': 'Grow Class | Shift Patients Earlier to CAR-T',
      'Grow Class | Expand Referral Networks': 'Grow Class | Expand Referral Networks',
      'Grow Class | Improve Patient Identification': 'Grow Class | Improve Patient Identification',
      'Win Brand | Establish YESCARTA as Preferred Choice': 'Win Brand | Establish YESCARTA as Preferred Choice',
      'Win Brand | Build Confidence in Safety/ AE': 'Win Brand | Build Confidence in Safety/ AE',
      'Win Brand | Scale Outpatient Treatment Adoption': 'Win Brand | Scale Outpatient Treatment Adoption',
      'Lead/Grow Brand Share': 'Lead/Grow Brand Share',
      'Expand Class Share': 'Expand Class Share',
      'MM Pre-Launch Readiness': 'MM Pre-Launch Readiness',
    },
    KPH_Strategy_Rank__c: {
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
    },
  },
  KPH_Additional_Critical_Activities__c: {
    KPH_Status__c: {
      Planned: 'Planned',
      'In Progress': 'In Progress',
      Complete: 'Complete',
    },
    KPH_Indication__c: {
      DLBCL: 'DLBCL',
      MM: 'MM',
    },
  },
  Account_Team_Member_vod__c: {
    Account_Team_Member_Active__c: {
      Active: 'Active',
      Inactive: 'Inactive',
    },
    KPH_Participation__c: {
      Lead: 'Lead',
      Core: 'Core',
      Extended: 'Extended',
    },
  },
  KPH_Stakeholder_Map__c: {
    KPH_Title__c: {
      'Bispecifics Lead': 'Bispecifics Lead',
      'Cell Therapy Director': 'Cell Therapy Director',
      'Lymphoma Lead': 'Lymphoma Lead',
      Other: 'Other',
      'Pharmacy Director': 'Pharmacy Director',
    },
    KPH_DLBCL_Clinical_Influence__c: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
    },
    KPH_DLBCL_Financial_Influence__c: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
    },
    KPH_DLBCL_Operational_Influence__c: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
    },
    KPH_Priority__c: {
      P1: 'P1',
      P2: 'P2',
      P3: 'P3',
    },
    MM_Priority__c: {
      P1: 'P1',
      P2: 'P2',
      P3: 'P3',
    },
  },
  // Create Stakeholder modal (Account person-account fields)
  Account: {
    Salutation: {
      'Dr.': 'Dr.',
      'Mr.': 'Mr.',
      'Mrs.': 'Mrs.',
      'Ms.': 'Ms.',
      'Prof.': 'Prof.',
    },
    Credentials_vod__c: {
      MD: 'MD',
      DO: 'DO',
      PhD: 'PhD',
      PharmD: 'PharmD',
      NP: 'NP',
      PA: 'PA',
      RN: 'RN',
    },
    KPH_Country__c: {
      US: 'US',
      CA: 'CA',
      GB: 'GB',
      DE: 'DE',
      FR: 'FR',
      IN: 'IN',
    },
  },
  KPH_Ecosystem_Map_Dynamics__c: {
    Indication__c: {
      DLBCL: 'DLBCL',
      MM: 'MM',
      Portfolio: 'Portfolio',
    },
  },
  KPH_Monthly_Executive_Summary__c: {
    Indication__c: {
      DLBCL: 'DLBCL',
      MM: 'MM',
      Portfolio: 'Portfolio',
    },
  },
};

const barrierDriverStrategyMetadata = () => {
  return {
    object: 'KPH_Barriers_and_Tactical_Actions__c',
    fields: [
      { name: 'KPH_Indication__c', dataType: 'picklist' },
      { name: 'KPH_Strategy__c', dataType: 'picklist' },
    ],
  };
};

const objectMetadata = {
  KPH_Barriers_and_Tactical_Actions__c: barrierDriverStrategyMetadata,
};

export const mockAdapter = {
  runQuery(params) {
    return Promise.resolve({ data: resolveQuery(params) });
  },

  queryRecord(params) {
    const rows = resolveQuery(params);
    return Promise.resolve({ data: rows[0] || null });
  },

  getDataForCurrentObject(object, field) {
    // The legacy app launches MyInsights from an Account_Plan_vod__c
    // record, so the "current object" Id is the plan Id.
    if (object === 'Account_Plan_vod__c' && field === 'Id') {
      return Promise.resolve({
        Account_Plan_vod__c: { Id: PLAN_ID },
      });
    }
    if (object === 'User' && field === 'Id') {
      return Promise.resolve({
        User: { Id: '0058C00000MockUser2' },
      });
    }
    if (object === 'User' && (field === 'Profile_Name_vod_c' || field === 'Profile_Name_vod__c')) {
      return Promise.resolve({
        User: { [field]: 'KPH-CTAM Manager' },
      });
    }
    if (object === 'User' && field === 'Email') {
      return Promise.resolve({
        User: { Email: 'manager@kitepharma.com' },
      });
    }
    return Promise.resolve({ [object]: { [field]: null } });
  },

  getPicklistValueLabels(object, field) {
    return Promise.resolve({
      [object]: {
        [field]: (picklistLabels[object] && picklistLabels[object][field]) || {},
      },
    });
  },

  viewRecord({ object, fields }) {
    console.info('[mockAdapter] viewRecord ->', object, fields && fields.Id);
    return Promise.resolve({ success: true });
  },

  createRecord({ object, fields }) {
    console.info('[mockAdapter] createRecord ->', object, fields);
    const rows = fixtures[object];
    const id = `mock-new-${Date.now()}`;
    if (rows) {
      rows.unshift(wrap({
        Id: id,
        Name: fields && fields.KPH_Activity_Name__c ? fields.KPH_Activity_Name__c : id,
        LastModifiedDate: new Date().toISOString(),
        ...(fields || {}),
      }));
    }
    return Promise.resolve({ success: true, data: { id, Id: id } });
  },

  updateRecord({ object, id, fields }) {
    console.info('[mockAdapter] updateRecord ->', object, id, fields);
    const rows = fixtures[object];
    if (rows && id) {
      const row = rows.find((candidate) => candidate?.Id?.value === id || candidate?.Id === id);
      if (row) {
        for (const [key, value] of Object.entries(fields || {})) {
          row[key] = { value };
        }
        row.LastModifiedDate = { value: new Date().toISOString() };
      }
    }
    return Promise.resolve({ success: true, data: { id } });
  },

  deleteRecord({ object, id }) {
    console.info('[mockAdapter] deleteRecord ->', object, id);
    const rows = fixtures[object];
    if (rows) {
      const idx = rows.findIndex((row) => row && row.Id && row.Id.value === id);
      if (idx >= 0) rows.splice(idx, 1);
    }
    return Promise.resolve({ success: true, data: { id } });
  },

  getAvailableObjects() {
    return Promise.resolve({ data: Object.keys(fixtures) });
  },

  getObjectMetadata({ object }) {
    const metadata = objectMetadata[object];
    return Promise.resolve({ data: metadata ? metadata() : { object, fields: [] } });
  },
};
