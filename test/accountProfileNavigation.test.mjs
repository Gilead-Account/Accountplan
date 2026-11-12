import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const accountProfileSource = await readFile(
  new URL('../src/pages/AccountProfile/index.jsx', import.meta.url),
  'utf8'
);
const referralDynamicsSource = await readFile(
  new URL('../src/pages/AccountProfile/ReferralDynamicsTab.jsx', import.meta.url),
  'utf8'
);
const profileTabSource = await readFile(
  new URL('../src/pages/AccountProfile/ProfileTab.jsx', import.meta.url),
  'utf8'
);
const accountProfileCss = await readFile(
  new URL('../src/pages/AccountProfile/AccountProfile.css', import.meta.url),
  'utf8'
);
const accountProfileFieldHelpSource = await readFile(
  new URL('../src/components/AccountProfileFieldHelp.jsx', import.meta.url),
  'utf8'
);
const accountInsightsTabSource = await readFile(
  new URL('../src/pages/AccountProfile/AccountInsightsTab.jsx', import.meta.url),
  'utf8'
);
const accountInsightModalSource = await readFile(
  new URL('../src/pages/AccountProfile/AccountInsightEditModal.jsx', import.meta.url),
  'utf8'
);
const referralAccountModalSource = await readFile(
  new URL('../src/pages/AccountProfile/ReferralAccountEditModal.jsx', import.meta.url),
  'utf8'
);
const healthcareNetworkModalSource = await readFile(
  new URL('../src/pages/AccountProfile/HealthcareNetworkEditModal.jsx', import.meta.url),
  'utf8'
);
const accountProfileDataSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/accountProfile.js', import.meta.url),
  'utf8'
);
const accountPlanSharedSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url),
  'utf8'
);
const accountIntelligenceTabSource = await readFile(
  new URL('../src/pages/AccountProfile/AccountIntelligenceTab.jsx', import.meta.url),
  'utf8'
);
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

const tabsBlock = accountProfileSource.match(/const TABS = \[([\s\S]*?)\];/);
const profileQuestionFocusWithinBlock = accountProfileCss.match(
  /\.profile-question-select-shell:focus-within\s*\{([\s\S]*?)\}/
)?.[1] || '';
const profileQuestionSelectValueBlock = accountProfileCss.match(
  /\.profile-question-select-value\s*\{([\s\S]*?)\}/
)?.[1] || '';
const accountInformationFieldsBlock = accountIntelligenceTabSource.match(
  /const accountInformationFields = \(mmProfilePicklists = \{\}\) => \[([\s\S]*?)\];/
)?.[1] || '';
const accountInformation340bBlock = accountInformationFieldsBlock.match(
  /\{\s*key:\s*'340bAccount'[\s\S]*?\n\s*\},/
)?.[0] || '';

test('Account Profile tab bar exposes only DLBCL Profile and Referral & Dynamics', () => {
  assert.ok(tabsBlock, 'Account Profile TABS constant was not found.');
  assert.match(tabsBlock[1], /key:\s*'profile'/);
  assert.match(tabsBlock[1], /label:\s*'DLBCL Profile'/);
  assert.match(tabsBlock[1], /key:\s*'referral-dynamics'/);
  assert.doesNotMatch(tabsBlock[1], /key:\s*'account-insights'/);
});

test('Account Profile tab bar also exposes the MM Profile tab', () => {
  assert.match(tabsBlock[1], /key:\s*'account-intelligence'[\s\S]*?label:\s*'MM Profile'/);
  assert.match(accountProfileSource, /import AccountIntelligenceTab/);
  assert.match(accountProfileSource, /tab === 'account-intelligence'/);
  assert.match(
    accountProfileSource,
    /<AccountIntelligenceTab[\s\S]*?values=\{data\.mmProfile \|\| \{\}\}[\s\S]*?isReadOnly=\{isReadOnly\}[\s\S]*?\/>/
  );
});

test('Account Profile tab order starts with MM, then DLBCL, then Referral and Dynamics', () => {
  assert.match(
    tabsBlock[1],
    /key:\s*'account-intelligence'[\s\S]*?label:\s*'MM Profile'[\s\S]*?key:\s*'profile'[\s\S]*?label:\s*'DLBCL Profile'[\s\S]*?key:\s*'referral-dynamics'[\s\S]*?label:\s*'Referral & Dynamics'/
  );
  assert.match(accountProfileSource, /initialTab : 'account-intelligence'/);
});

test('Account Profile sidebar page opens on the MM Profile tab by default', () => {
  assert.match(
    appSource,
    /activeKey === 'kpi'[\s\S]*?<AccountProfile[\s\S]*?initialTab="account-intelligence"/
  );
  assert.doesNotMatch(
    appSource,
    /activeKey === 'kpi'[\s\S]*?<AccountProfile[\s\S]*?initialTab="profile"/
  );
});

test('Account Profile empty values render as a dash instead of Not entered', () => {
  assert.doesNotMatch(profileTabSource, /Not entered/);
  assert.doesNotMatch(referralDynamicsSource, /Not entered/);
  assert.doesNotMatch(accountIntelligenceTabSource, /Not entered/);
});

