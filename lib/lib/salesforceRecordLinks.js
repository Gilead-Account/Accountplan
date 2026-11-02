export const SALESFORCE_PRODUCTION_HOST = 'https://kitepharma.lightning.force.com';
export const SALESFORCE_SANDBOX_HOST =
  'https://kitepharma--kitefull.sandbox.lightning.force.com';

const runtimePageAddresses = () => {
  const addresses = [];

  if (typeof window !== 'undefined') {
    try {
      if (window.location?.href) addresses.push(window.location.href);
    } catch {
      // Cross-origin MyInsights frames can block direct location access.
    }

    try {
      const origins = window.location?.ancestorOrigins;
      if (origins) addresses.push(...Array.from(origins));
    } catch {
      // ancestorOrigins is browser-specific and may be unavailable.
    }

    try {
      if (window.top?.location?.href) addresses.push(window.top.location.href);
    } catch {
      // Expected when Salesforce owns the cross-origin top frame.
    }
  }

  if (typeof document !== 'undefined' && document.referrer) {
    addresses.push(document.referrer);
  }

  return addresses.join(' ');
};

export const isKiteFullSandboxUsername = (username) =>
  String(username || '').trim().toLowerCase().endsWith('kitefull');

export const salesforceRecordHostForPage = (
  pageAddress = runtimePageAddresses(),
  currentUsername = null
) => {
  const username = String(currentUsername || '').trim();
  const useSandbox = username
    ? isKiteFullSandboxUsername(username)
    : String(pageAddress || '').toLowerCase().includes('sandbox');

  return useSandbox ? SALESFORCE_SANDBOX_HOST : SALESFORCE_PRODUCTION_HOST;
};

export const salesforceRecordBaseUrl = (objectApiName, pageAddress, currentUsername) =>
  `${salesforceRecordHostForPage(pageAddress, currentUsername)}/lightning/r/${objectApiName}`;
