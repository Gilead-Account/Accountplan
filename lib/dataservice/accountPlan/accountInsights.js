// Account Insights page composer.
//
// Free-text insight fields on KPH_Ecosystem_Plan__c — Best Practices,
// Region Dynamics, and the per-strategy plan narrative.

import { resolveShellContext } from '@/lib/dataservice/accountPlan/shared';

export const loadAccountInsights = async () => {
  const { planId, plan, account } = await resolveShellContext();

  // TODO: query KPH_Ecosystem_Plan__c for the insight columns:
  //   KPH_Best_Practices_Key_Learnings_Insight__c,
  //   KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c,
  //   KPH_Region_Dynamics_to_be_Aware_of_MM__c,
  //   KPH_Plan_Strategy_1..4__c, KPH_Prior_Quarter_Key_Accomplishments_1..3__c,
  //   KPH_Lens_of_customer_1..4__c, ...
  return {
    planId,
    plan,
    account,
    insights: null,
  };
};
