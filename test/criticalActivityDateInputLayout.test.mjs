import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const editModalCss = await read('../src/styles/edit-modal.css');

test('critical activity due date inputs are clamped inside modal grid cells on iPad', () => {
  assert.match(editModalCss, /\.stakeholder-edit-grid > \.stakeholder-edit-field\.critical-activity-due-date-field/);
  assert.match(editModalCss, /critical-activity-due-date-field[\s\S]*?overflow:\s*hidden !important/);
  assert.match(editModalCss, /input\.critical-activity-due-date-input\[name='criticalActivityDueDate'\]\[type='date'\]/);
  assert.match(editModalCss, /input\.critical-activity-due-date-input[\s\S]*?min-width:\s*0 !important/);
  assert.match(editModalCss, /input\.critical-activity-due-date-input[\s\S]*?max-width:\s*100% !important/);
  assert.match(editModalCss, /input\.critical-activity-due-date-input[\s\S]*?inline-size:\s*100% !important/);
  assert.match(editModalCss, /input\.critical-activity-due-date-input[\s\S]*?-webkit-appearance:\s*none !important/);
  assert.match(editModalCss, /input\.critical-activity-due-date-input[\s\S]*?appearance:\s*none !important/);
  assert.match(editModalCss, /critical-activity-due-date-input[\s\S]*?::-webkit-date-and-time-value/);
  assert.match(editModalCss, /critical-activity-due-date-input[\s\S]*?::-webkit-datetime-edit/);
});

test('every critical activity modal due date field uses the shared date input path', async () => {
  const modalPaths = [
    '../src/pages/CriticalActivities/CriticalActivityNewModal.jsx',
    '../src/pages/CriticalActivities/CriticalActivityEditModal.jsx',
  ];

  for (const path of modalPaths) {
    const source = await read(path);
    assert.match(source, /<Field label="Due Date" className="critical-activity-due-date-field">/);
    assert.match(source, /className="critical-activity-due-date-input"/);
    assert.match(source, /name="criticalActivityDueDate"/);
    assert.match(source, /type="date"/);
  }

  const legacySource = await read('../src/pages/BarriersDrivers/ActivityEditModal.jsx');
  assert.match(legacySource, /export \{ default \} from '@\/pages\/CriticalActivities\/CriticalActivityEditModal'/);
});
