import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedModalSource = await readFile(
  new URL('../src/pages/CriticalActivities/CriticalActivityEditModal.jsx', import.meta.url),
  'utf8'
);
const legacyModalSource = await readFile(
  new URL('../src/pages/BarriersDrivers/ActivityEditModal.jsx', import.meta.url),
  'utf8'
);
const criticalPageSource = await readFile(
  new URL('../src/pages/CriticalActivities/index.jsx', import.meta.url),
  'utf8'
);
const barriersDriversSource = await readFile(
  new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url),
  'utf8'
);
const overviewSource = await readFile(new URL('../src/pages/Overview/index.jsx', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sharedDataSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url),
  'utf8'
);

test('critical activity edit modals replace inactive checkbox with confirmed delete action', () => {
  assert.doesNotMatch(sharedModalSource, /name="criticalActivityDeactivate"/);
  assert.doesNotMatch(sharedModalSource, />\s*Inactive\s*</);
  assert.doesNotMatch(sharedModalSource, /handleDeactivateChange/);
  assert.match(sharedModalSource, /onDelete/);
  assert.match(sharedModalSource, /critical-activity-delete-button/);
  assert.match(sharedModalSource, />\s*Delete\s*</);
  assert.match(sharedModalSource, /Are you sure you want to delete this critical activity\?/);
  assert.match(sharedModalSource, />\s*Confirm Delete\s*</);
  assert.match(legacyModalSource, /export \{ default \} from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
});

test('confirmed critical activity delete writes soft-delete with existing parent context', () => {
  assert.match(sharedDataSource, /export const ACTIVITY_SOFT_DELETE_FIELD = 'KPH_Is_Deleted__c'/);
  assert.match(sharedDataSource, /const criticalActivityDeleteFields = \(activity = null\)/);
  assert.match(sharedDataSource, /export const deleteCriticalActivity/);
  assert.match(sharedDataSource, /\{\s*\[ACTIVITY_SOFT_DELETE_FIELD\]:\s*true\s*\}/);
  assert.match(sharedDataSource, /CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD\] = parentId/);
  assert.doesNotMatch(sharedDataSource, /KPH_Driver__c/);
  assert.doesNotMatch(sharedDataSource, /deactivateCriticalActivity[\s\S]*?\{\s*\[ACTIVITY_DEACTIVATE_FIELD\]:\s*true\s*\}/);
  assert.match(sharedDataSource, /where: `\$\{where\} AND \$\{SOFT_DELETE_ACTIVE_WHERE\}`/);
  assert.match(criticalPageSource, /deleteCriticalActivity\(editingActivity\.id,\s*editingActivity\)/);
  assert.match(criticalPageSource, /onDelete=\{handleDeleteActivity\}/);
  assert.match(overviewSource, /deleteCriticalActivity\(activity\.id,\s*activity\)/);
  assert.match(overviewSource, /onDelete=\{handleDeleteActivity\}/);
  assert.match(appSource, /activity\.isDeleted === true/);
  assert.match(
    sharedModalSource,
    /onClick=\{confirmDelete\}/
  );
  assert.match(
    barriersDriversSource,
    /deleteCriticalActivity\(activityEditState\.activity\.id,\s*activityEditState\.activity\)/
  );
  assert.match(appSource, /\.filter\(\(row\) => !row \|\| row\.id !== activity\.id\)/);
});

test('critical activity delete remains reachable when a linked barrier or driver is closed', () => {
  assert.match(
    sharedModalSource,
    /className="critical-activity-delete-button"\s*[\r\n]+\s*onClick=\{requestDelete\}\s*[\r\n]+\s*disabled=\{isSaving \|\| kiteDataAdminLimitedMode\}/
  );
  assert.doesNotMatch(
    sharedModalSource,
    /onClick=\{requestDelete\}\s*[\r\n]+\s*disabled=\{isSaving \|\| remainingFieldsDisabled\}/
  );

  assert.match(criticalPageSource, /disabled=\{isReadOnly \|\| !a\.id\}/);
  assert.doesNotMatch(criticalPageSource, /disabled=\{isReadOnly \|\| !a\.id \|\| !!a\.editDisabledReason\}/);
  assert.doesNotMatch(criticalPageSource, /if \(closedParentEditReason\(activity\)\) return/);

  assert.doesNotMatch(barriersDriversSource, /disabled=\{isReadOnly \|\| !!activity\.editDisabledReason\}/);
  assert.doesNotMatch(barriersDriversSource, /if \(closedParentEditReason\(activity\)\) return/);

  assert.match(overviewSource, /editDisabledReason=\{closedParentEditReason\(activityEditState\.activity\)\}/);
  assert.doesNotMatch(overviewSource, /if \(closedParentEditReason\(activity\)\) return/);
  assert.match(sharedModalSource, /editDisabledReason/);
  assert.match(sharedModalSource, /const allFieldsDisabled = Boolean\(editDisabledReason\)/);
  assert.match(
    sharedModalSource,
    /className="critical-activity-delete-button"\s*[\r\n]+\s*onClick=\{requestDelete\}\s*[\r\n]+\s*disabled=\{isSaving \|\| kiteDataAdminLimitedMode\}/
  );
  assert.match(sharedModalSource, /className="stakeholder-edit-button-primary" disabled=\{isSaving \|\| allFieldsDisabled\}/);
});

test('Kite Data Admin Critical Activities only submit Status and Details and cannot be deleted', () => {
  assert.match(sharedModalSource, /activity\?\.isKiteDataAdminCreated === true/);
  assert.match(sharedModalSource, /kiteDataAdminLimitedUpdate: kiteDataAdminLimitedMode/);
  assert.match(sharedModalSource, /disabled=\{isSaving \|\| kiteDataAdminLimitedMode\}/);
  assert.match(barriersDriversSource, /if \(activityEditState\.activity\?\.isKiteDataAdminCreated\) return/);
  assert.match(overviewSource, /if \(activity\?\.isKiteDataAdminCreated\) return/);
  assert.match(criticalPageSource, /if \(editingActivity\?\.isKiteDataAdminCreated\) return/);
});
