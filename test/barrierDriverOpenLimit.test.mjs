import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const modalPath = new URL('../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx', import.meta.url);

test('barrier and driver create flows no longer enforce an open-record limit', async () => {
  const source = await readFile(sourcePath, 'utf8');

  // The ten-open-record cap was removed entirely.
  assert.doesNotMatch(source, /MAX_OPEN_BARRIER_DRIVER_RECORDS/);
  assert.doesNotMatch(source, /openRecordLimitMessage/);
  assert.doesNotMatch(source, /open .*are allowed/i);
  // Add buttons are only gated by read-only, not a limit.
  assert.match(source, /const barrierLimitReached = false;/);
  assert.match(source, /const driverLimitReached = false;/);
  assert.match(source, /const activeAddLimitReached = false;/);
});

test('barrier/driver modal subheader no longer mentions an open limit', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.doesNotMatch(modalSource, /Up to \d+ open/);
  assert.match(modalSource, /Create a new \$\{typeLower\} for this account plan\./);
});
