import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const accountInsightsSource = await readFile(
  new URL('../src/pages/AccountProfile/AccountInsightsTab.jsx', import.meta.url),
  'utf8'
);
const accountProfileCss = await readFile(
  new URL('../src/pages/AccountProfile/AccountProfile.css', import.meta.url),
  'utf8'
);
const stakeholdersSource = await readFile(
  new URL('../src/pages/Stakeholders/StakeholdersTab.jsx', import.meta.url),
  'utf8'
);
const stakeholdersCss = await readFile(
  new URL('../src/pages/Stakeholders/Stakeholders.css', import.meta.url),
  'utf8'
);
const teamMembersCss = await readFile(
  new URL('../src/pages/TeamMembers/TeamMembers.css', import.meta.url),
  'utf8'
);

test('Account Insights uses icon-only edit action without text-button spacing', () => {
  assert.match(accountInsightsSource, /function EditPencilIcon/);
  assert.match(accountInsightsSource, /className="stakeholder-edit-button account-insight-edit-button"/);
  assert.match(accountInsightsSource, /className="profile-action-head"\s+aria-hidden="true"/);
  assert.match(accountInsightsSource, /<EditPencilIcon \/>/);
  assert.doesNotMatch(accountInsightsSource, /className="mock-icon-button text-button"/);
  assert.doesNotMatch(accountInsightsSource, />\s*Edit\s*</);
  assert.match(accountProfileCss, /\.account-insight-edit-button[\s\S]*?width:\s*26px/);
});

