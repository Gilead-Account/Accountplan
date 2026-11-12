import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [overviewSource, activityPanelSource, modalSource, cssSource] = await Promise.all([
  readFile(new URL('../src/pages/Overview/index.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Overview/HomeBarrierDriverActivities.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Overview/Overview.css', import.meta.url), 'utf8'),
]);

test('Home Barrier Driver modal receives linked activities in established criticality order', () => {
  assert.match(overviewSource, /import HomeBarrierDriverActivities/);
  assert.match(overviewSource, /import \{ sortActivitiesByCriticality \}/);
  assert.match(overviewSource, /recordIdMatches\(activity\.barrierDriverId, selectedRecordId\)/);
  assert.match(overviewSource, /activity\.isDeactivated !== true/);
  assert.match(overviewSource, /activities=\{selectedBarrierDriverActivities\}/);
  assert.match(overviewSource, /modalClassName="home-bd-detail-modal"/);
  assert.match(overviewSource, /headerSubtitle=\{bdEditState\.record\?\.name \|\| 'Untitled'\}/);
  assert.match(modalSource, /\{children\}/);
  assert.match(modalSource, /const displayedSubtitle = headerSubtitle \?\? subtitle/);
  assert.match(modalSource, /!hideSubtitle \? <p>\{displayedSubtitle\}<\/p> : null/);
});
test('Home linked Critical Activities use an accessible accordion with complete CRM display information', () => {
  assert.match(activityPanelSource, /aria-expanded=\{isExpanded\}/);
  assert.match(activityPanelSource, /aria-controls=\{panelId\}/);
  assert.match(activityPanelSource, /Activity details/);
  assert.match(activityPanelSource, /label="Status"/);
  assert.match(activityPanelSource, /label="Due date"/);
  assert.match(activityPanelSource, /label="Accountable"/);
  assert.match(activityPanelSource, /label="Indication"/);
  assert.match(activityPanelSource, /label="Created by"/);
  assert.match(activityPanelSource, /label="Last modified"/);
  assert.match(activityPanelSource, /activity\.comments/);
  assert.match(activityPanelSource, /onEditActivity\(activity\)/);
  assert.match(activityPanelSource, /'complete', 'completed', 'closed', 'archived'/);
  assert.match(activityPanelSource, />Linked Critical Activities<\/h4>/);
  assert.doesNotMatch(activityPanelSource, /Review the work connected/);
  assert.doesNotMatch(activityPanelSource, />Linked work</);
  assert.match(activityPanelSource, /String\(index \+ 1\)\.padStart\(2, '0'\)/);
  assert.match(activityPanelSource, /\{ id: 'all', label: 'All Activities' \}/);
  assert.match(activityPanelSource, /\{ id: 'open', label: 'Open' \}/);
  assert.match(activityPanelSource, /\{ id: 'closed', label: 'Closed' \}/);
  assert.match(activityPanelSource, /useState\('all'\)/);
  assert.match(activityPanelSource, /aria-pressed=\{activityFilter === filter\.id\}/);
  assert.match(activityPanelSource, /selectActivityFilter\(filter\.id\)/);
  assert.match(activityPanelSource, /visibleRows\.map/);
});

test('Home activity modal styling is scoped, responsive, and reduced-motion safe', () => {
  assert.match(cssSource, /\.home-bd-detail-modal/);
  assert.match(cssSource, /\.home-bd-activity-accordion/);
  assert.match(cssSource, /\.home-bd-activity-meta-grid/);
  assert.match(cssSource, /@media \(max-width: 820px\)/);
  assert.match(cssSource, /@media \(max-width: 620px\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /\.home-bd-activity-filters[\s\S]*?display:\s*inline-grid/);
  assert.match(cssSource, /\.home-bd-activity-filter\.is-selected/);
  assert.match(cssSource, /\.home-bd-activity-filter:focus-visible/);
  assert.match(cssSource, /@media \(max-width: 820px\)[\s\S]*?\.home-bd-activity-filter/);
  assert.match(cssSource, /@media \(max-width: 620px\)[\s\S]*?\.home-bd-activity-filters/);
});
