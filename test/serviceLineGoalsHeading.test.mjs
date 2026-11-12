import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serviceLineGoalsSource = await readFile(
  new URL('../src/pages/Overview/ServiceLineGoals.jsx', import.meta.url),
  'utf8'
);
const serviceLineGoalsModalSource = await readFile(
  new URL('../src/pages/Overview/ServiceLineGoalsEditModal.jsx', import.meta.url),
  'utf8'
);

test('Home customer goals card and modal use the customer goals for CAR T service line heading', () => {
  assert.match(serviceLineGoalsSource, /const heading = 'Customer Goals for CAR T Service Line'/);
  assert.match(serviceLineGoalsSource, /<span>\{heading\}<\/span>/);
  assert.match(serviceLineGoalsSource, /label=\{heading\}/);
  assert.match(serviceLineGoalsSource, /No CAR T service line customer goals captured\./);
  assert.match(serviceLineGoalsModalSource, /const CUSTOMER_GOALS_HEADING = 'Customer Goals for CAR T Service Line'/);
  assert.match(serviceLineGoalsModalSource, /<h3>Edit \{CUSTOMER_GOALS_HEADING\}<\/h3>/);
  assert.match(serviceLineGoalsModalSource, /label=\{CUSTOMER_GOALS_HEADING\}/);
  assert.doesNotMatch(serviceLineGoalsSource, /CAR T Service Line Customer Goals/);
  assert.doesNotMatch(serviceLineGoalsSource, /CART Service Line|Customer Goals for CART/);
  assert.doesNotMatch(serviceLineGoalsModalSource, /Edit Service Line Customer Goals/);
});
