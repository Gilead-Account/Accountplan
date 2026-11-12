import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const barriersDriversPagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const barriersDriversCssPath = new URL('../src/pages/BarriersDrivers/BarriersDrivers.css', import.meta.url);
const mainCssPath = new URL('../src/styles/main.css', import.meta.url);

test('Barriers and Drivers opens on active barriers with the Active status card selected', async () => {
  const source = await readFile(barriersDriversPagePath, 'utf8');

  assert.match(source, /const DEFAULT_FILTERS = \{\s*type: 'All',\s*indication: 'All',\s*category: 'All',\s*strategy: 'All',\s*status: 'Active'/);
  assert.match(source, /const \[tab,\s*setTab\] = useState\('barriers'\)/);
  assert.match(source, /className=\{`mock-kpi-card bd-status-card \$\{filters\.status === 'Active' \? 'is-active' : ''\}`\}/);
  assert.match(source, /aria-pressed=\{filters\.status === 'Active'\}/);
  assert.match(source, /<option value="Active">Active \{activeRecordTypeLabel\}<\/option>/);
});

test('Barriers and Drivers exposes a dynamic strategy filter next to indication', async () => {
  const source = await readFile(barriersDriversPagePath, 'utf8');

  assert.match(source, /strategy: 'All'/);
  assert.match(source, /const recordMatchesStrategy = \(record, strategy\) =>/);
  assert.match(source, /const strategyOptionsForFilter = \(picklists, tab, indicationFilter\) =>/);
  assert.match(source, /const type = tab === 'drivers' \? 'Driver' : 'Barrier'/);
  assert.match(source, /const allowedIndications = filterBarrierDriverIndicationsForType\(picklists\?\.barrierDriverIndications, type\)/);
  assert.match(source, /optionsForControllerValue\(picklists\?\.strategyOptionsByIndication, indication\)/);
  assert.match(source, /fallbackStrategiesForIndication\(picklists, indication\)/);
  assert.match(source, /strategyOptionsForFilter\(picklists, tab, filters\.indication\)/);
  assert.match(source, /recordMatchesStrategy\(r, filters\.strategy\)/);
  assert.match(source, /name="barrierDriverStrategyFilter"/);
  assert.match(source, /opt === 'All' \? 'Strategy \(All\)' : strategyLabelForValue\(picklists, opt\)/);
});

test('Barriers and Drivers exposes a CRM-labelled category filter for both record types', async () => {
  const source = await readFile(barriersDriversPagePath, 'utf8');

  assert.match(source, /category: 'All'/);
  assert.match(source, /const categoryOptionsForFilter = \(picklists, tab, indicationFilter, records\) =>/);
  assert.match(source, /picklists\?\.driverCategoryOptionsByIndication/);
  assert.match(source, /picklists\?\.barrierCategoryOptionsByIndication/);
  assert.match(source, /recordMatchesCategory\(r, filters\.category, picklists\)/);
  assert.match(source, /name="barrierDriverCategoryFilter"/);
  assert.match(source, /aria-label=\{`\$\{activeRecordSingularLabel\} category filter`\}/);
  assert.match(source, /opt === 'All' \? 'Indication' : opt/);
  assert.match(source, /opt === 'All' \? 'Category \(All\)' : opt/);
});

test('Barriers and Drivers wraps the four desktop filters into two rows', async () => {
  const css = await readFile(barriersDriversCssPath, 'utf8');
  const mainCss = await readFile(mainCssPath, 'utf8');

  assert.match(css, /@media \(min-width: 1401px\)/);
  assert.match(
    css,
    /Desktop: split the expanded filter set across two rows[\s\S]*?\.bd-filter-select-box\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    css,
    /Desktop: split the expanded filter set across two rows[\s\S]*?\.bd-filter-add-button\s*\{[\s\S]*?width:\s*124px/
  );
  assert.match(
    mainCss,
    /Desktop follow-up:[\s\S]*?\.bd-filter-select-box\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
});

test('Barriers and Drivers keeps KPI buttons, four filters, and Add on one landscape iPad row', async () => {
  const css = await readFile(barriersDriversCssPath, 'utf8');
  const mainCss = await readFile(mainCssPath, 'utf8');

  assert.match(css, /@media \(min-width: 841px\) and \(max-width: 1400px\) and \(orientation: landscape\)/);
  assert.match(css, /Landscape iPad command row[\s\S]*?\.bd-command-body[\s\S]*?grid-template-columns:\s*max-content minmax\(0,\s*1fr\)/);
  assert.match(css, /Landscape iPad command row[\s\S]*?\.bd-status-card-row[\s\S]*?grid-template-columns:\s*repeat\(2,\s*100px\)/);
  assert.match(css, /Landscape iPad command row[\s\S]*?\.bd-filter-select-box[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mainCss, /@media \(min-width: 841px\) and \(max-width: 1400px\) and \(orientation: landscape\)[\s\S]*?\.bd-command-body[\s\S]*?grid-template-columns:\s*max-content minmax\(0,\s*1fr\)/);
  assert.match(mainCss, /@media \(min-width: 841px\) and \(max-width: 1400px\) and \(orientation: landscape\)[\s\S]*?\.bd-filter-select-box[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /barrierDriverStrategyFilter[\s\S]*?text-overflow:\s*ellipsis/);
});
