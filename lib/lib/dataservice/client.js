// Veeva MyInsights runtime bridge.
//
// `window.Q` and `window.ds` are loaded as <script> tags in index.html
// from public/static/. When this module first imports, we grab those
// globals once and freeze them as module-level constants.
//
// In dev (vite dev server) we ALWAYS use mockAdapter. In production we never
// fall back to mock data: the deployable MyInsights ZIP must use Veeva's
// runtime DataService so it shows actual CRM records.

import { mockAdapter } from '@/lib/mockData/mockAdapter';

const isDev = !!(
  import.meta &&
  import.meta.env &&
  (import.meta.env.DEV || import.meta.env.MODE === 'mock')
);
const runtimeDs = typeof window !== 'undefined' ? window.ds : null;
const hasVeeva = !isDev && !!runtimeDs;

const missingRuntime = (method) => () =>
  Promise.reject(
    new Error(
      `Veeva DataService runtime unavailable: ${method} requires window.ds. ` +
        'Deploy this ZIP inside Veeva CRM MyInsights to load actual data.'
    )
  );

const missingRuntimeAdapter = {
  runQuery: missingRuntime('runQuery'),
  queryRecord: missingRuntime('queryRecord'),
  getDataForCurrentObject: missingRuntime('getDataForCurrentObject'),
  getPicklistValueLabels: missingRuntime('getPicklistValueLabels'),
  getObjectMetadata: missingRuntime('getObjectMetadata'),
  viewRecord: missingRuntime('viewRecord'),
  createRecord: missingRuntime('createRecord'),
  updateRecord: missingRuntime('updateRecord'),
  deleteRecord: missingRuntime('deleteRecord'),
};

export const $q = (typeof window !== 'undefined' && window.Q) || null;
export const ds = isDev ? mockAdapter : (runtimeDs || missingRuntimeAdapter);

export const isVeevaRuntime = hasVeeva;
export const isMockRuntime = isDev;

// True when running inside Veeva CRM's online hosted CDN (cdnhtml.salesforce.com).
// The offline iPad container hosts MyInsights from a local path, and a few
// VQL syntax differences (e.g. `{'a','b'}` vs `('a','b')`) hinge on this check.
// Mirrors `isOnline` in site_crm_v1/src/lib/helper/utils.js.
export const isOnline = () => {
  if (typeof window === 'undefined') return false;
  return /cdnhtml/i.test(window.location.hostname);
};
