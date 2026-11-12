import test from 'node:test';
import assert from 'node:assert/strict';
import { homeSummaryTables, homeUrgentActivities, isHomeActivityWindow } from '../src/lib/helper/utils.js';

test('home summary activity counts are scoped to barrier and driver records', () => {
  const barriers = [
    { id: 'barrier-1', type: 'Barrier', status: 'Open', name: 'Barrier one' },
    { id: 'barrier-2', type: 'Barrier', status: 'Open', name: 'Barrier two' },
  ];
  const drivers = [
    { id: 'driver-1', type: 'Driver', status: 'Open', name: 'Driver one' },
  ];
  const activities = [
    { id: 'act-1', barrierDriverId: 'barrier-1', status: 'Planned' },
    { id: 'act-2', barrierDriverId: 'barrier-2', status: 'In Progress' },
    { id: 'act-3', barrierDriverId: 'barrier-2', status: 'Complete', completedDate: new Date().toISOString() },
    { id: 'act-4', barrierDriverId: 'driver-1', status: 'Complete', completedDate: new Date().toISOString() },
    { id: 'act-plan', barrierDriverId: null, status: 'Planned' },
  ];

  const tables = homeSummaryTables(barriers, drivers, activities);

  assert.equal(tables[0].title, 'Barriers');
  assert.equal(tables[0].countSummary, 'Critical Activities: 2 open | 1 closed in last 90 days');
  assert.equal(tables[1].title, 'Drivers');
  assert.equal(tables[1].countSummary, 'Critical Activities: 0 open | 1 closed in last 90 days');
});

test('home urgent activities exclude inactive critical activities', () => {
  const dueToday = new Date().toISOString().slice(0, 10);

  assert.equal(
    isHomeActivityWindow({ status: 'In Progress', dueDate: dueToday, isDeactivated: true }),
    false
  );
});

test('home summary includes MM barrier driver rows and MM urgent activities', () => {
  const dueToday = new Date().toISOString().slice(0, 10);
  const barriers = [
    { id: 'barrier-dlbcl', type: 'Barrier', status: 'Open', name: 'DLBCL barrier', indication: 'DLBCL' },
    { id: 'barrier-mm', type: 'Barrier', status: 'Open', name: 'MM barrier', indication: 'MM' },
  ];
  const drivers = [
    { id: 'driver-dlbcl', type: 'Driver', status: 'Open', name: 'DLBCL driver', indication: 'DLBCL' },
    { id: 'driver-mm', type: 'Driver', status: 'Open', name: 'MM driver', indication: 'MM' },
  ];
  const activities = [
    { id: 'activity-dlbcl', barrierDriverId: 'barrier-dlbcl', status: 'Planned', name: 'DLBCL activity', indication: 'DLBCL', dueDate: dueToday },
    { id: 'activity-mm', barrierDriverId: 'barrier-mm', status: 'Planned', name: 'MM activity', indication: 'MM', dueDate: dueToday },
  ];

  const tables = homeSummaryTables(barriers, drivers, activities);

  assert.deepEqual(tables[0].rows.map((row) => row.name), ['DLBCL barrier', 'MM barrier']);
  assert.deepEqual(tables[1].rows.map((row) => row.name), ['DLBCL driver', 'MM driver']);
  assert.equal(tables[0].countSummary, 'Critical Activities: 2 open | 0 closed in last 90 days');
  assert.deepEqual(homeUrgentActivities(activities).map((activity) => activity.name), ['DLBCL activity', 'MM activity']);
});

test('home summary activity counts match 15 and 18 character Salesforce id variants', () => {
  const barriers = [
    { id: '001000000000001AAA', type: 'Barrier', status: 'Open', name: 'Variant barrier' },
  ];
  const drivers = [
    { id: '001000000000002AAA', type: 'Driver', status: 'Open', name: 'Variant driver' },
  ];
  const activities = [
    { id: 'activity-variant', barrierDriverId: '001000000000001', status: 'Planned' },
    { id: 'activity-driver-variant', barrierDriverId: '001000000000002', status: 'Planned' },
  ];

  const tables = homeSummaryTables(barriers, drivers, activities);

  assert.equal(tables[0].countSummary, 'Critical Activities: 1 open | 0 closed in last 90 days');
  assert.equal(tables[1].countSummary, 'Critical Activities: 1 open | 0 closed in last 90 days');
});
