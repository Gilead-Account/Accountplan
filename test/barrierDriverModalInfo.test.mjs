import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalPath = new URL('../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx', import.meta.url);
const cssPath = new URL('../src/styles/edit-modal.css', import.meta.url);
const homePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);
const barriersDriversPath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);

test('barrier driver edit modal exposes field-level info guidance', async () => {
  const [modalSource, homeSource, barriersDriversSource] = await Promise.all([
    readFile(modalPath, 'utf8'),
    readFile(homePath, 'utf8'),
    readFile(barriersDriversPath, 'utf8'),
  ]);

  assert.match(homeSource, /<BarrierDriverEditModal/);
  assert.match(barriersDriversSource, /<BarrierDriverEditModal/);
  assert.doesNotMatch(modalSource, /infoOpen/);
  assert.doesNotMatch(modalSource, /bd-modal-info-popover/);
  assert.match(modalSource, /from '@\/components\/EditModalField'/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.title\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.status\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.type\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.indication\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.strategy\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.category\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.businessImpact\}/);
  assert.match(modalSource, /help=\{BARRIER_DRIVER_HELP\.comments\}/);
  assert.match(modalSource, /text=\{BARRIER_DRIVER_HELP\.tacticalActionsGuide\}/);
  assert.match(modalSource, /Create a new \$\{typeLower\} for this account plan\./);

  for (const text of [
    'Enter a concise description of the barrier or driver.',
    'Indicates the current stage',
    'Read-only shows if record is a barrier or a driver.',
    'Select the relevant disease area this barrier or driver applies to.',
    'Select the strategic focus aligned to this barrier or driver',
    'Classifies the barrier or driver by primary area for consistency and reporting.',
    'Indicate the business impact',
    'Provide relevant context or observations to help explain the barrier or driver',
    'Reference guidance on recommended actions aligned to the selected barrier or driver.',
    'Create a new ${typeLower} for this account plan.',
  ]) {
    assert.match(modalSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('edit modal field help popovers are constrained for iPad layouts', async () => {
  const cssSource = await readFile(cssPath, 'utf8');

  assert.match(cssSource, /\.stakeholder-edit-field-label-row/);
  assert.match(cssSource, /\.field-help-button/);
  assert.match(cssSource, /\.field-help-popover[\s\S]*?max-height:/);
  assert.match(cssSource, /\.field-help-popover[\s\S]*?overflow-y:\s*auto;/);
  assert.match(cssSource, /@media \(max-width:\s*820px\)[\s\S]*?\.field-help-popover/);
});
