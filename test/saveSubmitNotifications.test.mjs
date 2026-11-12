import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebarSource = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const submitMpdModalSource = await readFile(new URL('../src/components/SubmitMpdApprovalModal.jsx', import.meta.url), 'utf8');
const overviewSource = await readFile(new URL('../src/pages/Overview/index.jsx', import.meta.url), 'utf8');
const barriersSource = await readFile(new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url), 'utf8');
const criticalSource = await readFile(new URL('../src/pages/CriticalActivities/index.jsx', import.meta.url), 'utf8');
const accountProfileSource = await readFile(new URL('../src/pages/AccountProfile/index.jsx', import.meta.url), 'utf8');
const profileTabSource = await readFile(new URL('../src/pages/AccountProfile/ProfileTab.jsx', import.meta.url), 'utf8');
const poaSource = await readFile(new URL('../src/pages/CrossFunctionalPlan/index.jsx', import.meta.url), 'utf8');
const stakeholdersSource = await readFile(new URL('../src/pages/Stakeholders/index.jsx', import.meta.url), 'utf8');
const teamMembersSource = await readFile(new URL('../src/pages/TeamMembers/index.jsx', import.meta.url), 'utf8');
const approvalCommentsSource = await readFile(new URL('../src/lib/approvalComments.js', import.meta.url), 'utf8');

test('App renders a dismissible success popup for save and submit notifications', () => {
  assert.match(appSource, /const \[appNotice,\s*setAppNotice\] = useState\(null\)/);
  assert.match(appSource, /className=\{`app-notice-toast \$\{appNotice\.tone/);
  assert.match(appSource, /role=\{appNotice\.tone === 'danger' \? 'alert' : 'status'\}/);
  assert.match(appSource, /const refreshLoadedPages = \(keys = Array\.from\(loadedRef\.current\)\)/);
  assert.match(appSource, /if \(refreshPages\) \{\s*refreshLoadedPages\(\);/);
  assert.match(appSource, /onSubmitMpdApproval=\{handleSubmitMpdApproval\}/);
});

test('Submit for MPD Approval opens a streamlined comments modal instead of only logging to console', () => {
  assert.match(sidebarSource, /onSubmitMpdApproval/);
  assert.match(sidebarSource, /option\.key === 'submit-mpd-approval'/);
  assert.match(sidebarSource, /label:\s*'Submit for MPD Approval'/);
  assert.match(appSource, /const \[isMpdApprovalOpen,\s*setIsMpdApprovalOpen\] = useState\(false\)/);
  assert.match(appSource, /Submit for MPD approval failed\./);
  assert.match(appSource, /<SubmitMpdApprovalModal/);
  assert.match(submitMpdModalSource, /<h3>Submit for MPD Approval<\/h3>/);
  assert.match(submitMpdModalSource, /submit-mpd-approval-body/);
  assert.match(submitMpdModalSource, /submit-mpd-comment-field/);
  assert.match(submitMpdModalSource, /stakeholder-edit-field-label">Comments/);
  assert.match(submitMpdModalSource, /<textarea/);
  assert.match(approvalCommentsSource, /APPROVAL_COMMENT_MAX_LENGTH\s*=\s*1000/);
  assert.match(submitMpdModalSource, /maxLength=\{APPROVAL_COMMENT_MAX_LENGTH\}/);
  assert.match(submitMpdModalSource, /\{comments\.length\}\/\{APPROVAL_COMMENT_MAX_LENGTH\}/);
  assert.match(submitMpdModalSource, /aria-live="polite"/);
  assert.match(submitMpdModalSource, /Comment is required\./);
  assert.doesNotMatch(submitMpdModalSource, /<section className="stakeholder-edit-section">/);
  assert.doesNotMatch(submitMpdModalSource, /Keep this concise/);
  assert.doesNotMatch(sidebarSource, /Submit Approval for MPD/);
  assert.doesNotMatch(submitMpdModalSource, /Submit Approval for MPD/);
  assert.doesNotMatch(
    sidebarSource,
    /option\.key === 'submit-mpd-approval'[\s\S]{0,120}console\.info/
  );
});

test('Submit for MPD Approval is hidden for restricted Veeva profiles', () => {
  assert.match(appSource, /getCurrentUserProfileName/);
  assert.match(appSource, /isMpdApprovalRestrictedProfile/);
  assert.match(appSource, /isMpdApprovalDisabled=\{isMpdApprovalDisabled\}/);
  assert.match(sidebarSource, /isMpdApprovalDisabled/);
  assert.match(
    sidebarSource,
    /EXPORT_MENU_OPTIONS\.filter\(\(option\) => option\.key !== 'submit-mpd-approval'\)/
  );
  assert.match(sidebarSource, /visibleExportMenuOptions\.map\(\(option\) =>/);
  assert.doesNotMatch(sidebarSource, /Disabled for your profile/);
});

test('page save handlers emit success notifications after successful saves', () => {
  [
    [overviewSource, /onNotify\?\.\(\{\s*title: 'Customer goals saved\.'/],
    [overviewSource, /onNotify\?\.\(\{\s*title: `\$\{recordTypeLabel\} saved\.`/],
    [barriersSource, /onNotify\?\.\(\{\s*title: statusOnlyUpdate[\s\S]*?`\$\{activeRecordSingularLabel\} saved\.`/],
    [criticalSource, /onNotify\?\.\(\{\s*title: 'Critical activity saved\.'/],
    [profileTabSource, /onNotify\?\.\(\{\s*title: 'Account profile saved\.'/],
    [accountProfileSource, /onNotify\?\.\(\{\s*title: 'Referral account saved\.'/],
    [accountProfileSource, /onNotify\?\.\(\{\s*title: 'Healthcare network saved\.'/],
    [accountProfileSource, /onNotify\?\.\(\{\s*title: 'Account insight saved\.'/],
    [accountProfileSource, /onNotify\?\.\(\{\s*title: 'Regional dynamics saved\.'/],
    [poaSource, /onNotify\?\.\(\{\s*title: 'Plan of Action saved\.'/],
    [stakeholdersSource, /onNotify\?\.\(\{\s*title: 'Stakeholder saved\.'/],
    [teamMembersSource, /onNotify\?\.\(\{\s*title: 'Team member saved\.'/],
  ].forEach(([source, pattern]) => {
    assert.match(source, pattern);
  });
});

test('backend-backed save notifications request loaded page cache refresh', () => {
  [
    overviewSource,
    barriersSource,
    criticalSource,
    profileTabSource,
    accountProfileSource,
    poaSource,
    stakeholdersSource,
    teamMembersSource,
  ].forEach((source) => {
    assert.match(source, /refreshPages: true/);
  });
});
