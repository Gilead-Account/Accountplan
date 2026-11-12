import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const criticalActivitiesPageSource = await readFile(
  new URL('../src/pages/CriticalActivities/index.jsx', import.meta.url),
  'utf8'
);
const linkedStatusPromptSource = await readFile(
  new URL('../src/pages/CriticalActivities/LinkedBarrierDriverStatusPrompt.jsx', import.meta.url),
  'utf8'
);
const barriersDriversPageSource = await readFile(
  new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url),
  'utf8'
);
const overviewPageSource = await readFile(
  new URL('../src/pages/Overview/index.jsx', import.meta.url),
  'utf8'
);
const criticalActivitiesDataSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/criticalActivities.js', import.meta.url),
  'utf8'
);
const homeDataSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/home.js', import.meta.url),
  'utf8'
);
const sharedDataSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url),
  'utf8'
);

test('Critical Activities fetch Barrier/Driver status options dynamically for the completion prompt', () => {
  assert.match(criticalActivitiesDataSource, /BARRIER_DRIVER_OBJECT/);
  assert.match(criticalActivitiesDataSource, /fetchBarrierDriverStatusPicklistOptions/);
  assert.match(
    criticalActivitiesDataSource,
    /getPicklistValueLabels\(BARRIER_DRIVER_OBJECT,\s*'KPH_Status__c'\)/
  );
  assert.match(criticalActivitiesDataSource, /barrierStatuses:/);
  assert.match(criticalActivitiesPageSource, /picklists\.barrierStatuses/);
  assert.doesNotMatch(criticalActivitiesPageSource, /BARRIER_DRIVER_STATUS_ORDER/);
});

test('shared Barrier/Driver status prompt sources display Closed instead of CRM Close', () => {
  assert.match(
    criticalActivitiesDataSource,
    /\(dynamicPicklists\.barrierStatuses \|\| \[\]\)[\s\S]*?\.map\(\s*normalizeBarrierDriverStatusForDisplay\s*\)/
  );
  assert.match(
    homeDataSource,
    /\(dynamicPicklists\.barrierStatuses \|\| \[\]\)[\s\S]*?\.map\(\s*normalizeBarrierDriverStatusForDisplay\s*\)/
  );
});

test('completing a linked Critical Activity opens a Barrier/Driver status prompt', () => {
  assert.match(criticalActivitiesPageSource, /pendingBarrierDriverStatusConfirm/);
  assert.match(criticalActivitiesPageSource, /pendingBarrierDriverStatusPrompt/);
  assert.match(linkedStatusPromptSource, /shouldPromptForBarrierDriverStatus/);
  assert.match(linkedStatusPromptSource, /remainingOpenActivityCount/);
  assert.match(linkedStatusPromptSource, /Do you want to change the status of the linked \{prompt\.parentTypeLabel\}\?/);
  assert.doesNotMatch(linkedStatusPromptSource, /linked Barrier\/Driver/);
  assert.match(criticalActivitiesPageSource, /handleOpenBarrierDriverStatusPrompt/);
  assert.match(criticalActivitiesPageSource, /handleDismissBarrierDriverStatusConfirm/);
  assert.match(criticalActivitiesPageSource, /handleDismissBarrierDriverStatusPrompt/);
  assert.match(criticalActivitiesPageSource, /handleSaveBarrierDriverStatusPrompt/);
});

test('Critical Activity status popup hides Closed while related activities remain open', () => {
  assert.match(linkedStatusPromptSource, /visibleBarrierDriverStatusOptions/);
  assert.match(linkedStatusPromptSource, /!isClosedBarrierDriverStatus\(option\)/);
  assert.doesNotMatch(linkedStatusPromptSource, /disabled=\{closedDisabled\}/);
  assert.match(
    linkedStatusPromptSource,
    /All Critical Activities must be Complete before the \{prompt\.parentTypeLabel\} can be Closed\./
  );
});

test('Critical Activity completion prompt flow is wired on Critical Activities, Home, and Barriers & Drivers pages', () => {
  for (const source of [criticalActivitiesPageSource, overviewPageSource, barriersDriversPageSource]) {
    assert.match(source, /buildLinkedBarrierDriverStatusPrompt/);
    assert.match(source, /LinkedBarrierDriverStatusConfirmModal/);
    assert.match(source, /LinkedBarrierDriverStatusPromptModal/);
    assert.match(source, /saveBarrierDriverStatus/);
    assert.match(source, /pendingBarrierDriverStatusConfirm/);
    assert.match(source, /pendingBarrierDriverStatusPrompt/);
  }
});

test('Barrier/Driver status prompt writes only the status field', () => {
  assert.match(criticalActivitiesDataSource, /export const saveBarrierDriverStatus = updateBarrierDriverStatus/);
  assert.match(sharedDataSource, /export const updateBarrierDriverStatus = \(id, status\)/);
  assert.match(sharedDataSource, /KPH_Status__c:\s*normalizeBarrierDriverStatusForSave\(status\)/);
});
