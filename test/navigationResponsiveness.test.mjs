import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebarSource = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const loadingScreenSource = await readFile(new URL('../src/components/LoadingScreen.jsx', import.meta.url), 'utf8');
const overviewSource = await readFile(new URL('../src/pages/Overview/index.jsx', import.meta.url), 'utf8');
const teamMembersSource = await readFile(new URL('../src/pages/TeamMembers/index.jsx', import.meta.url), 'utf8');
const mainCss = await readFile(new URL('../src/styles/main.css', import.meta.url), 'utf8');

test('App starts only Stakeholders and Team Members CRM loaders while Home is still loading', () => {
  assert.match(appSource, /const NAVIGATION_PRELOAD_DELAY_MS = \d+;/);
  assert.match(appSource, /const STARTUP_PRELOAD_DELAY_MS = \d+;/);
  assert.match(
    appSource,
    /const STARTUP_PRELOAD_PAGE_KEYS = \[\s*'stakeholders',\s*'team-members',\s*\];/
  );
  assert.match(appSource, /const pageLoadPromisesRef = useRef\(new Map\(\)\)/);
  assert.match(appSource, /const loadPage = useCallback\(/);
  assert.match(appSource, /const pageDataKey = \(key\) => PAGE_BY_KEY\[key\]\?\.dataKey \|\| key/);
  assert.match(appSource, /STARTUP_PRELOAD_PAGE_KEYS\.forEach\(\(key\) =>/);
  assert.match(appSource, /loadPage\(page\.key, \{ background: true \}\)/);
  const startupList = appSource.match(/const STARTUP_PRELOAD_PAGE_KEYS = \[[\s\S]*?\];/)?.[0] || '';
  assert.doesNotMatch(startupList, /barriers-drivers|critical-activities|linked-opportunities/);
});

test('App warms remaining implemented page loaders in the background after Home is ready', () => {
  assert.match(appSource, /await Promise\.all\(preloadTargets\.map\(\(page\) =>/);
  assert.match(appSource, /pageStatus\.overview !== 'ready'/);
});

test('Sidebar starts page preload on pointer down before committing navigation', () => {
  assert.match(sidebarSource, /onPreloadPage/);
  assert.match(sidebarSource, /onPreloadPage\?\.\(page\.key\)/);
  assert.match(appSource, /onPreloadPage=\{\(key\) => loadPage\(key, \{ background: true \}\)\}/);
});

test('Sidebar shell card can use any cached page data while the active page is loading', () => {
  assert.match(appSource, /const hasShellContext = \(data\) => Boolean\(/);
  assert.match(appSource, /const resolveShellSource = \(cachedPageData, activeData\) =>/);
  assert.match(appSource, /cachedPageData\.overview \|\| activeData/);
  assert.match(appSource, /Object\.values\(cachedPageData \|\| \{\}\)\.find\(hasShellContext\)/);
  assert.match(appSource, /const shellSource = resolveShellSource\(pageData,\s*activeData\)/);
});

test('App refreshes already-loaded pages in the background when revisited', () => {
  assert.match(appSource, /const hasInFlightActivePage = pageLoadPromisesRef\.current\.has\(activeDataKey\)/);
  assert.match(appSource, /const hasCachedActivePage = loadedRef\.current\.has\(activeDataKey\)/);
  assert.match(
    appSource,
    /background:\s*hasCachedActivePage \|\| hasInFlightActivePage/
  );
  assert.match(
    appSource,
    /force:\s*hasCachedActivePage/
  );
});

test('team member saves sync Home and Team Members page caches immediately', () => {
  assert.match(appSource, /const TEAM_MEMBER_CACHE_FIELDS = \{/);
  assert.match(appSource, /overview:\s*'teamMembers'/);
  assert.match(appSource, /'team-members':\s*'teamMembers'/);
  assert.match(appSource, /const syncTeamMemberAcrossCaches = \(member\) =>/);
  assert.match(appSource, /sortTeamMembersByParticipation\(/);
  assert.match(appSource, /<Overview[\s\S]*onMemberChange=\{syncTeamMemberAcrossCaches\}/);
  assert.match(appSource, /<TeamMembers[\s\S]*onMemberChange=\{syncTeamMemberAcrossCaches\}/);
  assert.match(overviewSource, /onMemberChange/);
  assert.match(teamMembersSource, /onMemberChange/);
});

test('background export preparation is deferred until after navigation work settles', () => {
  assert.match(appSource, /const EXPORT_PREPARE_IDLE_DELAY_MS = \d+;/);
  assert.match(appSource, /window\.setTimeout\(/);
  assert.match(appSource, /requestIdleCallback/);
  assert.match(appSource, /setPptPrepareStatus\('idle'\)/);
  assert.match(appSource, /setPdfPrepareStatus\('idle'\)/);
});

test('loading screen uses a full-page branded state with one primary animation', () => {
  assert.match(loadingScreenSource, /role="status"/);
  assert.doesNotMatch(appSource, /FORCE_LOADING_SCREEN_PREVIEW/);
  assert.doesNotMatch(appSource, /activeRenderStatus/);
  assert.match(appSource, /const shouldShowAccountPlanLauncher = isDesktopView && !isDesktopPlanSelected/);
  assert.match(appSource, /const shouldLoadAccountPlanPages = !shouldShowAccountPlanLauncher/);
  assert.match(appSource, /<LoadingScreen label=\{activeLoadingLabel\} \/>/);
  assert.match(loadingScreenSource, /LOADING_SCREEN_VARIANT = 'kite-minimal'/);
  assert.match(loadingScreenSource, /export function LegacyLoadingScreen/);
  assert.match(loadingScreenSource, /export function KiteLogoLoadingScreen/);
  assert.match(loadingScreenSource, /export function KiteMinimalLoadingScreen/);
  assert.match(loadingScreenSource, /kiteLogoPngUrl/);
  assert.match(loadingScreenSource, /className="loading-state loading-state-minimal"/);
  assert.match(loadingScreenSource, /className="kite-minimal-logo"/);
  assert.match(loadingScreenSource, /className="kite-minimal-progress"/);
  assert.match(mainCss, /\.loading-state-card/);
  assert.match(mainCss, /\.loading-brand-mark/);
  assert.match(mainCss, /\.loading-status-row/);
  assert.match(mainCss, /\.kite-minimal-loader/);
  assert.match(mainCss, /\.kite-minimal-logo/);
  assert.match(mainCss, /\.loading-state\s*\{[\s\S]*?min-height:\s*calc\(100vh - 32px\)/);
  assert.match(mainCss, /\.loading-state\s*\{[\s\S]*?border:\s*1px solid/);
  assert.doesNotMatch(appSource, /loading-skeleton/);
  assert.doesNotMatch(mainCss, /loading-skeleton/);
  assert.doesNotMatch(appSource, /loading-progress-track/);
  assert.doesNotMatch(mainCss, /loading-progress-track/);
  assert.match(mainCss, /@keyframes kite-minimal-progress-sweep/);
});

test('App shows a guided empty state when no account plan context is available', () => {
  assert.match(appSource, /const isMissingAccountPlanContextError = \(error\) =>/);
  assert.match(appSource, /account-plan-context-empty/);
  assert.match(appSource, /We couldn't find the selected Account Plan\./);
  assert.match(appSource, /Go back to Account Plans and open the plan again\. If the page still does not load, refresh this tab\./);
  assert.doesNotMatch(appSource, /Account Plan context is needed to load this page\./);
  assert.match(appSource, /activeStatus === 'error' && !isMissingAccountPlanContextError\(activeError\)/);
  assert.match(mainCss, /\.account-plan-context-empty\s*\{/);
  assert.match(mainCss, /\.account-plan-context-empty[\s\S]*?border-left:[^;]*var\(--danger\)/);
  assert.match(mainCss, /\.account-plan-context-empty[\s\S]*?background:\s*var\(--danger-soft\)/);
  assert.match(mainCss, /\.account-plan-context-empty strong[\s\S]*?color:\s*var\(--danger\)/);
});
