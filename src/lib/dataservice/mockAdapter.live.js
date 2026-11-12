// Production builds must never show Salesforce-shaped mock fixture data.
// This module is aliased in vite.config.js only for `vite build`; local
// `vite dev` still imports src/lib/mockData/mockAdapter.js.
export const mockAdapter = null;
