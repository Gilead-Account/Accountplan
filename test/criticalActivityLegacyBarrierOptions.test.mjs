import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const linkedOptionsPath = new URL(
  '../src/pages/CriticalActivities/linkedBarrierDriverOptions.js',
  import.meta.url
);
const sharedPath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const editModalPath = new URL(
  '../src/pages/CriticalActivities/CriticalActivityEditModal.jsx',
  import.meta.url
);
const overviewPath = new URL('../src/pages/Overview/index.jsx', import.meta.url);
const criticalActivitiesPagePath = new URL(
  '../src/pages/CriticalActivities/index.jsx',
  import.meta.url
);
const barriersDriversPagePath = new URL(
  '../src/pages/BarriersDrivers/index.jsx',
  import.meta.url
);
const barriersDriversCssPath = new URL(
  '../src/pages/BarriersDrivers/BarriersDrivers.css',
  import.meta.url
);

const dataModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadLinkedOptions = async () => {
  const source = await readFile(linkedOptionsPath, 'utf8');
  return import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
};

test('critical activities offer every open barrier and driver without a created-date filter', async () => {
  const mod = await loadLinkedOptions();
  const options = [
    { id: 'barrier-open', type: 'Barrier', name: 'DLBCL barrier', status: 'Open' },
    { id: 'driver-open', type: 'Driver', name: 'MM driver', status: 'Open' },
  ];

  assert.deepEqual(
    mod.linkedBarrierDriverSelectOptions(options).map((option) => option.id),
    ['barrier-open', 'driver-open']
  );
});

test('missing linked barriers and drivers are recovered from critical activity data', async () => {
  const mod = await loadLinkedOptions();
  const options = [
    { id: 'driver-open', type: 'Driver', name: 'MM driver', status: 'Open' },
  ];
  const activities = [
    {
      barrierDriverId: 'barrier-from-activity',
      parentType: 'Barrier',
      parentName: 'Access restriction',
      indication: 'DLBCL',
    },
    {
      barrierDriverId: 'driver-from-activity',
      parentType: 'Driver',
      parentName: 'ATC Onboarding',
      indication: 'MM',
    },
  ];

  const merged = mod.mergeBarrierDriverOptionsWithActivityParents(options, activities);

  assert.deepEqual(
    mod.linkedBarrierDriverSelectOptions(merged, 'driver-from-activity').map((option) => ({
      id: option.id,
      type: option.type,
      name: option.name,
    })),
    [
      { id: 'driver-open', type: 'Driver', name: 'MM driver' },
      { id: 'barrier-from-activity', type: 'Barrier', name: 'Access restriction' },
      { id: 'driver-from-activity', type: 'Driver', name: 'ATC Onboarding' },
    ]
  );

  assert.equal(
    mod.optionForId(merged, 'barrier-from-activity')?.name,
    'Access restriction'
  );
});

test('current parent matching accepts Salesforce 15 and 18 character forms', async () => {
  const mod = await loadLinkedOptions();
  const currentDriver = {
    id: 'a2B000000000001AAA',
    type: 'Driver',
    name: 'Existing MM driver',
    status: 'Closed',
  };
  const currentParentId = 'a2B000000000001';
  const options = [
    { id: 'a2B000000000002AAA', type: 'Barrier', name: 'Barrier', status: 'Open' },
    currentDriver,
    { id: 'a2B000000000003AAA', type: 'Driver', name: 'Other Driver', status: 'Open' },
  ];
  const allowedOptions = mod.linkedBarrierDriverSelectOptions(options, currentParentId);

  assert.deepEqual(allowedOptions.map((option) => option.id), [
    'a2B000000000001AAA',
    'a2B000000000002AAA',
    'a2B000000000003AAA',
  ]);
  assert.equal(mod.optionForId(options, currentParentId), currentDriver);
});

test('a closed parent remains available only as the current selection', async () => {
  const mod = await loadLinkedOptions();
  const currentClosed = { id: 'driver-current', type: 'Driver', status: 'Closed' };
  const otherClosed = { id: 'driver-other', type: 'Driver', status: 'Closed' };
  const openBarrier = { id: 'barrier-open', type: 'Barrier', status: 'Open' };

  assert.deepEqual(
    mod
      .linkedBarrierDriverSelectOptions(
        [currentClosed, otherClosed, openBarrier],
        currentClosed.id
      )
      .map((option) => option.id),
    ['driver-current', 'barrier-open']
  );
});

test('critical activity modal uses all parent options and preserves unchanged parent links', async () => {
  const sharedSource = await readFile(sharedPath, 'utf8');
  const modalSource = await readFile(editModalPath, 'utf8');
  const overviewSource = await readFile(overviewPath, 'utf8');
  const criticalActivitiesPageSource = await readFile(criticalActivitiesPagePath, 'utf8');
  const barriersDriversPageSource = await readFile(barriersDriversPagePath, 'utf8');
  const barriersDriversCssSource = await readFile(barriersDriversCssPath, 'utf8');

  assert.match(
    sharedSource,
    /export const ACTIVITY_BASE_FIELDS = \[[\s\S]*?'CreatedDate'/
  );
  assert.match(sharedSource, /createdDate:\s*r\.CreatedDate \|\| null/);
  assert.match(modalSource, /\(\) => barrierDriverOptions \|\| \[\]/);
  assert.doesNotMatch(modalSource, /LEGACY_CRITICAL_ACTIVITY|isLegacyCurrentDriverSelection/);
  assert.match(
    modalSource,
    /linkedBarrierDriverSelectOptions\(allowedParentOptions,\s*form\.parentId\)/
  );
  assert.match(modalSource, /disabled=\{remainingFieldsDisabled \|\| \(!isEdit && !hasRelatedOptions\)\}/);
  assert.match(overviewSource, /const parentChanged =/);
  assert.match(overviewSource, /const payload = parentChanged/);
  assert.match(overviewSource, /saveCriticalActivity\(activity\.id, payload\)/);
  assert.doesNotMatch(overviewSource, /parentChanged[\s\S]{0,220}activity\.parentType/);
  assert.doesNotMatch(
    criticalActivitiesPageSource,
    /parentChanged[\s\S]{0,220}activity\.parentType/
  );
  assert.doesNotMatch(
    barriersDriversPageSource,
    /parentChanged[\s\S]{0,220}activityEditState\.activity\.parentType/
  );
  assert.match(barriersDriversCssSource, /@media \(min-width: 1401px\)/);
  assert.match(
    barriersDriversCssSource,
    /@media \(min-width: 1401px\)[\s\S]*?bd-filter-select-box[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
  );
});
