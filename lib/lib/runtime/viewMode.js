export const MOBILE_VIEW_MAX_WIDTH = 720;
export const IPAD_VIEW_MAX_WIDTH = 1400;

const getWindowLike = (env) => env || (typeof window !== 'undefined' ? window : null);

const mediaMatches = (win, query) => {
  if (!win || typeof win.matchMedia !== 'function') return false;
  try {
    return Boolean(win.matchMedia(query).matches);
  } catch {
    return false;
  }
};

const viewportNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

const isLikelyIPad = ({ userAgent, platform, maxTouchPoints }) => {
  const ua = String(userAgent || '');
  const devicePlatform = String(platform || '');
  if (/iPad/i.test(ua) || /iPad/i.test(devicePlatform)) return true;

  // iPadOS can present a desktop Safari/Mac platform in embedded web views.
  return /MacIntel|Macintosh|MacPPC|Mac68K/i.test(devicePlatform) && maxTouchPoints > 1;
};

const layoutModeForWidth = (width) => {
  if (!width) return 'unknown';
  if (width <= MOBILE_VIEW_MAX_WIDTH) return 'mobile';
  if (width <= IPAD_VIEW_MAX_WIDTH) return 'tablet';
  return 'desktop';
};

const isHostedWebLocation = (location) => {
  const protocol = String(location?.protocol || '').toLowerCase();
  return protocol === 'http:' || protocol === 'https:';
};

export const detectRuntimeViewMode = (env) => {
  const win = getWindowLike(env);
  const nav = win?.navigator || {};
  const location = win?.location || {};
  const width = viewportNumber(win?.innerWidth);
  const height = viewportNumber(win?.innerHeight);
  const userAgent = nav.userAgent || '';
  const platform = nav.platform || '';
  const maxTouchPoints = Number(nav.maxTouchPoints) || 0;
  const coarsePointer = mediaMatches(win, '(pointer: coarse)');
  const finePointer = mediaMatches(win, '(hover: hover) and (pointer: fine)');
  const isTouchCapable = maxTouchPoints > 0 || coarsePointer;
  const isLikelyIPadDevice = isLikelyIPad({ userAgent, platform, maxTouchPoints });
  const layoutMode = layoutModeForWidth(width);
  const isTabletLayout = layoutMode === 'tablet';
  const isHostedWebLink = isHostedWebLocation(location);
  const viewMode = isLikelyIPadDevice
    ? 'ipad'
    : layoutMode === 'mobile'
      ? 'mobile'
      : !isHostedWebLink && isTabletLayout
        ? 'ipad'
        : 'desktop';
  const reason = isLikelyIPadDevice
    ? 'iPad device signal'
    : (isHostedWebLink && isTabletLayout ? 'hosted web link' : (isTabletLayout ? 'tablet breakpoint' : `${layoutMode} breakpoint`));

  return {
    viewMode,
    layoutMode,
    reason,
    width,
    height,
    isLikelyIPadDevice,
    isTouchCapable,
    hasFinePointer: finePointer,
    coarsePointer,
    isHostedWebLink,
    protocol: location.protocol || '',
    hostname: location.hostname || '',
    userAgent,
    platform,
    maxTouchPoints,
  };
};

const viewModeLabel = (value) => {
  if (value === 'ipad') return 'iPad';
  if (value === 'mobile') return 'Mobile';
  if (value === 'desktop') return 'Desktop';
  return 'Unknown';
};

export const runtimeViewModeSummary = (snapshot) => {
  const mode = viewModeLabel(snapshot?.viewMode);
  const width = snapshot?.width || 0;
  const height = snapshot?.height || 0;
  const touch = snapshot?.isTouchCapable ? 'yes' : 'no';
  const pointer = snapshot?.hasFinePointer ? 'fine' : (snapshot?.coarsePointer ? 'coarse' : 'unknown');
  const device = snapshot?.isLikelyIPadDevice ? 'likely iPad' : 'not iPad';
  const reason = snapshot?.reason || 'unknown';

  return `Detected ${mode} view (${reason}) | viewport: ${width}x${height} | touch: ${touch} | pointer: ${pointer} | device: ${device}`;
};
