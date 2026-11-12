import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const tableSortUrl = new URL('../src/lib/helper/tableSort.js', import.meta.url);

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('shared table sorter handles text, numbers, dates, blanks, toggles, and stable ties', async () => {
  assert.equal(existsSync(tableSortUrl), true, 'src/lib/helper/tableSort.js should define shared table sorting');
  const { nextTableSort, stableSortRows, toDateSortValue } = await import(tableSortUrl.href);

  assert.deepEqual(nextTableSort(null, 'name'), { key: 'name', direction: 'asc' });
  assert.deepEqual(nextTableSort({ key: 'name', direction: 'asc' }, 'name'), { key: 'name', direction: 'desc' });
  assert.deepEqual(nextTableSort({ key: 'name', direction: 'desc' }, 'createdDate'), { key: 'createdDate', direction: 'asc' });

  const rows = [
    { id: 'b', name: 'Beta 2', count: 10, createdDate: '2026-05-05' },
    { id: 'a', name: 'alpha 10', count: 2, createdDate: '2026-04-01' },
    { id: 'c', name: 'Alpha 2', count: 2, createdDate: null },
    { id: 'd', name: '', count: null, createdDate: '2026-01-01' },
  ];

  assert.deepEqual(
    stableSortRows(rows, { key: 'name', direction: 'asc' }, (row, key) => row[key]).map((row) => row.id),
    ['c', 'a', 'b', 'd']
  );
  assert.deepEqual(
    stableSortRows(rows, { key: 'name', direction: 'desc' }, (row, key) => row[key]).map((row) => row.id),
    ['b', 'a', 'c', 'd']
  );
  assert.deepEqual(
    stableSortRows(rows, { key: 'count', direction: 'asc' }, (row, key) => row[key]).map((row) => row.id),
    ['a', 'c', 'b', 'd']
  );
  assert.deepEqual(
    stableSortRows(rows, { key: 'createdDate', direction: 'asc' }, (row, key) => toDateSortValue(row[key])).map((row) => row.id),
    ['d', 'a', 'b', 'c']
  );
});

test('major table surfaces expose sortable headers where row order is not workflow-defined', async () => {
  const [
    accountInsights,
    referralDynamics,
    stakeholders,
    teamMembers,
    teamMemberModal,
    homeSummary,
  ] = await Promise.all([
    source('../src/pages/AccountProfile/AccountInsightsTab.jsx'),
    source('../src/pages/AccountProfile/ReferralDynamicsTab.jsx'),
    source('../src/pages/Stakeholders/StakeholdersTab.jsx'),
    source('../src/pages/TeamMembers/index.jsx'),
    source('../src/pages/TeamMembers/TeamMemberEditModal.jsx'),
    source('../src/pages/Overview/BarriersDriversSummary.jsx'),
  ]);
  const teamMemberColumnsBlock = teamMembers.match(/const TEAM_MEMBER_TABLE_COLUMNS = \[([\s\S]*?)\];/)?.[1] || '';

  assert.match(accountInsights, /INSIGHT_TABLE_COLUMNS[\s\S]*?insightText[\s\S]*?indication[\s\S]*?createdDate[\s\S]*?createdBy/);
  assert.match(accountInsights, /stableSortRows/);
  assert.match(accountInsights, /TableSortButton/);

  assert.match(referralDynamics, /REFERRAL_TABLE_COLUMNS[\s\S]*?name[\s\S]*?hcoClassification[\s\S]*?hcpTargetCount[\s\S]*?referralPriority[\s\S]*?indication/);
  assert.match(referralDynamics, /NETWORK_TABLE_COLUMNS[\s\S]*?accountName[\s\S]*?kiteAccountable/);
  assert.match(referralDynamics, /stableSortRows/);
  assert.match(referralDynamics, /TableSortButton/);

  assert.match(stakeholders, /STAKEHOLDER_TABLE_COLUMNS[\s\S]*?name[\s\S]*?role[\s\S]*?dlbclPriority[\s\S]*?dlbclInfluence[\s\S]*?primaryParent/);
  assert.match(stakeholders, /stableSortRows/);
  assert.match(stakeholders, /TableSortButton/);

  assert.match(teamMemberColumnsBlock, /key:\s*'name'[\s\S]*?key:\s*'role'[\s\S]*?key:\s*'participation'/);
  assert.doesNotMatch(teamMemberColumnsBlock, /key:\s*'status'|label:\s*'Status'/);
  assert.match(teamMemberModal, /label:\s*'Status'/);
  assert.match(teamMembers, /stableSortRows/);
  assert.match(teamMembers, /TableSortButton/);

  assert.doesNotMatch(homeSummary, /TableSortButton/);
  assert.doesNotMatch(homeSummary, /stableSortRows/);
  assert.match(homeSummary, /HOME_SUMMARY_COLUMNS[\s\S]*?category[\s\S]*?name[\s\S]*?businessImpact[\s\S]*?indication[\s\S]*?activityCount/);
});