test('MM Profile fields are mapped to KPH_Ecosystem_Plan__c API names', () => {
  assert.match(accountIntelligenceTabSource, /MM_PROFILE_FIELD_API_NAMES/);
  assert.match(accountPlanSharedSource, /export const MM_PROFILE_FIELD_API_NAMES = \{/);
  [
    'KPH_FACT_Accredited__c',
    'KPH_340B_Account__c',
    'KPH_Anito_Cel_Trial_Site__c',
    'KPH_MM_Anito_cel_Clinical_Champion__c',
    'KPH_Admin_Champion_Role__c',
    'KPH_MM_Opinion_Leaders__c',
    'KPH_CAR_T_Treaters_at_ATC__c',
    'KPH_Projected_Anito_cel_Demand__c',
    'KPH_2L_Patient_Estimate__c',
    'KPH_Current_CAR_T_Utilization_Volume__c',
    'KPH_Current_Bispecific_Utilization__c',
    'KPH_Bispecific_Use__c',
    'KPH_Commercial_vs_Trial_CAR_T_Mix__c',
    'KPH_4L_Patient_Estimate__c',
    'KPH_2L_Treatment_Preference__c',
    'KPH_4L_Treatment_Preference__c',
    'KPH_Perception_of_Anito_cel__c',
    'KPH_Pre_Formulary_Exception_Pathway__c',
    'KPH_P_T_Committee__c',
    'KPH_P_T_Lead__c',
    'KPH_P_T_Timing_Next_Review__c',
    'KPH_P_T_Status__c',
    'KPH_Formulary_Status__c',
    'KPH_Access_Barriers__c',
    'KPH_CAR_T_Program_Structure__c',
    'KPH_Outpatient_CAR_T_Capability__c',
    'KPH_Receptivity_to_Anito_cel_OP__c',
    'KPH_Operational_Capacity_Assessment__c',
    'KPH_Catchment_Area_sites_miles__c',
    'KPH_Top_Referring_Sites__c',
    'KPH_Internal_External_Mix__c',
  ].forEach((apiName) => {
    assert.match(accountPlanSharedSource, new RegExp(apiName));
  });
  assert.match(accountPlanSharedSource, /Object\.entries\(MM_PROFILE_FIELD_API_NAMES\)/);
  assert.match(accountPlanSharedSource, /mmProfile,/);
  assert.match(accountProfileDataSource, /mmProfile:\s*profile\?\.mmProfile \|\| \{\}/);
  assert.match(accountIntelligenceTabSource, /key:\s*'projectedAnitoCelDemand'[\s\S]*?crmField:\s*MM_PROFILE_FIELD_API_NAMES\.projectedAnitoCelDemand[\s\S]*?inputType:\s*'number'/);
  assert.match(accountIntelligenceTabSource, /inputMode="numeric"[\s\S]*?pattern="\[0-9\]\*"/);
  assert.doesNotMatch(accountIntelligenceTabSource, /type="number"/);
  assert.match(accountIntelligenceTabSource, /crmField:\s*MM_PROFILE_FIELD_API_NAMES\['340bAccount'\]/);
});

test('MM Profile picklists render CRM metadata options instead of hardcoded values', () => {
  assert.doesNotMatch(accountIntelligenceTabSource, /const TRIAL_SITE_OPTIONS/);
  assert.doesNotMatch(accountIntelligenceTabSource, /const YES_NO_OPTIONS/);
  assert.doesNotMatch(accountIntelligenceTabSource, /const PROGRAM_STRUCTURE_OPTIONS/);
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'factAccredited'[\s\S]*?options:\s*mmProfilePicklists\[MM_PROFILE_FIELD_API_NAMES\.factAccredited\]\s*\|\|\s*\[\]/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'anitoCelTrialSite'[\s\S]*?options:\s*mmProfilePicklists\[MM_PROFILE_FIELD_API_NAMES\.anitoCelTrialSite\]\s*\|\|\s*\[\]/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'cartProgramStructure'[\s\S]*?options:\s*mmProfilePicklists\[MM_PROFILE_FIELD_API_NAMES\.cartProgramStructure\]\s*\|\|\s*\[\]/
  );
});

