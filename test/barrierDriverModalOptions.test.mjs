import assert from 'node:assert/strict';
import test from 'node:test';

import { optionsWithTransientValue } from '../src/pages/BarriersDrivers/barrierDriverModalOptions.js';

test('a backend-only strategy remains selectable while it is the current value', () => {
  assert.deepEqual(
    optionsWithTransientValue('Legacy backend strategy', ['Current A', 'Current B']),
    ['Legacy backend strategy', 'Current A', 'Current B']
  );
});

test('the backend-only strategy disappears after deselection or replacement', () => {
  const picklist = ['Current A', 'Current B'];

  assert.deepEqual(optionsWithTransientValue('', picklist), picklist);
  assert.deepEqual(optionsWithTransientValue('Current B', picklist), picklist);
});

test('strategy options stay unique and ignore empty values', () => {
  assert.deepEqual(
    optionsWithTransientValue('Current A', ['', 'Current A', 'Current A', 'Current B']),
    ['Current A', 'Current B']
  );
});
