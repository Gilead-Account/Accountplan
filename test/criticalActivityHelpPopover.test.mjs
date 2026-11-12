import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fieldComponentPath = new URL('../src/components/EditModalField.jsx', import.meta.url);
const newModalPath = new URL('../src/pages/CriticalActivities/CriticalActivityNewModal.jsx', import.meta.url);
const editModalPath = new URL('../src/pages/CriticalActivities/CriticalActivityEditModal.jsx', import.meta.url);
const bdActivityModalPath = new URL('../src/pages/BarriersDrivers/ActivityEditModal.jsx', import.meta.url);
const linkedStatusPromptPath = new URL('../src/pages/CriticalActivities/LinkedBarrierDriverStatusPrompt.jsx', import.meta.url);
const editModalCssPath = new URL('../src/styles/edit-modal.css', import.meta.url);

test('shared field help uses the popover guidance text for laptop hover text', async () => {
  const fieldComponentSource = await readFile(fieldComponentPath, 'utf8');

  assert.match(fieldComponentSource, /aria-label=\{label\}/);
  assert.match(fieldComponentSource, /title=\{text\}/);
  assert.doesNotMatch(fieldComponentSource, /title=\{label\}/);
  assert.match(fieldComponentSource, /\{text\}\s*<\/span>/);
});

test('Critical Activity modals expose field-level help through each label i icon', async () => {
  const fieldComponentSource = await readFile(fieldComponentPath, 'utf8');
  const newModalSource = await readFile(newModalPath, 'utf8');
  const editModalSource = await readFile(editModalPath, 'utf8');
  const bdActivityModalSource = await readFile(bdActivityModalPath, 'utf8');
  const linkedStatusPromptSource = await readFile(linkedStatusPromptPath, 'utf8');
  const editModalCss = await readFile(editModalCssPath, 'utf8');

  assert.match(fieldComponentSource, /FieldHelpButton/);
  assert.match(fieldComponentSource, /className="field-help-button"/);
  assert.match(fieldComponentSource, /FIELD_HELP_OPEN_EVENT/);
  assert.match(fieldComponentSource, /window\.addEventListener\(FIELD_HELP_OPEN_EVENT/);
  assert.match(fieldComponentSource, /window\.dispatchEvent\(new CustomEvent\(FIELD_HELP_OPEN_EVENT/);
  assert.match(fieldComponentSource, /createPortal/);
  assert.match(fieldComponentSource, /HELP_SCOPE_SELECTOR/);
  assert.match(fieldComponentSource, /scopeElement/);

  for (const source of [newModalSource, editModalSource]) {
    assert.doesNotMatch(source, /CriticalActivityHelpPopover/);
    assert.match(source, /from '@\/components\/EditModalField'/);
    assert.match(source, /CRITICAL_ACTIVITY_HELP/);
    assert.match(source, /FieldHelpButton/);
    assert.match(source, /text=\{CRITICAL_ACTIVITY_HELP\.subheader\}/);
    assert.match(source, /help=\{CRITICAL_ACTIVITY_HELP\.title\}/);
    assert.match(source, /help=\{CRITICAL_ACTIVITY_HELP\.status\}/);
    assert.match(source, /help=\{CRITICAL_ACTIVITY_HELP\.dueDate\}/);
    assert.match(source, /help=\{CRITICAL_ACTIVITY_HELP\.indication\}/);
    assert.match(source, /help=\{CRITICAL_ACTIVITY_HELP\.accountable\}/);
    assert.match(source, /help=\{CRITICAL_ACTIVITY_HELP\.details\}/);
  }

  assert.match(newModalSource, /help=\{CRITICAL_ACTIVITY_HELP\.linkedBarrierDriver\}/);
  assert.match(editModalSource, /help=\{CRITICAL_ACTIVITY_HELP\.linkedBarrierDriver\}/);
  assert.match(bdActivityModalSource, /export \{ default \} from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
  assert.match(newModalSource, /Create a critical activity for this account plan/);
  assert.match(newModalSource, /Critical sub-header guidance/);
  assert.doesNotMatch(linkedStatusPromptSource, /CriticalActivityHelpPopover/);
  assert.match(editModalCss, /\.stakeholder-edit-subtitle-row/);
  assert.match(editModalCss, /\.stakeholder-edit-field-label-row/);
  assert.match(editModalCss, /\.field-help-button/);
  assert.match(editModalCss, /\.field-help-popover/);
  assert.match(editModalCss, /@media \(max-width:\s*820px\)[\s\S]*?\.field-help-popover/);
});
