import './PreAuthStatusPhase.css';
export const TargetIcon=() => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <path d="M16 8L21 3" stroke="currentColor" strokeWidth="2" />
    <path d="M18 3H21V6" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const EvaluatingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M6 3H14L18 7V21H6V3Z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <path
      d="M14 3V7H18"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle
      cx="15"
      cy="15"
      r="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M17.5 17.5L20 20"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

export const OnboardingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 2V5M12 19V22M2 12H5M19 12H22
         M4.9 4.9L7 7M17 17L19.1 19.1
         M4.9 19.1L7 17M17 7L19.1 4.9"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

export const DryRunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle
      cx="9"
      cy="8"
      r="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle
      cx="17"
      cy="8"
      r="2.5"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M3 19C3 15.5 6 14 9 14C12 14 15 15.5 15 19"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M14 18C14 15.5 16 14.5 18 14.5C20 14.5 21.5 15.5 22 18"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);
export const AuthorizedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M6 2V22"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M6 3H18L15 8L18 13H6"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
  </svg>
);

const PHASES = [
  {
    label: 'Target / Interest',
    icon: <TargetIcon />
  },
  {
    label: 'Evaluating',
    icon: <EvaluatingIcon />
  },
  {
    label: 'Onboarding',
    icon: <OnboardingIcon />
  }
  // {
  //   label: 'Dry Run',
  //   icon: <DryRunIcon />
  // },
  // {
  //   label: 'Authorized',
  //   icon: <AuthorizedIcon />
  // }
];

export default function PreAuthStatusPhase({
  currentPhase = 'Target / Interest'
}) {
 const activeIndex = PHASES.findIndex(
    item => item.label === currentPhase
);

  return (
    <div className="preauth-container">
      <div className="preauth-header">
        <span>Pre-Authorization Status & Phase</span>
      </div>

      <div className="preauth-steps">
       {PHASES.map((phase, index) => (
        <div
            key={phase.label}
            className={`preauth-step ${
            index <= activeIndex ? 'active' : ''
            }`}
            >
            <div className="phase-content">
            {phase.icon}
            <span>{phase.label}</span>
            </div>
        </div>
        ))}
      </div>

      <div className="preauth-footer">
        Current Phase
      </div>
    </div>
  );
}