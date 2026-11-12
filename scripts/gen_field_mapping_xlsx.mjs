// One-off generator: builds docs/Account_Plan_Field_Mapping.xlsx with one sheet
// per app page mapping UI field -> backend (Salesforce/Veeva) API field -> object.
// Run: node scripts/gen_field_mapping_xlsx.mjs
import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Each sheet: [UI Field Label, Backend API Field, Salesforce Object API Name]
const SHEETS = {
  Home: [
    // Sidebar / plan context
    ['Sidebar — Plan Name', 'Name', 'Account_Plan_vod__c'],
    ['Sidebar — Last MPD Approval Date', 'KPH_Last_MPD_Review_Date__c', 'Account_Plan_vod__c'],
    ['Sidebar — Territory', 'KPH_Territory_Description__c (fallback KPH_Territory__c)', 'Account_Plan_vod__c'],
    ['Sidebar — Account Name', 'Name', 'Account'],
    ['Sidebar — Account EID', 'EID_GILD__c', 'Account'],
    // Header info cards (AccountStrip)
    ['Header — ATC Cohort', 'KPH_ATC_Cohort__c', 'KPH_Ecosystem_Plan__c'],
    ['Header — ATC Segment', 'KPH_ATC_Share_of_Business_R6M_1Q_Lag__c', 'KPH_Ecosystem_Plan__c'],
    ['Header — LT Focus/ Sprint Account', 'KPH_KLT_Sprint_Account__c', 'KPH_Ecosystem_Plan__c'],
    ['Header — MM ATC Priority', 'KPH_MM_ATC_Priority__c', 'Account'],
    ['Header — Market Access Prioritized Account', '(none — dummy/placeholder)', '—'],
    // Service Line Goals
    ['CART Service Line Customer Goals', 'KPH_ATC_Strategic_Opportunities__c', 'Account_Plan_vod__c'],
    // Kite Strategy (aggregated from open barriers/drivers)
    ['Kite Strategy — DLBCL', 'KPH_Strategy__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Kite Strategy — MM', 'KPH_MM_Strategy__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    // Barriers & Drivers summary
    ['Barriers/Drivers — Title', 'KPH_Barrier_Title__c / KPH_Driver_Title__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — Type', 'RecordTypeId (Barrier/Driver)', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — Indication', 'KPH_Indication__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — Status', 'KPH_Status__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — Business Impact', 'KPH_Rank_1__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — Category', 'KPH_Barrier_Type__c / KPH_Driver_Type__c / KPH_MM_Barrier_Type__c / KPH_MM_Driver_Type__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — Strategy', 'KPH_Strategy__c / KPH_MM_Strategy__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Barriers/Drivers — # Open Critical Activities', '(derived: count of linked open activities)', 'KPH_Additional_Critical_Activities__c'],
    // Urgent / Critical Activities
    ['Critical Activities — Title', 'KPH_Activity_Name__c', 'KPH_Additional_Critical_Activities__c'],
    ['Critical Activities — Status', 'KPH_Status__c', 'KPH_Additional_Critical_Activities__c'],
    ['Critical Activities — Due Date', 'KPH_To_Be_Completed_By__c', 'KPH_Additional_Critical_Activities__c'],
    ['Critical Activities — Accountable', 'KPH_Accountable_POD_Members__c', 'KPH_Additional_Critical_Activities__c'],
    ['Critical Activities — Indication', 'KPH_Indication__c', 'KPH_Additional_Critical_Activities__c'],
    ['Critical Activities — Linked Barrier/Driver', 'Barrier_and_Tactical_Action__c', 'KPH_Additional_Critical_Activities__c'],
    // POD / Team Members
    ['Team Members — Name', 'Team_Member_Name_vod__c', 'Account_Team_Member_vod__c'],
    ['Team Members — Role', 'KPH_Role__c (fallback Role_vod__c)', 'Account_Team_Member_vod__c'],
    ['Team Members — Participation', 'KPH_Participation__c', 'Account_Team_Member_vod__c'],
  ],
  'Account Profile': [
    ['ATC Cohort DLBCL', 'KPH_ATC_Cohort__c', 'KPH_Ecosystem_Plan__c'],
    ['ATC Segment DLBCL', 'KPH_ATC_Share_of_Business_R6M_1Q_Lag__c', 'KPH_Ecosystem_Plan__c'],
    ['MM ATC Priority', 'KPH_MM_ATC_Priority__c', 'Account'],
    ['LT Focus/ Sprint Account', 'KPH_KLT_Sprint_Account__c', 'KPH_Ecosystem_Plan__c'],
    ['aALL Target', 'KPH_aALL_Target__c', 'KPH_Ecosystem_Plan__c'],
    ['Q vs Q CAR-T Volume Trend', 'KPH_Volume_Trend__c', 'KPH_Ecosystem_Plan__c'],
    ['Referral Volume DLBCL', 'KPH_Referral_Count__c (rolled up from referral mapping)', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['2L+ DLBCL Treated patient', 'KPH_X2L_DLBCL_Treated_Patients__c (rolled up)', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Payer Mix', 'KPH_Payer_Mix__c', 'KPH_Ecosystem_Plan__c'],
    ['Payer Type', 'KPH_Payer_Type__c', 'KPH_Ecosystem_Plan__c'],
    ['Top 3 Payers', 'KPH_Top_3_Payers_Name__c', 'KPH_Ecosystem_Plan__c'],
    ['Is capacity having an impact on CART?', 'KPH_Is_capacity_having_an_impact_on_CART__c', 'KPH_Ecosystem_Plan__c'],
    ['What % of CART business is done OP?', 'KPH_What_of_CART_business_is_done_OP__c', 'KPH_Ecosystem_Plan__c'],
    ['Financial / reimbursement constraint?', 'KPH_Financial_and_or_reimbursement__c', 'KPH_Ecosystem_Plan__c'],
    ['Does ATC prefer CART administration in OP?', 'KPH_Does_ATC_prefer_CART_administration__c', 'KPH_Ecosystem_Plan__c'],
    ['If yes, what are the reasons?', 'KPH_If_Yes_to_above_reasons__c', 'KPH_Ecosystem_Plan__c'],
    ['Bispecifics for DLBCL being used?', 'KPH_Bispecifics_for_DLBCL_being_used__c', 'KPH_Ecosystem_Plan__c'],
    ['Does bispecific use in DLBCL impact CART?', 'KPH_Bispecific_use_in_DLBCL_impact_CART__c', 'KPH_Ecosystem_Plan__c'],
    ['If ATC is using OP, do they...?', 'KPH_If_ATC_is_using_OP_do_they__c', 'KPH_Ecosystem_Plan__c'],
    ['Direct competition from Breyanzi?', 'KPH_Is_there_direct_competition_from__c', 'KPH_Ecosystem_Plan__c'],
    ['If yes, in what indication?', 'KPH_If_yes_in_what_indication__c', 'KPH_Ecosystem_Plan__c'],
  ],
  'Referral & Dynamics': [
    ['Referral Mapping — Name Of Site (free text)', 'Name_of_Site__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Referral Mapping — HCO Classification', 'KPH_HCO_Classification__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Referral Mapping — # HCP Targets within a Site', 'KPH_of_HCP_Targets_within_a_Site__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Referral Mapping — Referral Count', 'KPH_Referral_Count__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Referral Mapping — Referral Priority', 'KPH_Referral_Priority__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Referral Mapping — 2L+ DLBCL Treated Patients', 'KPH_X2L_DLBCL_Treated_Patients__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['Referral Mapping — Indication', 'Indication__c', 'KPH_Ecosystem_Map_Dynamics__c'],
    ['DLBCL Regional Dynamics', 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c', 'KPH_Ecosystem_Plan__c'],
    ['MM Regional Dynamics', 'KPH_Region_Dynamics_to_be_Aware_of_MM__c', 'KPH_Ecosystem_Plan__c'],
    ['Healthcare Network — Account Name (lookup)', 'KPH_Account_Name__c', 'KPH_Other_Healthcare_Networks__c'],
    ['Healthcare Network — Kite Accountable', 'KPH_Kite_Accountable__c', 'KPH_Other_Healthcare_Networks__c'],
  ],
  'Barriers & Drivers': [
    ['Title (Barrier/Driver)', 'KPH_Barrier_Title__c / KPH_Driver_Title__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Status', 'KPH_Status__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Type (Barrier vs Driver)', 'RecordTypeId (resolved to Barrier/Driver)', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Indication', 'KPH_Indication__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Category — DLBCL Barrier', 'KPH_Barrier_Type__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Category — DLBCL Driver', 'KPH_Driver_Type__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Category — MM Barrier', 'KPH_MM_Barrier_Type__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Category — MM Driver', 'KPH_MM_Driver_Type__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Business Impact', 'KPH_Rank_1__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Strategy (DLBCL/Portfolio)', 'KPH_Strategy__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Strategy (MM)', 'KPH_MM_Strategy__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Plan Strategy Lookup', 'KPH_Plan_Strategy__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Comments', 'KPH_Comments__c', 'KPH_Barriers_and_Tactical_Actions__c'],
    ['Plan Strategy — Value', 'KPH_Strategy__c', 'KPH_Strategy__c'],
    ['Plan Strategy — Rank', 'KPH_Strategy_Rank__c', 'KPH_Strategy__c'],
  ],
  'Critical Activities': [
    ['Critical Activity Title', 'KPH_Activity_Name__c', 'KPH_Additional_Critical_Activities__c'],
    ['Details', 'KPH_Detail__c', 'KPH_Additional_Critical_Activities__c'],
    ['Status', 'KPH_Status__c', 'KPH_Additional_Critical_Activities__c'],
    ['Indication', 'KPH_Indication__c', 'KPH_Additional_Critical_Activities__c'],
    ['Accountable POD Members', 'KPH_Accountable_POD_Members__c', 'KPH_Additional_Critical_Activities__c'],
    ['Due Date', 'KPH_To_Be_Completed_By__c', 'KPH_Additional_Critical_Activities__c'],
    ['Completion Date', 'KPH_Completion_Date__c', 'KPH_Additional_Critical_Activities__c'],
    ['Comments', 'KPH_Comments__c', 'KPH_Additional_Critical_Activities__c'],
    ['Inactive Flag', 'KPH_Inactive__c', 'KPH_Additional_Critical_Activities__c'],
    ['Deleted Flag', 'KPH_Is_Deleted__c', 'KPH_Additional_Critical_Activities__c'],
    ['Linked Barrier/Driver (parent)', 'Barrier_and_Tactical_Action__c', 'KPH_Additional_Critical_Activities__c'],
    ['Account Plan (parent)', 'KPH_Account_Plans__c', 'KPH_Additional_Critical_Activities__c'],
  ],
  'Cross Functional Plan of Action': [
    ['DLBCL Customer Engagement POA', 'KPH_Customer_Engagement_DLBCL_POA__c', 'Account_Plan_vod__c'],
    ['DLBCL Market Access POA', 'KPH_Market_Access_DLBCL_POA__c', 'Account_Plan_vod__c'],
    ['DLBCL Medical Affairs POA', 'KPH_Medical_Affairs_DLBCL_POA__c', 'Account_Plan_vod__c'],
  ],
  'Account Insights': [
    ['Insight Text', 'KPH_Best_Practices_Key_Learnings_Insight__c', 'KPH_Monthly_Executive_Summary__c'],
    ['Indication', 'Indication__c', 'KPH_Monthly_Executive_Summary__c'],
    ['Insight Date', 'KPH_Created_Date__c (primary) / CreatedDate (fallback)', 'KPH_Monthly_Executive_Summary__c'],
    ['Created By', 'CreatedById / CreatedBy.Name', 'KPH_Monthly_Executive_Summary__c'],
  ],
  Stakeholders: [
    ['Record Name', 'Name', 'KPH_Stakeholder_Map__c'],
    ['Account Plan (parent)', 'KPH_Account_Plan__c', 'KPH_Stakeholder_Map__c'],
    ['Stakeholder Name (account lookup)', 'KPH_Account__c', 'KPH_Stakeholder_Map__c'],
    ['Stakeholder First Name', 'KPH_First_Name__c', 'KPH_Stakeholder_Map__c'],
    ['Stakeholder Last Name', 'KPH_Last_Name__c', 'KPH_Stakeholder_Map__c'],
    ['Role', 'KPH_Title__c', 'KPH_Stakeholder_Map__c'],
    ['Other Role', 'KPH_Other_Title__c', 'KPH_Stakeholder_Map__c'],
    ['Stakeholder Account Class (role fallback)', 'Stakeholder_Account_Class__c', 'KPH_Stakeholder_Map__c'],
    ['Stakeholder EID', 'Stakeholder_EID__c', 'KPH_Stakeholder_Map__c'],
    ['Stakeholder NPI (EID fallback)', 'Stakeholder_NPI__c', 'KPH_Stakeholder_Map__c'],
    ['Name Of Site', 'KPH_Name_Of_Site2__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Current Target', 'KPH_Current_Target__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL HCP Classification', 'KPH_HCP_Classification__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Priority', 'KPH_Priority__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Clinical Influence', 'KPH_DLBCL_Clinical_Influence__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Financial Influence', 'KPH_DLBCL_Financial_Influence__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Operational Influence', 'KPH_DLBCL_Operational_Influence__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Drivers', 'KPH_DLBCL_Drivers__c', 'KPH_Stakeholder_Map__c'],
    ['DLBCL Barriers', 'KPH_DLBCL_Barriers__c', 'KPH_Stakeholder_Map__c'],
    ['MM Current Target', 'KPH_MM_Target__c', 'KPH_Stakeholder_Map__c'],
    ['MM HCP Classification', 'KPH_MM_HCP_Classification__c', 'KPH_Stakeholder_Map__c'],
    ['MM Priority', 'MM_Priority__c', 'KPH_Stakeholder_Map__c'],
    ['MM Clinical Influence', 'KPH_MM_Clinical_Influence__c', 'KPH_Stakeholder_Map__c'],
    ['MM Financial Influence', 'KPH_MM_Financial_Influence__c', 'KPH_Stakeholder_Map__c'],
    ['MM Operational Influence', 'KPH_MM_Operational_Influence__c', 'KPH_Stakeholder_Map__c'],
    ['MM Drivers', 'KPH_MM_Drivers__c', 'KPH_Stakeholder_Map__c'],
    ['MM Barriers', 'KPH_MM_Barriers__c', 'KPH_Stakeholder_Map__c'],
    ['Deleted Flag (soft delete)', 'KPH_Is_Deleted__c', 'KPH_Stakeholder_Map__c'],
  ],
  'Team Members': [
    ['Team Member Name', 'Team_Member_Name_vod__c', 'Account_Team_Member_vod__c'],
    ['Team Member User (lookup)', 'Team_Member_vod__c', 'Account_Team_Member_vod__c'],
    ['Role', 'KPH_Role__c (fallback: Role_vod__c)', 'Account_Team_Member_vod__c'],
    ['Participation', 'KPH_Participation__c', 'Account_Team_Member_vod__c'],
    ['Active Status', 'Account_Team_Member_Active__c', 'Account_Team_Member_vod__c'],
  ],
};

const main = async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kite MyInsights Account Plan';
  wb.created = new Date('2026-06-22T00:00:00Z');

  for (const [sheetName, rows] of Object.entries(SHEETS)) {
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = [
      { header: 'UI Field Name', key: 'label', width: 46 },
      { header: 'Backend API Field', key: 'field', width: 60 },
      { header: 'Salesforce Object', key: 'object', width: 34 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A2F57' },
    };
    ws.getRow(1).alignment = { vertical: 'middle' };
    for (const [label, field, object] of rows) {
      ws.addRow({ label, field, object });
    }
    ws.eachRow((row, n) => {
      row.alignment = { ...row.alignment, wrapText: true, vertical: 'top' };
      if (n > 1 && n % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F7FA' } };
        });
      }
    });
    ws.autoFilter = { from: 'A1', to: 'C1' };
  }

  const outDir = path.join(ROOT, 'docs');
  await mkdir(outDir, { recursive: true });
  const outPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(outDir, 'Account_Plan_Field_Mapping.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Sheets: ${Object.keys(SHEETS).join(', ')}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