test('sortable table headers keep the same compact header rhythm', async () => {
  const [accountInsights, referralDynamics, tableSortButton, accountProfileCss, mainCss] = await Promise.all([
    source('../src/pages/AccountProfile/AccountInsightsTab.jsx'),
    source('../src/pages/AccountProfile/ReferralDynamicsTab.jsx'),
    source('../src/components/TableSortButton.jsx'),
    source('../src/pages/AccountProfile/AccountProfile.css'),
    source('../src/styles/main.css'),
  ]);

  assert.match(accountInsights, /\{\s*key:\s*'insightText',\s*label:\s*'Insight'\s*\}/);
  assert.match(accountInsights, /\{\s*key:\s*'indication',\s*label:\s*'Indication'\s*\}/);
  assert.match(referralDynamics, /\{\s*key:\s*'hcoClassification',\s*label:\s*'HCO Classification'\s*\}/);
  assert.match(referralDynamics, /\{\s*key:\s*'hcpTargetCount',\s*label:\s*'HCP Targets'\s*\}/);
  assert.match(referralDynamics, /\{\s*key:\s*'referralPriority',\s*label:\s*'Referral Priority'\s*\}/);
  assert.match(referralDynamics, /\{\s*key:\s*'indication',\s*label:\s*'Indication'\s*\}/);
  assert.match(referralDynamics, /\{\s*key:\s*'kiteAccountable',\s*label:\s*'Kite Lead'\s*\}/);
  assert.match(tableSortButton, /column\.ariaLabel\s*\|\|\s*column\.label/);
  assert.match(accountProfileCss, /account-insight-table \.profile-table-head span:first-child[\s\S]*?justify-content:\s*flex-start/);
  assert.match(accountProfileCss, /Full-label table pass/);
  assert.match(accountProfileCss, /referral-dynamics-workbook \.profile-table-head\s*\{[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*40px/);
  assert.match(accountProfileCss, /Full-label table pass[\s\S]*?referral-dynamics-workbook \.profile-table-head span\s*\{[\s\S]*?white-space:\s*normal/);
  assert.match(accountProfileCss, /profile-table-head \.table-sort-copy,[\s\S]*?profile-table-head \.table-sort-copy\s*\{[\s\S]*?flex:\s*0 1 auto/);
  assert.match(accountProfileCss, /Referral Mapping header polish/);
  assert.match(accountProfileCss, /Rebuilt Referral & Dynamics tables/);
  assert.match(
    accountProfileCss,
    /referral-mapping-card \.referral-table \.profile-table-head,[\s\S]*?healthcare-network-card \.network-table \.profile-table-head\s*\{[\s\S]*?min-height:\s*34px !important/
  );
  assert.match(mainCss, /\.table-sort-button\s*\{[\s\S]*?height:\s*100%/);
  assert.match(mainCss, /\.table-sort-label\s*\{[\s\S]*?white-space:\s*nowrap/);
});
