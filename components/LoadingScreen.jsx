import kiteLogoPngUrl from '@/lib/export/templates/cover/kiteLogo.png?url';

const LOADING_SCREEN_VARIANT = 'kite-minimal';

export function LegacyLoadingScreen({ label }) {
  return (
    <div
      className="loading-state"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label} data`}
    >
      <div className="loading-state-card">
        <div className="loading-brand-mark" aria-hidden="true">
          <span className="loading-brand-ring" />
          <span className="loading-brand-tile loading-brand-tile-top" />
          <span className="loading-brand-tile loading-brand-tile-right" />
          <span className="loading-brand-tile loading-brand-tile-bottom" />
          <span className="loading-brand-tile loading-brand-tile-left" />
          <strong>AP</strong>
        </div>
        <div className="loading-state-copy">
          <span className="loading-kicker">Account plan workspace</span>
          <h2>Preparing {label}</h2>
          <p>Loading account plan data...</p>
        </div>
        <div className="loading-status-row" aria-hidden="true">
          <span>Profile</span>
          <span>Activities</span>
          <span>Team</span>
        </div>
      </div>
    </div>
  );
}

export function KiteLogoLoadingScreen({ label }) {
  return (
    <div
      className="loading-state loading-state-logo"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label} data`}
    >
      <div className="kite-loader-shell">
        <div className="kite-loader-mark" aria-hidden="true">
          <span className="kite-loader-outline" />
          <span className="kite-loader-flight-path" />
          <span className="kite-loader-red-accent" />
          <img className="kite-loader-logo" src={kiteLogoPngUrl} alt="" />
        </div>
        <div className="kite-loader-copy">
          <span>Account plan workspace</span>
          <h2>Preparing {label}</h2>
          <p>Loading account plan data...</p>
        </div>
      </div>
    </div>
  );
}

export function KiteMinimalLoadingScreen({ label }) {
  return (
    <div
      className="loading-state loading-state-minimal"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label} data`}
    >
      <div className="kite-minimal-loader">
        <img className="kite-minimal-logo" src={kiteLogoPngUrl} alt="" />
        <div className="kite-minimal-progress" aria-hidden="true">
          <span />
        </div>
        <div className="kite-minimal-copy">
          <h2>Preparing {label}</h2>
          <p>Loading account plan data...</p>
        </div>
      </div>
    </div>
  );
}

export default function LoadingScreen({ label }) {
  if (LOADING_SCREEN_VARIANT === 'legacy') {
    return <LegacyLoadingScreen label={label} />;
  }
  if (LOADING_SCREEN_VARIANT === 'kite-logo') {
    return <KiteLogoLoadingScreen label={label} />;
  }
  return <KiteMinimalLoadingScreen label={label} />;
}