test('MM Profile 340B Account is read-only from KPH_Ecosystem_Plan__c', () => {
  assert.match(accountPlanSharedSource, /export const ACCOUNT_PROFILE_OBJECT = 'KPH_Ecosystem_Plan__c';/);
  assert.match(accountPlanSharedSource, /'340bAccount': 'KPH_340B_Account__c'/);
  assert.match(
    accountPlanSharedSource,
    /runQuery\(\{[\s\S]*?object:\s*ACCOUNT_PROFILE_OBJECT[\s\S]*?fields:\s*ACCOUNT_PROFILE_FIELDS/
  );
  assert.match(accountInformation340bBlock, /key:\s*'340bAccount'/);
  assert.match(accountInformation340bBlock, /crmField:\s*MM_PROFILE_FIELD_API_NAMES\['340bAccount'\]/);
  assert.doesNotMatch(accountInformation340bBlock, /editable:\s*true/);
  assert.doesNotMatch(accountInformation340bBlock, /inputType:/);
  assert.doesNotMatch(accountInformation340bBlock, /options:/);
});

test('MM Profile tab renders CRM-backed values with local editable controls', () => {
  assert.match(accountIntelligenceTabSource, /values = \{\}/);
  assert.match(accountIntelligenceTabSource, /valueFromProfile/);
  assert.match(
    accountIntelligenceTabSource,
    /useState\(\(\) =>\s*buildInitialEditableValues\(values, sections, accountFields\)\s*\)/
  );
  assert.match(accountIntelligenceTabSource, /function AccountIntelligenceControl/);
  assert.match(accountProfileCss, /\.account-intelligence-control/);
});

test('MM Profile uses one Save button for all changed fields', () => {
  assert.match(accountProfileSource, /const \[mmProfileSaveAction,\s*setMmProfileSaveAction\] = useState\(null\)/);
  assert.match(accountProfileSource, /tab === 'account-intelligence' && mmProfileSaveAction/);
  assert.match(accountProfileSource, /className="account-intelligence-save-button account-profile-tab-save-button"/);
  assert.match(accountProfileSource, /onClick=\{mmProfileSaveAction\.onSave\}/);
  assert.match(accountIntelligenceTabSource, /onSaveActionChange/);
  assert.match(accountIntelligenceTabSource, /onSaveActionChange\(\{/);
  assert.match(accountIntelligenceTabSource, /const dirtyItems = useMemo/);
  assert.match(accountIntelligenceTabSource, /const hasUnsaved = dirtyItems\.length > 0/);
  assert.match(accountIntelligenceTabSource, /hasUnsaved \? `Save \(\$\{dirtyCount\}\)` : 'Save'/);
  assert.match(accountIntelligenceTabSource, /for \(const item of dirtyItems\)/);
  assert.doesNotMatch(accountIntelligenceTabSource, /<div className="mm-profile-head">/);
  assert.doesNotMatch(accountIntelligenceTabSource, /<h3>MM Profile<\/h3>/);
  assert.doesNotMatch(accountIntelligenceTabSource, /function SectionSaveAction/);
  assert.doesNotMatch(accountIntelligenceTabSource, /onSaveSection/);
  assert.doesNotMatch(accountProfileCss, /\.mm-profile-head/);
  assert.match(
    accountProfileCss,
    /\.account-profile-tabs-card\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*0/
  );
  assert.match(
    accountProfileCss,
    /\.account-profile-tabs-card\s*\{[\s\S]*?z-index:\s*30/
  );
});

test('MM Profile read-only editable fields render disabled controls', () => {
  assert.match(accountIntelligenceTabSource, /disabled=\{!isEditable\}/);
  assert.match(accountIntelligenceTabSource, /item\.editable && isReadOnly \? 'is-readonly' : ''/);
  assert.match(accountProfileCss, /\.account-intelligence-control:disabled/);
  assert.match(accountProfileCss, /\.account-intelligence-field\.is-readonly/);
});

test('MM Profile text fields use their requested character limits', () => {
  assert.match(accountIntelligenceTabSource, /const MM_PROFILE_TEXT_MAX_LENGTH = 250/);
  assert.match(accountIntelligenceTabSource, /const MM_PROFILE_SHORT_TEXT_MAX_LENGTH = 255/);
  assert.match(accountIntelligenceTabSource, /const MM_PROFILE_LONG_TEXT_MAX_LENGTH = 500/);
  assert.match(accountIntelligenceTabSource, /const PT_COMMITTEE_TEXT_MAX_LENGTH = 500/);
  const requestedLimits = {
    secondLineTreatmentPreference: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    fourthLineTreatmentPreference: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    perceptionOfAnitoCel: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    outpatientCartCapability: 'MM_PROFILE_SHORT_TEXT_MAX_LENGTH',
    receptivityToAnitoCelOp: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    operationalCapacityAssessment: 'MM_PROFILE_TEXT_MAX_LENGTH',
    ptStatus: 'MM_PROFILE_TEXT_MAX_LENGTH',
    ptTimingNextReview: 'MM_PROFILE_TEXT_MAX_LENGTH',
    formularyStatus: 'MM_PROFILE_TEXT_MAX_LENGTH',
    preFormularyExceptionPathway: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    ptCommittee: 'PT_COMMITTEE_TEXT_MAX_LENGTH',
    ptLead: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    accessBarriers: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    topReferringSites: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    mmAnitoCelClinicalChampion: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    adminChampionRole: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
    mmOpinionLeaders: 'MM_PROFILE_LONG_TEXT_MAX_LENGTH',
  };
  Object.entries(requestedLimits).forEach(([key, limit]) => {
    assert.match(
      accountIntelligenceTabSource,
      new RegExp(`key:\\s*'${key}'[^\\n]*maxLength:\\s*${limit}`),
      `${key} should use ${limit}`
    );
  });
  assert.match(accountIntelligenceTabSource, /maxLength=\{item\.maxLength \|\| MM_PROFILE_TEXT_MAX_LENGTH\}/);
});

test('MM Profile places the 500-character Pre-Formulary Exception Pathway immediately above P&T Committee', () => {
  assert.match(
    accountPlanSharedSource,
    /preFormularyExceptionPathway:\s*'KPH_Pre_Formulary_Exception_Pathway__c'/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'preFormularyExceptionPathway'[^\n]*label:\s*'Pre-Formulary Exception Pathway'[^\n]*crmField:\s*MM_PROFILE_FIELD_API_NAMES\.preFormularyExceptionPathway[^\n]*editable:\s*true[^\n]*inputType:\s*'text'[^\n]*maxLength:\s*MM_PROFILE_LONG_TEXT_MAX_LENGTH[^\n]*layout:\s*'access-full'[^\n]*\n\s*\{\s*key:\s*'ptCommittee'/
  );
});

test('MM Treatment iPad second-row demand metrics distribute evenly', () => {
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'currentBispecificUtilization'[\s\S]*?tabletLayout:\s*'tablet-half'/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'fourthLinePatientEstimate'[\s\S]*?tabletLayout:\s*'tablet-half'/
  );
  assert.match(
    accountProfileCss,
    /@media \(min-width:\s*721px\) and \(max-width:\s*1199px\)[\s\S]*?\.is-mm-treatment \.account-intelligence-field\.is-tablet-half\s*\{[\s\S]*?grid-column:\s*span 6/
  );
  assert.match(
    accountProfileCss,
    /@media \(min-width:\s*721px\) and \(max-width:\s*834px\)[\s\S]*?\.is-mm-treatment \.account-intelligence-field\.is-tablet-half\s*\{[\s\S]*?grid-column:\s*span 6/
  );
});

test('MM Profile access economics fields avoid cramped four-up layout', () => {
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'payerMix'[\s\S]*?layout:\s*'access-payer'[\s\S]*?inlineValue:\s*true[\s\S]*?valuePlacement:\s*'below'/
  );
  assert.match(
    accountProfileCss,
    /\.is-access-economics \.account-intelligence-field\.is-access-payer\s*\{[\s\S]*?grid-column:\s*span 6/
  );
  assert.match(
    accountProfileCss,
    /\.is-access-economics \.account-intelligence-field\.is-access-status\s*\{[\s\S]*?grid-column:\s*span 6/
  );
  assert.match(
    accountProfileCss,
    /\.is-access-economics \.account-intelligence-field\.is-access-payer \.account-intelligence-field-label-row\s*\{[\s\S]*?grid-template-columns:\s*1fr/
  );
  assert.match(
    accountProfileCss,
    /\.is-access-economics \.account-intelligence-field\.is-access-payer strong\s*\{[\s\S]*?justify-self:\s*start/
  );
  assert.match(
    accountProfileCss,
    /\.is-access-economics \.account-intelligence-field\.is-access-status \.account-intelligence-control\.is-textarea\s*\{[\s\S]*?min-height:\s*42px/
  );
});

test('MM Profile referral ecosystem metrics render as stacked KPI cards two per row', () => {
  assert.match(
    accountProfileCss,
    /\.account-intelligence-side-stack \.account-intelligence-section:nth-child\(2\) \.account-intelligence-field-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  // Stacked metrics (Catchment Area, Internal/External Mix) fall through to the
  // global has-stacked-value layout — the side-by-side label-row only applies to
  // inline-value fields that are NOT stacked.
  assert.match(
    accountProfileCss,
    /\.account-intelligence-side-stack \.account-intelligence-section:nth-child\(2\) \.account-intelligence-field\.has-inline-value:not\(\.has-stacked-value\) \.account-intelligence-field-label-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/
  );
  assert.match(
    accountProfileCss,
    /\.account-intelligence-side-stack \.account-intelligence-section:nth-child\(2\) \.account-intelligence-field\.is-mm-full\s*\{[\s\S]*?grid-column:\s*1 \/ -1/
  );
  // Catchment Area, Internal/External Mix and # CART Treaters at ATC match the
  // 2L+ Patient Estimate stacked KPI look (valuePlacement: 'below').
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'catchmentArea'[\s\S]*?valuePlacement:\s*'below'/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'internalExternalMix'[\s\S]*?valuePlacement:\s*'below'/
  );
  assert.match(
    accountProfileCss,
    /\.account-intelligence-field\.has-stacked-value strong\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'cartTreatersAtAtc'[\s\S]*?valuePlacement:\s*'below'/
  );
});

test('requested MM Profile status fields render as free text inputs', () => {
  assert.match(accountProfileSource, /mmProfilePicklists=\{data\.mmProfilePicklists \|\| \{\}\}/);
  assert.match(accountIntelligenceTabSource, /mmProfilePicklists = \{\}/);
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'operationalCapacityAssessment'[\s\S]*?inputType:\s*'text'/
  );
  assert.match(accountIntelligenceTabSource, /key:\s*'ptStatus'[\s\S]*?inputType:\s*'text'/);
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'ptTimingNextReview'[\s\S]*?inputType:\s*'text'/
  );
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'formularyStatus'[\s\S]*?inputType:\s*'text'/
  );
  assert.doesNotMatch(accountIntelligenceTabSource, /options:\s*mmProfilePicklists\.ptTimingNextReview \|\| \[\]/);
  assert.doesNotMatch(accountIntelligenceTabSource, /const STATUS_OPTIONS/);
  assert.doesNotMatch(accountIntelligenceTabSource, /const CAPACITY_OPTIONS/);
  assert.doesNotMatch(accountIntelligenceTabSource, /P_AND_T_TIMING_OPTIONS/);
  assert.doesNotMatch(accountIntelligenceTabSource, /Monthly \/ January|Quarterly \/ March/);
});

test('Outpatient CART Capability renders as capped free text instead of a dropdown', () => {
  assert.match(
    accountIntelligenceTabSource,
    /key:\s*'outpatientCartCapability'[\s\S]*?label:\s*'Outpatient CART Capability'[\s\S]*?inputType:\s*'text'/
  );
  assert.doesNotMatch(accountIntelligenceTabSource, /const OUTPATIENT_CAPABILITY_OPTIONS/);
  assert.doesNotMatch(
    accountIntelligenceTabSource,
    /key:\s*'outpatientCartCapability'[\s\S]*?inputType:\s*'select'/
  );
  assert.match(accountIntelligenceTabSource, /const MM_PROFILE_TEXT_MAX_LENGTH = 250/);
  assert.match(accountIntelligenceTabSource, /maxLength=\{item\.maxLength \|\| MM_PROFILE_TEXT_MAX_LENGTH\}/);
});

test('Account Insights remains available as a separate sidebar page', () => {
  assert.match(appSource, /key:\s*'account-insights'[\s\S]*label:\s*'Account Insights'/);
  assert.match(appSource, /key:\s*'account-insights'[\s\S]*dataKey:\s*'kpi'/);
  assert.match(
    appSource,
    /<AccountProfile[\s\S]*?data=\{activeData\}[\s\S]*?initialTab="account-insights"[\s\S]*?\/>/
  );
  assert.match(accountProfileSource, /tab === 'account-insights'/);
});

test('Referral and Dynamics tab shows MM Regional Dynamics directly below DLBCL', () => {
  assert.match(
    referralDynamicsSource,
    /<RegionalDynamicsPanel[\s\S]*?indication="DLBCL"[\s\S]*?content=\{regionalDynamics\?\.DLBCL\}[\s\S]*?onEdit=\{onEditRegionalDynamics\}[\s\S]*?isReadOnly=\{isReadOnly\}[\s\S]*?\/>\s*<RegionalDynamicsPanel[\s\S]*?indication="MM"[\s\S]*?content=\{regionalDynamics\?\.MM\}[\s\S]*?onEdit=\{onEditRegionalDynamics\}[\s\S]*?isReadOnly=\{isReadOnly\}[\s\S]*?\/>\s*<HealthcareNetworksCard/
  );
});

test('Referral and Dynamics tab exposes only the requested section info icons', () => {
  assert.match(accountProfileFieldHelpSource, /referralMapping:/);
  assert.match(accountProfileFieldHelpSource, /dlbclRegionalDynamics:/);
  assert.match(accountProfileFieldHelpSource, /healthcareNetworks:/);
  assert.match(referralDynamicsSource, /helpKey="referralMapping"/);
  assert.match(referralDynamicsSource, /helpKey="dlbclRegionalDynamics"/);
  assert.match(referralDynamicsSource, /helpKey="healthcareNetworks"/);
  assert.equal([...referralDynamicsSource.matchAll(/AccountProfileFieldHelp helpKey=/g)].length, 3);
  assert.doesNotMatch(accountProfileFieldHelpSource, /hcpTargetCount:|referralPriority:|indication:/);
  assert.doesNotMatch(referralDynamicsSource, /helpKey="hcpTargetCount"|helpKey="referralPriority"|helpKey="indication"/);
});

test('Top 3 Payers always spans two reimbursement rows with vertical payer rows', () => {
  assert.match(profileTabSource, /has-expanded-top-payers/);
  assert.match(profileTabSource, /\.split\(\s*\/\[\\\/\\n\]\+\/\s*\)/);
  assert.doesNotMatch(profileTabSource, /\.split\(\s*\/\[[^\]]*,/);
  assert.match(profileTabSource, /has-no-top-payers/);
  assert.match(profileTabSource, /has-one-top-payer/);
  assert.match(profileTabSource, /has-two-top-payers/);
  assert.match(profileTabSource, /has-three-top-payers/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.08fr\)\s*minmax\(0,\s*0\.92fr\)/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid[\s\S]*?grid-template-rows:\s*repeat\(2,\s*minmax\(64px,\s*auto\)\)/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid \.is-top-payers-ranked[\s\S]*?grid-row:\s*1 \/ span 2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid \.is-payer-type[\s\S]*?grid-column:\s*2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid \.is-payer-mix[\s\S]*?grid-column:\s*2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.is-top-payers-ranked[\s\S]*?grid-column:\s*1/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.is-top-payers-ranked[\s\S]*?grid-row:\s*1 \/ span 2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.is-payer-mix[\s\S]*?grid-column:\s*2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.is-payer-type[\s\S]*?grid-column:\s*2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-two-top-payers \.top-payers-ranked-list[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-three-top-payers \.top-payers-ranked-list[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.top-payers-ranked-row strong[\s\S]*?white-space:\s*normal/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.top-payers-ranked-row strong[\s\S]*?font-size:\s*12px/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-expanded-top-payers[\s\S]*?\.profile-attribute-card:not\(\.is-top-payers-ranked\)[\s\S]*?min-height:\s*64px/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-compact-top-payers[\s\S]*?\.is-top-payers-ranked[\s\S]*?grid-row:\s*1 \/ span 2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid\.has-compact-top-payers[\s\S]*?\.is-payer-mix[\s\S]*?grid-column:\s*2/);
  assert.match(accountProfileCss, /\.reimbursement-card-grid \.is-payer-mix strong[\s\S]*?white-space:\s*normal/);
});

test('Account Profile top cards remove account identity fields and include referral volume fields', () => {
  const attributeBlock = accountProfileDataSource.match(/const ATTRIBUTE_DEFS = \[([\s\S]*?)\];/)?.[1] || '';
  const reimbursementBlock = accountProfileDataSource.match(/const REIMBURSEMENT_DEFS = \[([\s\S]*?)\];/)?.[1] || '';

  assert.doesNotMatch(attributeBlock, /Account Name/);
  assert.doesNotMatch(attributeBlock, /label:\s*'EID'/);
  assert.doesNotMatch(attributeBlock, /Territory/);
  assert.doesNotMatch(attributeBlock, /Plan Status/);
  assert.doesNotMatch(attributeBlock, /Referral Strategy Target/);
  assert.match(attributeBlock, /Referral Volume DLBCL[\s\S]*?source:\s*'profile'[\s\S]*?field:\s*'referralVolume'/);
  assert.match(attributeBlock, /2L\+ DLBCL Treated patient[\s\S]*?source:\s*'profile'[\s\S]*?field:\s*'secondLinePlusVolume'/);
  assert.match(attributeBlock, /aALL Target[\s\S]*?source:\s*'profile'[\s\S]*?field:\s*'aallTarget'/);
  assert.match(attributeBlock, /Q vs Q CAR-T Volume Trend[\s\S]*?source:\s*'profile'[\s\S]*?field:\s*'cartVolumeTrend'/);
  // DLBCL relabels on the ATC fields + the new MM ATC Priority card.
  assert.match(attributeBlock, /ATC Cohort DLBCL[\s\S]*?field:\s*'atcCohort'/);
  assert.match(attributeBlock, /ATC Segment DLBCL[\s\S]*?field:\s*'atcSegment'/);
  assert.match(attributeBlock, /MM ATC Priority/);
  // KAD Target List was removed from the Account Profile attribute grid.
  assert.doesNotMatch(attributeBlock, /KAD Target List|kadTargetList/);
  assert.doesNotMatch(reimbursementBlock, /Referral Strategy Target/);
  assert.doesNotMatch(reimbursementBlock, /Referral Volume|2L\+/);
});

test('Account Profile visible fields expose compact info help icons', () => {
  [
    'aallTarget',
    'qVsQCartVolumeTrend',
    'atcCohort',
    'atcSegment',
    'kltSprint',
    'topPayers',
    'payerType',
    'payerMix',
    'dlbclProfile',
  ].forEach((key) => {
    assert.match(accountProfileFieldHelpSource, new RegExp(`${key}:`));
  });

  // KAD Target List was removed from the Account Profile attribute grid.
  assert.doesNotMatch(accountProfileFieldHelpSource, /kadTarget:/);

  // Referral Volume and 2L+ Volume intentionally carry no help icon.
  assert.doesNotMatch(accountProfileFieldHelpSource, /referralVolume:/);
  assert.doesNotMatch(accountProfileFieldHelpSource, /secondLinePlusVolume:/);

  assert.match(accountProfileDataSource, /helpKey:\s*def\.key/);
  assert.match(profileTabSource, /AccountProfileFieldHelp/);
  assert.match(profileTabSource, /className="profile-attribute-help"/);
  assert.match(profileTabSource, /helpKey="dlbclProfile"/);
  assert.match(accountProfileCss, /\.account-profile-field-help \.field-help-button[\s\S]*?width:\s*15px/);
  assert.match(accountProfileCss, /\.profile-attribute-help \.field-help-button[\s\S]*?width:\s*14px/);
  assert.doesNotMatch(accountProfileFieldHelpSource, /Referral Strategy Target|referralStrategyTarget/);
});

test('Account Profile card fields are mapped from KPH_Ecosystem_Plan__c profile columns', () => {
  const profileMapperBlock = accountPlanSharedSource.match(
    /export const toAccountProfile = \(row\) => \{([\s\S]*?)\n\};/
  )?.[1] || '';

  assert.match(profileMapperBlock, /aallTarget:\s*r\.KPH_aALL_Target__c/);
  assert.match(profileMapperBlock, /cartVolumeTrend:\s*r\.KPH_Volume_Trend__c/);
  assert.match(accountPlanSharedSource, /KPH_Referral_Count__c/);
  assert.match(accountPlanSharedSource, /KPH_X2L_DLBCL_Treated_Patients__c/);
  assert.match(accountProfileDataSource, /summarizeReferralActivityMetrics\(referralAccounts\)/);
  assert.doesNotMatch(accountPlanSharedSource, /REFERRAL_VOLUME_DUMMY/);
  assert.doesNotMatch(accountPlanSharedSource, /SECOND_LINE_PLUS_VOLUME_DUMMY/);
  assert.doesNotMatch(profileMapperBlock, /cartVolumeTrend:\s*firstFilled/);
});

test('Account Insights add button says Add Insight', () => {
  assert.match(accountInsightsTabSource, />\s*Add Insight\s*</);
  assert.doesNotMatch(accountInsightsTabSource, />\s*Add\s*</);
});

test('Account Insights create path passes Account Profile id for Monthly Executive Summary link', () => {
  assert.match(accountProfileSource, /const profileId = data\.profileId/);
  assert.match(accountProfileSource, /addAccountInsight\(planId,\s*profileId,\s*form\)/);
  assert.match(accountPlanSharedSource, /KPH_Account_Profile__c/);
});

test('Account Insights exposes Indication in the table and popup', () => {
  assert.match(accountInsightsTabSource, /\{\s*key:\s*'indication',\s*label:\s*'Indication'\s*\}/);
  assert.match(accountInsightModalSource, /Field label="Indication"/);
  assert.match(accountInsightModalSource, /name="accountInsightIndication"/);
  assert.match(accountProfileSource, /indicationOptions=\{data\.accountInsightIndicationOptions \|\| \[\]\}/);
});

test('Healthcare Network create path passes Account Profile id for Other Healthcare Networks link', () => {
  assert.match(accountProfileSource, /const profileId = data\.profileId/);
  assert.match(accountProfileSource, /addHealthcareNetwork\(profileId,\s*form\)/);
});

test('Healthcare Network add modal starts with a blank Account Name lookup', () => {
  const initialFormBlock = healthcareNetworkModalSource.match(
    /const buildInitialForm = \(record, defaultAccount\) => \(\{([\s\S]*?)\}\);/
  )?.[1] || '';

  assert.match(initialFormBlock, /accountId:\s*record\?\.accountId\s*\|\|\s*''/);
  assert.match(initialFormBlock, /accountName:\s*record\?\.accountName\s*\|\|\s*''/);
  assert.doesNotMatch(initialFormBlock, /defaultAccount\?\.(id|name)/);
});

test('Referral Mapping create path passes Account Profile id for Ecosystem Map Dynamics link', () => {
  assert.match(accountProfileSource, /const profileId = data\.profileId/);
  assert.match(accountProfileSource, /addReferralAccount\(planId,\s*profileId,\s*form\)/);
});

test('Referral Mapping saves the supported free-text site name without requiring the retired lookup id', () => {
  assert.match(referralAccountModalSource, /if \(!String\(form\.name \|\| ''\)\.trim\(\)\)/);
  assert.doesNotMatch(referralAccountModalSource, /SF_ID_PATTERN\.test\(String\(form\.siteId/);
});

test('DLBCL profile answer picklists use native select controls', () => {
  assert.match(profileTabSource, /<select[\s\S]*?profile-question-select-input/);
  assert.doesNotMatch(profileTabSource, /profile-question-select-menu/);
  assert.doesNotMatch(profileTabSource, /role="listbox"/);
  assert.doesNotMatch(accountProfileCss, /profile-question-select-option/);
});

test('DLBCL profile If yes follow-ups use editable checkbox multi-selects', () => {
  assert.match(accountPlanSharedSource, /KPH_If_Yes_to_above_reasons__c/);
  assert.match(
    accountProfileDataSource,
    /key:\s*'opSettingReasons'[\s\S]*?type:\s*'multipicklist'[\s\S]*?crmField:\s*'KPH_If_Yes_to_above_reasons__c'/
  );
  assert.match(
    accountProfileDataSource,
    /key:\s*'breyanziIndication'[\s\S]*?type:\s*'multipicklist'[\s\S]*?crmField:\s*'KPH_If_yes_in_what_indication__c'/
  );
  assert.match(profileTabSource, /profile-question-multi-menu/);
  assert.match(profileTabSource, /type="checkbox"/);
  assert.match(profileTabSource, /toggleMultiSelectValue/);
  assert.match(profileTabSource, /join\(MULTI_PICKLIST_SEPARATOR\)/);
  assert.match(accountProfileCss, /\.profile-question-multi-menu/);
  assert.match(accountProfileCss, /\.profile-question-multi-menu[\s\S]*?bottom:\s*calc\(100% \+ 4px\)/);
  assert.doesNotMatch(accountProfileCss, /\.profile-question-multi-menu[\s\S]*?top:\s*calc\(100% \+ 4px\)/);
});

test('DLBCL profile closed dropdown value wraps while native select handles options', () => {
  assert.match(profileTabSource, /profile-question-select-shell/);
  assert.match(profileTabSource, /profile-question-select-value/);
  assert.match(profileTabSource, /aria-hidden="true"/);
  assert.match(accountProfileCss, /\.profile-question-select-value[\s\S]*?white-space:\s*normal/);
  assert.match(accountProfileCss, /\.profile-question-select-value[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(profileQuestionSelectValueBlock, /border:\s*0/);
  assert.match(accountProfileCss, /\.profile-question-select-input[\s\S]*?opacity:\s*0/);
  assert.match(accountProfileCss, /\.profile-question-select-input[\s\S]*?-webkit-appearance:\s*none/);
  assert.match(accountProfileCss, /\.profile-question-select-input[\s\S]*?appearance:\s*none/);
  assert.match(accountProfileCss, /\.profile-question-select-input:focus,[\s\S]*?\.profile-question-select-input:focus-visible[\s\S]*?outline:\s*0/);
  assert.match(profileQuestionFocusWithinBlock, /border-color:\s*var\(--line\)/);
  assert.doesNotMatch(profileQuestionFocusWithinBlock, /box-shadow:\s*0 0 0 2px/);
});

test('DLBCL profile select shell masks native iPad dropdown chrome', () => {
  assert.match(accountProfileCss, /\.profile-question-select-shell[\s\S]*?overflow:\s*hidden/);
  assert.match(accountProfileCss, /\.profile-question-select-shell[\s\S]*?isolation:\s*isolate/);
  assert.match(accountProfileCss, /\.profile-question-select-shell::before[\s\S]*?pointer-events:\s*none/);
  assert.match(accountProfileCss, /\.profile-question-select-shell::before[\s\S]*?z-index:\s*2/);
  assert.match(accountProfileCss, /\.profile-question-select-value[\s\S]*?pointer-events:\s*none/);
  assert.match(accountProfileCss, /\.profile-question-select-input[\s\S]*?z-index:\s*1/);
  assert.match(accountProfileCss, /\.profile-question-select-input[\s\S]*?background-image:\s*none\s*!important/);
  assert.match(accountProfileCss, /\.profile-question-select-input[\s\S]*?-webkit-text-fill-color:\s*transparent/);
});

test('DLBCL profile desktop native dropdown option text stays readable', () => {
  assert.match(
    accountProfileCss,
    /@media \(min-width:\s*1200px\)[\s\S]*?\.profile-question-select-input option\s*\{[\s\S]*?color:\s*var\(--ink\)/
  );
  assert.match(
    accountProfileCss,
    /@media \(min-width:\s*1200px\)[\s\S]*?\.profile-question-select-input option\s*\{[\s\S]*?-webkit-text-fill-color:\s*var\(--ink\)/
  );
  assert.match(
    accountProfileCss,
    /@media \(min-width:\s*1200px\)[\s\S]*?\.profile-question-select-input option\s*\{[\s\S]*?background:\s*#fff/
  );
});

test('DLBCL profile tablet table reserves readable question and answer columns', () => {
  assert.match(accountProfileCss, /Balanced iPad DLBCL question layout/);
  assert.match(accountProfileCss, /\.profile-question-table \.profile-question-head,[\s\S]*?\.profile-question-table \.profile-question-row[\s\S]*?grid-template-columns:\s*minmax\(132px,\s*0\.9fr\)\s*minmax\(0,\s*1\.45fr\)/);
  assert.doesNotMatch(accountProfileCss, /grid-template-columns:\s*minmax\(0,\s*0\.55fr\)\s*minmax\(0,\s*1\.7fr\)/);
});

test('DLBCL profile answer column does not draw a divider through native select values', () => {
  const groupedAnswerCellBlock = accountProfileCss.match(
    /\.profile-question-table \.profile-question-row > span,\s*[\s\S]*?\.profile-question-answer\s*\{([\s\S]*?)\}/
  )?.[1] || '';
  const answerCellBlock = accountProfileCss.match(
    /\.profile-question-answer\s*\{([\s\S]*?)\}/
  )?.[1] || '';

  assert.doesNotMatch(groupedAnswerCellBlock, /border-bottom:\s*1px solid #e0eef4/);
  assert.doesNotMatch(answerCellBlock, /border-bottom:\s*1px solid #e0eef4/);
  assert.match(answerCellBlock, /border-bottom:\s*0/);
});
