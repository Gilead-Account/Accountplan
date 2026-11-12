import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const summarySource = await readFile(
  new URL('../src/pages/Overview/BarriersDriversSummary.jsx', import.meta.url),
  'utf8'
);
const overviewCss = await readFile(
  new URL('../src/pages/Overview/Overview.css', import.meta.url),
  'utf8'
);

test('Home Barriers and Drivers table includes status and compact six-column layout', () => {
  assert.match(summarySource, /impactTone,\s*statusTone/);
  assert.match(summarySource, /const toneClass = \(tone\) =>/);
  assert.match(summarySource, /key:\s*'name',\s*label:\s*'Title'[\s\S]*?key:\s*'status',\s*label:\s*'Status'/);
  assert.match(summarySource, /home-summary-status-cell/);
  assert.match(summarySource, /home-summary-impact-cell/);
  assert.match(summarySource, /home-summary-indication-cell/);
  assert.match(summarySource, /home-summary-activity-count-cell/);
  assert.match(summarySource, /home-summary-tone-text/);
  assert.match(summarySource, /home-summary-plain-text/);
  assert.match(summarySource, /home-summary-columns \$\{table\.tone \|\| ''\}/);
  assert.doesNotMatch(summarySource, /className=\{`pill/);
  assert.doesNotMatch(summarySource, /chip-blue/);
  assert.match(overviewCss, /--home-right-column:\s*minmax\(320px,\s*0\.72fr\)/);
  assert.match(overviewCss, /home-summary-columns,[\s\S]*?home-summary-row[\s\S]*?grid-template-columns:[\s\S]*?minmax\(188px,\s*1\.64fr\)[\s\S]*?minmax\(64px,\s*0\.5fr\)[\s\S]*?minmax\(64px,\s*0\.5fr\)\s*!important/);
  assert.match(overviewCss, /home-summary-columns,[\s\S]*?home-summary-row[\s\S]*?gap:\s*8px/);
  assert.match(overviewCss, /home-summary-columns[\s\S]*?font-size:\s*11\.5px/);
  assert.match(overviewCss, /home-summary-columns > span[\s\S]*?white-space:\s*normal/);
  assert.match(overviewCss, /home-summary-columns > span[\s\S]*?box-sizing:\s*border-box/);
  assert.match(overviewCss, /home-summary-columns > span[\s\S]*?min-width:\s*0/);
  assert.match(overviewCss, /home-summary-columns > span[\s\S]*?max-width:\s*100%/);
  assert.match(overviewCss, /home-summary-columns > span[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(overviewCss, /home-summary-columns > span[\s\S]*?font-weight:\s*950/);
  assert.match(overviewCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)[\s\S]*?home-summary-columns[\s\S]*?font-size:\s*9px/);
  assert.match(overviewCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)[\s\S]*?grid-template-columns:[\s\S]*?minmax\(40px,\s*0\.52fr\)[\s\S]*?minmax\(74px,\s*1\.28fr\)[\s\S]*?minmax\(46px,\s*0\.6fr\)[\s\S]*?minmax\(44px,\s*0\.48fr\)[\s\S]*?minmax\(50px,\s*0\.56fr\)[\s\S]*?minmax\(50px,\s*0\.5fr\)/);
  assert.match(overviewCss, /@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)[\s\S]*?home-summary-columns > span:nth-child\(4\),[\s\S]*?home-summary-activity-count-cell[\s\S]*?width:\s*50px/);
  assert.match(overviewCss, /home-summary-columns > span:nth-child\(4\),[\s\S]*?home-summary-columns > span:nth-child\(6\)[\s\S]*?max-width:\s*64px/);
  assert.match(overviewCss, /home-summary-impact-cell,[\s\S]*?home-summary-activity-count-cell[\s\S]*?width:\s*64px/);
  assert.match(overviewCss, /home-summary-columns\.barrier > span[\s\S]*?color:\s*#00658c/);
  assert.match(overviewCss, /home-summary-columns\.driver > span[\s\S]*?color:\s*#176f45/);
  assert.match(overviewCss, /home-summary-table-head\.driver \.summary-counts[\s\S]*?background:\s*#eef8f3[\s\S]*?color:\s*#176f45/);
  assert.match(overviewCss, /home-summary-tone-text\.is-positive[\s\S]*?color:\s*var\(--green\)/);
  assert.match(overviewCss, /home-summary-tone-text\.is-negative[\s\S]*?color:\s*var\(--danger\)/);
  assert.match(overviewCss, /home-summary-plain-text[\s\S]*?color:\s*#33566b/);
});
