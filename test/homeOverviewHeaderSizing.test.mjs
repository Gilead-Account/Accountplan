import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const overviewCss = await readFile(
  new URL('../src/pages/Overview/Overview.css', import.meta.url),
  'utf8'
);
const urgentActivitiesSource = await readFile(
  new URL('../src/pages/Overview/UrgentActivities.jsx', import.meta.url),
  'utf8'
);

test('Home card headings stay larger while the long activity title remains single-line', () => {
  assert.match(urgentActivitiesSource, /home-activity-title-main/);
  assert.match(urgentActivitiesSource, /home-activity-title-window/);
  assert.match(overviewCss, /--home-card-header-height:\s*28px/);
  assert.match(overviewCss, /mock-card > h3,[\s\S]*?mock-section-head > h3[\s\S]*?font-size:\s*18px\s*!important/);
  assert.match(overviewCss, /\.mock-home-page \.home-activity-title[\s\S]*?font-size:\s*18px\s*!important/);
  assert.match(overviewCss, /home-activity-title-window[\s\S]*?font-size:\s*13\.5px/);
  assert.match(overviewCss, /home-activity-title[\s\S]*?white-space:\s*nowrap/);
  assert.match(overviewCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)[\s\S]*?mock-section-head > h3[\s\S]*?font-size:\s*16px\s*!important/);
  assert.match(overviewCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)[\s\S]*?home-activity-title[\s\S]*?font-size:\s*16px\s*!important/);
  assert.match(overviewCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)[\s\S]*?home-activity-title-window[\s\S]*?font-size:\s*9\.5px/);
});
