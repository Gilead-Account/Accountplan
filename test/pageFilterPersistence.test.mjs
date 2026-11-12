import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const appSource = await readSource('../src/App.jsx');
const filterStateSource = await readSource('../src/lib/ui/pageFilterState.jsx');
const barriersDriversSource = await readSource('../src/pages/BarriersDrivers/index.jsx');
const criticalActivitiesSource = await readSource('../src/pages/CriticalActivities/index.jsx');
const stakeholdersSource = await readSource('../src/pages/Stakeholders/index.jsx');
const teamMembersSource = await readSource('../src/pages/TeamMembers/index.jsx');
const accountInsightsSource = await readSource('../src/pages/AccountProfile/AccountInsightsTab.jsx');

test('App owns in-memory filter state and clears it during report refreshes', () => {
  assert.match(appSource, /<PageFilterStateProvider>/);
  assert.match(appSource, /const resetPageFilterState = useResetPageFilterState\(\)/);
  assert.match(
    appSource,
    /const refreshLoadedPages = [\s\S]*?=> \{\s*resetPageFilterState\(\);/
  );
  assert.match(appSource, /const resetAccountPlanWorkspace = \(\) => \{[\s\S]*?resetPageFilterState\(\);/);
  assert.doesNotMatch(filterStateSource, /localStorage|sessionStorage/);
});

test('all filter-bearing pages use navigation-persistent page filter state', () => {
  assert.match(barriersDriversSource, /usePageFilterState\('barriers-drivers', DEFAULT_FILTERS\)/);
  assert.match(criticalActivitiesSource, /usePageFilterState\('critical-activities', DEFAULT_FILTERS\)/);
  assert.match(
    criticalActivitiesSource,
    /usePageFilterState\('critical-activities-kpi', 'all'\)/
  );
  assert.match(stakeholdersSource, /usePageFilterState\('stakeholders', DEFAULT_FILTERS\)/);
  assert.match(teamMembersSource, /usePageFilterState\('team-members', TEAM_MEMBER_FILTER_DEFAULTS\)/);
  assert.match(accountInsightsSource, /usePageFilterState\('account-insights', INSIGHT_FILTER_DEFAULTS\)/);
});

test('page filter state supports value and functional updates without browser persistence', () => {
  assert.match(filterStateSource, /export function PageFilterStateProvider/);
  assert.match(filterStateSource, /export function usePageFilterState/);
  assert.match(filterStateSource, /typeof nextValue === 'function'/);
  assert.match(filterStateSource, /setFilterState\(\{\}\)/);
  assert.doesNotMatch(filterStateSource, /localStorage|sessionStorage/);
});