test('Stakeholder tablet rows reserve readable space for role and primary parent and pin edit right', () => {
  assert.match(stakeholdersCss, /Balanced iPad row allocation/);
  assert.match(stakeholdersCss, /grid-template-columns:\s*minmax\(156px,\s*1\.18fr\)\s*minmax\(132px,\s*1\.02fr\)\s*84px\s*96px\s*minmax\(198px,\s*1\.48fr\)\s*40px/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.stakeholder-table-row > span:nth-child\(2\)[\s\S]*?white-space:\s*normal/);
  assert.match(stakeholdersSource, /className="stakeholder-parent-value"/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.stakeholder-parent-cell\s*\{[\s\S]*?display:\s*flex !important;[\s\S]*?align-items:\s*center !important/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.stakeholder-parent-value\s*\{[\s\S]*?display:\s*-webkit-box;[\s\S]*?-webkit-line-clamp:\s*3/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.stakeholder-row-actions[\s\S]*?justify-content:\s*flex-end/);
});

test('Stakeholder desktop table fills the table card like Team Members', () => {
  assert.match(stakeholdersCss, /Desktop stakeholder table width guard/);
  assert.match(
    stakeholdersCss,
    /@media\s*\(min-width:\s*1200px\)\s*\{[\s\S]*?\.page-stakeholders-team \.stakeholder-table-head,[\s\S]*?\.page-stakeholders-team \.stakeholder-table-item\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?max-width:\s*none !important/
  );
});

test('Stakeholder filters use the Barriers and Drivers iPad filter structure', () => {
  assert.match(stakeholdersSource, /className="mock-filter-row bd-filter-strip stakeholder-filter-row"/);
  assert.match(stakeholdersSource, /className="bd-filter-select-box stakeholder-filter-select-box"/);
  assert.match(stakeholdersSource, /NON_TARGET_PRIORITY_OPTION/);
  assert.match(stakeholdersCss, /Stakeholder iPad filter guard/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.mock-filter-row\.bd-filter-strip\.stakeholder-filter-row[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.stakeholder-filter-select-box[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(150px,\s*1fr\)\)/);
  assert.match(stakeholdersCss, /\.page-stakeholders-team \.stakeholder-filter-select-box \.select-shell select[\s\S]*?height:\s*42px/);
});

test('Referral Dynamics tables keep every column visible and left-align row values', () => {
  assert.match(accountProfileCss, /Rebuilt Referral & Dynamics tables/);
  assert.match(accountProfileCss, /Final Account Profile table consistency pass/);
  assert.match(
    accountProfileCss,
    /referral-mapping-card \.referral-table \.profile-table-head,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.03fr\)\s*minmax\(0,\s*0\.9fr\)\s*minmax\(0,\s*0\.6fr\)\s*minmax\(0,\s*0\.74fr\)\s*minmax\(0,\s*0\.78fr\)\s*56px !important/
  );
  assert.match(
    accountProfileCss,
    /healthcare-network-card \.network-table \.profile-table-head,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*0\.92fr\)\s*minmax\(0,\s*0\.84fr\)\s*56px !important/
  );
  assert.match(
    accountProfileCss,
    /referral-mapping-card \.referral-table \.profile-table-head > span,[\s\S]*?healthcare-network-card \.network-table \.profile-table-head > span\s*\{[\s\S]*?align-items:\s*center !important;[\s\S]*?justify-content:\s*flex-start !important;[\s\S]*?border-right:\s*0 !important/
  );
  assert.match(accountProfileCss, /referral-table \.profile-table-head,[\s\S]*?network-table \.profile-table-head\s*\{[\s\S]*?min-height:\s*34px !important/);
  assert.match(accountProfileCss, /profile-table-head \.table-sort-button,[\s\S]*?display:\s*inline-flex/);
  assert.match(accountProfileCss, /referral-table \.profile-table-head \.table-sort-button,[\s\S]*?network-table \.profile-table-head \.table-sort-button\s*\{[\s\S]*?height:\s*auto !important;[\s\S]*?min-height:\s*0 !important/);
  assert.match(accountProfileCss, /referral-table \.profile-table-head \.table-sort-copy,[\s\S]*?network-table \.profile-table-head \.table-sort-button small\s*\{[\s\S]*?min-height:\s*0 !important;[\s\S]*?padding:\s*0 !important/);
  assert.match(accountProfileCss, /referral-table \.profile-table-row,[\s\S]*?network-table \.profile-table-row\s*\{[\s\S]*?box-sizing:\s*border-box !important/);
  assert.match(accountProfileCss, /profile-action-head::before,[\s\S]*?network-table \.profile-table-head \.profile-action-head::before,[\s\S]*?content:\s*none !important;[\s\S]*?display:\s*none !important/);
  assert.match(accountProfileCss, /referral-table \.profile-action-cell,[\s\S]*?network-table \.profile-action-cell\s*\{[\s\S]*?padding-right:\s*8px !important;[\s\S]*?padding-left:\s*8px !important/);
  assert.match(accountProfileCss, /referral-table \.profile-table-head > span:first-child,[\s\S]*?referral-table \.profile-table-head > span:nth-child\(5\)\s*\{[\s\S]*?justify-content:\s*flex-start !important;[\s\S]*?text-align:\s*left/);
  assert.match(accountProfileCss, /referral-table \.profile-table-head > span:first-child \.table-sort-button,[\s\S]*?referral-table \.profile-table-head > span:nth-child\(5\) \.table-sort-button\s*\{[\s\S]*?justify-content:\s*flex-start/);
  assert.match(accountProfileCss, /referral-table \.activity-sort-arrow,[\s\S]*?network-table \.activity-sort-arrow\s*\{[\s\S]*?transform:\s*translateY\(1px\)/);
  assert.match(accountProfileCss, /profile-table-row > span,[\s\S]*?font-size:\s*11px !important/);
  assert.match(accountProfileCss, /profile-table-row strong,[\s\S]*?font-size:\s*11\.3px !important/);
  assert.match(accountProfileCss, /profile-table-row > span,[\s\S]*?align-items:\s*flex-start !important;[\s\S]*?justify-content:\s*center !important/);
});

test('Healthcare Networks side card stays compact on iPad', () => {
  assert.match(accountProfileCss, /referral-dynamics-side\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto/);
  assert.match(accountProfileCss, /referral-dynamics-side\s*\{[\s\S]*?align-content:\s*start/);
  assert.match(accountProfileCss, /healthcare-network-card\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?align-content:\s*start/);
  assert.match(accountProfileCss, /healthcare-network-title\s*\{[\s\S]*?grid-template-areas:\s*"main help"\s*"sub help"/);
  assert.match(accountProfileCss, /healthcare-network-title\.referral-dynamics-title-with-help\s*\{[\s\S]*?display:\s*grid/);
  assert.match(accountProfileCss, /healthcare-network-title\.referral-dynamics-title-with-help\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(accountProfileCss, /healthcare-network-title\.referral-dynamics-title-with-help > \.healthcare-network-title-main,[\s\S]*?healthcare-network-title\.referral-dynamics-title-with-help > \.healthcare-network-title-sub\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(accountProfileCss, /healthcare-network-title\s*\{[\s\S]*?justify-self:\s*stretch;[\s\S]*?width:\s*100%/);
  assert.match(accountProfileCss, /healthcare-network-title-main\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(accountProfileCss, /healthcare-network-title-sub\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(accountProfileCss, /healthcare-network-title-main/);
  assert.match(accountProfileCss, /healthcare-network-title-sub/);
});

test('Account Insights tablet columns keep Created Date and Created By fully visible', () => {
  assert.match(accountProfileCss, /Final Account Profile table consistency pass/);
  assert.match(
    accountProfileCss,
    /account-insight-table \.profile-table-head,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*96px\s*126px\s*126px\s*56px/
  );
  assert.match(
    accountProfileCss,
    /account-insight-table \.profile-table-head span\s*\{[\s\S]*?min-height:\s*36px[\s\S]*?padding:\s*0 8px/
  );
  assert.match(
    accountProfileCss,
    /account-insight-table \.profile-table-head \.table-sort-copy[\s\S]*?overflow:\s*visible/
  );
  assert.match(
    accountProfileCss,
    /account-insight-table \.profile-table-head \.table-sort-label[\s\S]*?white-space:\s*normal/
  );
  assert.match(
    accountProfileCss,
    /account-insight-table \.profile-table-head \.profile-action-head::before[\s\S]*?content:\s*none !important/
  );
  assert.match(
    accountProfileCss,
    /account-insight-table \.profile-action-cell\s*\{[\s\S]*?padding-right:\s*8px !important;[\s\S]*?padding-left:\s*8px !important/
  );
});

test('Team member tablet rows use proportional columns and left-aligned compact values', () => {
  assert.match(teamMembersCss, /Balanced iPad row allocation/);
  assert.match(teamMembersCss, /grid-template-columns:\s*minmax\(184px,\s*1\.28fr\)\s*minmax\(188px,\s*1\.32fr\)\s*minmax\(128px,\s*0\.9fr\)\s*62px/);
  assert.match(teamMembersCss, /\.page-team-members \.team-members-table-row > span:nth-child\(2\)[\s\S]*?white-space:\s*normal/);
  assert.match(teamMembersCss, /Full-label sortable header alignment/);
  assert.match(teamMembersCss, /\.page-team-members \.team-members-table-row > span\s*\{[\s\S]*?justify-content:\s*flex-start !important;[\s\S]*?text-align:\s*left !important/);
});
