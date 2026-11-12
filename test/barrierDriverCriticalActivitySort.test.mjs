import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  sortActivitiesByCriticality,
  sortDriversByCriticalActivityPriority,
  sortRecordsByCriticalActivityPriority,
} from '../src/pages/BarriersDrivers/criticalActivityPrioritySort.js';

const NOW = new Date('2026-07-23T12:00:00');

const driver = (id) => ({ id, name: id });
const activity = (barrierDriverId, dueDate, overrides = {}) => ({
  id: `${barrierDriverId}-${dueDate || 'undated'}`,
  barrierDriverId,
  dueDate,
  status: 'In Progress',
  ...overrides,
});

test('sorts nested activities by due-date criticality and keeps completed activities at the bottom', () => {
  const activities = [
    activity('parent', '2026-07-25', { id: 'upcoming-later', status: 'Planned' }),
    activity('parent', '2026-07-01', { id: 'most-overdue', status: 'Planned' }),
    activity('parent', '2026-06-01', { id: 'completed-oldest', status: 'Completed' }),
    activity('parent', null, { id: 'undated-active', status: 'In Progress' }),
    activity('parent', '2026-07-20', { id: 'overdue-recent', status: 'In Progress' }),
    activity('parent', '2026-07-24', { id: 'upcoming-nearest', status: 'Planned' }),
    activity('parent', '2026-07-02', { id: 'closed', status: 'Closed' }),
  ];

  assert.deepEqual(
    sortActivitiesByCriticality(activities, NOW).map(({ id }) => id),
    [
      'most-overdue',
      'overdue-recent',
      'upcoming-nearest',
      'upcoming-later',
      'undated-active',
      'completed-oldest',
      'closed',
    ]
  );
});

test('keeps the CRM order for nested activities with the same priority', () => {
  const activities = [
    activity('parent', '2026-07-24', { id: 'same-date-first', status: 'Planned' }),
    activity('parent', '2026-07-24', { id: 'same-date-second', status: 'In Progress' }),
    activity('parent', null, { id: 'undated-first', status: 'Planned' }),
    activity('parent', null, { id: 'undated-second', status: 'In Progress' }),
    activity('parent', '2026-07-01', { id: 'complete-first', status: 'Complete' }),
    activity('parent', '2026-07-02', { id: 'complete-second', status: 'Completed' }),
  ];

  assert.deepEqual(
    sortActivitiesByCriticality(activities, NOW).map(({ id }) => id),
    [
      'same-date-first',
      'same-date-second',
      'undated-first',
      'undated-second',
      'complete-first',
      'complete-second',
    ]
  );
});

test('prioritizes drivers by their oldest overdue critical activity', () => {
  const drivers = [driver('no-activity'), driver('upcoming'), driver('recent-overdue'), driver('oldest-overdue')];
  const activities = [
    activity('recent-overdue', '2026-07-20'),
    activity('oldest-overdue', '2026-07-01'),
    activity('oldest-overdue', '2026-07-30'),
    activity('upcoming', '2026-07-24'),
  ];

  assert.deepEqual(
    sortDriversByCriticalActivityPriority(drivers, activities, NOW).map(({ id }) => id),
    ['oldest-overdue', 'recent-overdue', 'upcoming', 'no-activity']
  );
});

test('uses the nearest due date when no linked critical activities are overdue', () => {
  const drivers = [driver('later'), driver('none'), driver('nearest'), driver('same-day')];
  const activities = [
    activity('later', '2026-08-20'),
    activity('nearest', '2026-07-24'),
    activity('same-day', '2026-07-23'),
  ];

  assert.deepEqual(
    sortDriversByCriticalActivityPriority(drivers, activities, NOW).map(({ id }) => id),
    ['same-day', 'nearest', 'later', 'none']
  );
});

test('keeps stable order for ties, undated activities, and drivers without qualifying activities', () => {
  const drivers = [
    driver('same-date-a'),
    driver('undated-a'),
    driver('none-a'),
    driver('same-date-b'),
    driver('undated-b'),
    driver('none-b'),
  ];
  const activities = [
    activity('same-date-a', '2026-07-25'),
    activity('undated-a', null),
    activity('same-date-b', '2026-07-25'),
    activity('undated-b', null),
  ];

  assert.deepEqual(
    sortDriversByCriticalActivityPriority(drivers, activities, NOW).map(({ id }) => id),
    ['same-date-a', 'same-date-b', 'undated-a', 'undated-b', 'none-a', 'none-b']
  );
});

test('ignores completed, archived, and deactivated linked activities', () => {
  const drivers = [
    driver('eligible'),
    driver('complete'),
    driver('completed'),
    driver('closed'),
    driver('archived'),
    driver('deactivated'),
  ];
  const activities = [
    activity('eligible', '2026-07-24'),
    activity('complete', '2026-06-01', { status: 'Complete' }),
    activity('completed', '2026-05-20', { status: 'Completed' }),
    activity('closed', '2026-05-10', { status: 'Closed' }),
    activity('archived', '2026-05-01', { isArchived: true }),
    activity('deactivated', '2026-04-01', { isDeactivated: true }),
  ];

  assert.deepEqual(
    sortDriversByCriticalActivityPriority(drivers, activities, NOW).map(({ id }) => id),
    ['eligible', 'complete', 'completed', 'closed', 'archived', 'deactivated']
  );
});

test('matches Salesforce 15-character and 18-character linked record IDs', () => {
  const shortId = 'a0B123456789XYZ';
  const drivers = [driver('unlinked'), driver(shortId)];
  const activities = [activity(`${shortId}ABC`, '2026-07-24')];

  assert.deepEqual(
    sortDriversByCriticalActivityPriority(drivers, activities, NOW).map(({ id }) => id),
    [shortId, 'unlinked']
  );
});

test('applies the same critical-activity priority behavior to barriers', () => {
  const barriers = [driver('barrier-without-activity'), driver('barrier-upcoming'), driver('barrier-overdue')];
  const activities = [
    activity('barrier-upcoming', '2026-07-24'),
    activity('barrier-overdue', '2026-07-01'),
  ];

  assert.deepEqual(
    sortRecordsByCriticalActivityPriority(barriers, activities, NOW).map(({ id }) => id),
    ['barrier-overdue', 'barrier-upcoming', 'barrier-without-activity']
  );
});

test('wires critical-activity priority sorting into both Barriers and Drivers lists', () => {
  const source = fs.readFileSync(
    new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url),
    'utf8'
  );
  const sortCalls = source.match(/sortRecordsByCriticalActivityPriority\(rows, activities\)/g) || [];

  assert.equal(sortCalls.length, 2);
  assert.match(source, /sortActivitiesByCriticality\([\s\S]*?activities\.filter\(/);
});
