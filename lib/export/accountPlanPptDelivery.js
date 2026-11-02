const truthy = (value) => (value ? 'yes' : 'no');

const safeNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getPptDeliveryEnvironment = ({
  nav = typeof navigator !== 'undefined' ? navigator : undefined,
  win = typeof window !== 'undefined' ? window : undefined,
  doc = typeof document !== 'undefined' ? document : undefined,
  anchorPrototype = typeof HTMLAnchorElement !== 'undefined' ? HTMLAnchorElement.prototype : undefined,
  file,
} = {}) => {
  const userAgent = nav?.userAgent || '';
  const platform = nav?.platform || '';
  const maxTouchPoints = safeNumber(nav?.maxTouchPoints);
  const hasFileCtor = typeof File !== 'undefined';
  const hasShare = typeof nav?.share === 'function';
  const hasCanShare = typeof nav?.canShare === 'function';
  const hasAnchorDownload = !!anchorPrototype && 'download' in anchorPrototype;
  const isAppleTouch =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1) ||
    (/AppleWebKit/i.test(userAgent) && maxTouchPoints > 1 && !/Android/i.test(userAgent));
  let canShareFiles = false;

  if (hasCanShare && file) {
    try {
      canShareFiles = nav.canShare({ files: [file] });
    } catch {
      canShareFiles = false;
    }
  }

  return {
    userAgent,
    platform,
    maxTouchPoints,
    isAppleTouch,
    hasDocument: !!doc,
    hasWindow: !!win,
    isSecureContext: !!win?.isSecureContext,
    protocol: win?.location?.protocol || 'unknown',
    hasFileCtor,
    hasShare,
    hasCanShare,
    canShareFiles,
    hasAnchorDownload,
  };
};

export const formatPptDeliveryDiagnostic = (env, error) => {
  const lines = [
    `Browser: ${env.userAgent || 'unknown'}`,
    `Platform: ${env.platform || 'unknown'} / touch=${env.maxTouchPoints}`,
    `Protocol: ${env.protocol} / secure=${truthy(env.isSecureContext)}`,
    `Apple touch/WebView: ${truthy(env.isAppleTouch)}`,
    `File API: ${truthy(env.hasFileCtor)}`,
    `Web Share: share=${truthy(env.hasShare)}, canShare=${truthy(env.hasCanShare)}, canShareFiles=${truthy(env.canShareFiles)}`,
    `Anchor download: ${truthy(env.hasAnchorDownload)}`,
  ];

  if (error) {
    lines.push(`Error: ${error.name || 'Error'}: ${error.message || String(error)}`);
  }

  return lines.join('\n');
};

export const shouldOfferManualPptOpen = (env, shareError = null) =>
  !!shareError || env.isAppleTouch || !env.hasAnchorDownload;

export const shouldBypassWebShare = (env) =>
  !!env.isAppleTouch && env.protocol === 'file:';

export const shouldTryWebShare = (env, { directShare = false } = {}) =>
  !!env.isAppleTouch &&
  !!env.hasShare &&
  !!env.canShareFiles &&
  (directShare || !shouldBypassWebShare(env));

export const shouldUsePreOpenedPptWindow = (env) =>
  !!env.isAppleTouch && env.protocol !== 'file:';
