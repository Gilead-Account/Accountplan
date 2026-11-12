import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const accountStripSource = await readFile(
  new URL('../src/pages/Overview/AccountStrip.jsx', import.meta.url),
  'utf8'
);
const accountPlanSharedSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url),
  'utf8'
);
const homeDataSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/home.js', import.meta.url),
  'utf8'
);
const homeFieldHelpSource = await readFile(
  new URL('../src/components/HomeFieldHelp.jsx', import.meta.url),
  'utf8'
);
const overviewCss = await readFile(
  new URL('../src/pages/Overview/Overview.css', import.meta.url),
  'utf8'
);
const sidebarSource = await readFile(
  new URL('../src/components/Sidebar.jsx', import.meta.url),
  'utf8'
);
const serviceLineGoalsSource = await readFile(
  new URL('../src/pages/Overview/ServiceLineGoals.jsx', import.meta.url),
  'utf8'
);
const kiteStrategySource = await readFile(
  new URL('../src/pages/Overview/KiteStrategy.jsx', import.meta.url),
  'utf8'
);
const barriersDriversSource = await readFile(
  new URL('../src/pages/Overview/BarriersDriversSummary.jsx', import.meta.url),
  'utf8'
);
const urgentActivitiesSource = await readFile(
  new URL('../src/pages/Overview/UrgentActivities.jsx', import.meta.url),
  'utf8'
);
const podUsersSource = await readFile(
  new URL('../src/pages/Overview/PodUsers.jsx', import.meta.url),
  'utf8'
);

test('Home header shows MM ATC Priority and Market Access cards instead of volume fields', () => {
  assert.match(accountStripSource, /label:\s*'ATC Cohort DLBCL'/);
  assert.match(accountStripSource, /label:\s*'ATC Segment DLBCL'/);
  assert.match(accountStripSource, /label:\s*'LT Focus\/ Sprint Account'/);
  assert.match(accountStripSource, /label:\s*'MM ATC Priority'/);
  assert.match(accountStripSource, /label:\s*'Market Access Prioritized Account'/);
  assert.doesNotMatch(accountStripSource, /label:\s*'KAD Target'/);
  // Referral Volume and 2L+ Volume were removed from the home header.
  assert.doesNotMatch(accountStripSource, /Referral Volume|2L\+ Volume/);
  assert.doesNotMatch(accountStripSource, /Referral Target|referralStrategyTarget/);
});

test('Home header distributes the five info cards evenly across the strip', () => {
  assert.equal((accountStripSource.match(/label:\s*'/g) || []).length, 5);
  assert.match(overviewCss, /\.mock-home-page \.mock-info-grid[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
});

test('Home header volume values roll up referral mapping CRM count fields', () => {
  assert.match(accountPlanSharedSource, /KPH_Referral_Count__c/);
  assert.match(accountPlanSharedSource, /KPH_X2L_DLBCL_Treated_Patients__c/);
  assert.match(accountPlanSharedSource, /summarizeReferralActivityMetrics/);
  assert.match(homeDataSource, /fetchReferralAccounts\(planId,\s*headerResult\.ecosystemPlanId\)/);
  assert.match(homeDataSource, /summarizeReferralActivityMetrics\(referralAccounts\)/);
  assert.doesNotMatch(accountPlanSharedSource, /REFERRAL_VOLUME_DUMMY/);
  assert.doesNotMatch(accountPlanSharedSource, /SECOND_LINE_PLUS_VOLUME_DUMMY/);
  assert.doesNotMatch(accountPlanSharedSource, /KPH_Referral_Strategy_Target__c/);
});

test('Home data loader fans out independent shell, page, referral, and POD reads', () => {
  assert.match(accountPlanSharedSource, /export const resolveShellContextForPlanId = async \(planId,/);
  assert.match(homeDataSource, /const shellContextPromise = resolveShellContextForPlanId\(planId\)/);
  assert.match(homeDataSource, /const \[shellContext,\s*headerResult,\s*barrierResult,\s*activities,\s*teamMembers,\s*planStrategies,\s*dynamicPicklists\] = await Promise\.all\(\[/);
  assert.match(homeDataSource, /const \[referralAccounts,\s*podUsers\] = await Promise\.all\(\[/);
});

test('Home page info icons cover the expected visible fields', () => {
  [
    'lastMpdApprovalDate',
    'atcCohort',
    'atcSegment',
    'kltSprintAccount',
    'customerGoals',
    'barriers',
    'drivers',
    'kiteStrategy',
    'criticalActivities',
    'teamMembers',
  ].forEach((key) => {
    assert.match(homeFieldHelpSource, new RegExp(`${key}:`));
  });

  assert.match(sidebarSource, /helpKey="lastMpdApprovalDate"/);
  assert.match(sidebarSource, />Last MPD Review Date</);
  assert.match(sidebarSource, /label="Last MPD Review Date"/);
  assert.doesNotMatch(sidebarSource, />LAST MPD</);
  assert.match(serviceLineGoalsSource, /helpKey="customerGoals"/);
  assert.match(kiteStrategySource, /helpKey="kiteStrategy"/);
  assert.match(barriersDriversSource, /helpKey=\{table\.type === 'Driver' \? 'drivers' : 'barriers'\}/);
  assert.match(urgentActivitiesSource, /helpKey="criticalActivities"/);
  assert.match(podUsersSource, /helpKey="teamMembers"/);
  assert.doesNotMatch(accountStripSource, /helpKey:\s*'kadTargetList'/);
  assert.doesNotMatch(homeFieldHelpSource, /kadTargetList:/);
  assert.doesNotMatch(homeFieldHelpSource, /Referral Target|referralStrategyTarget/);
  // Referral Volume and 2L+ Volume no longer expose a help icon.
  assert.doesNotMatch(homeFieldHelpSource, /referralVolume:/);
  assert.doesNotMatch(homeFieldHelpSource, /secondLinePlusVolume:/);
});

test('Home page info icons use compact field-help sizing', () => {
  assert.match(overviewCss, /\.home-field-help \.field-help-button[\s\S]*?width:\s*15px/);
  assert.match(overviewCss, /\.home-info-card-help \.field-help-button[\s\S]*?width:\s*14px/);
  assert.match(overviewCss, /\.mock-info-card \.field-help-button span[\s\S]*?color:\s*inherit\s*!important/);
});
