import {
  activityDueLabel,
  activityDueDetail,
  activityDueTone,
  activityParentName,
} from '@/lib/helper/utils';

import './PreAuthStatusPhase.css';
import { formatDate, formatDateLabel, } from '../../lib/helper/utils';
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

const PHASES = [
  {
    label: 'Target / Interest',
    icon: <TargetIcon />, 
    alias: ['target', 'interest', 'targetinterest']
  },
  {
    label: 'Evaluating',
    icon: <EvaluatingIcon />,
    alias: ['evaluating', 'evaluation']
  },
  {
    label: 'Onboarding',
    icon: <OnboardingIcon />,
    alias: ['onboarding', 'onboards']
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

 const normalizedPhase = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const findactiveIndex = (value) => {
  const key =normalizedPhase(value);
  if(!key) return -1;
  return PHASES.findIndex((p)=>normalizedPhase(p.label)==key || p.alias.includes(key));
};

export default function PreAuthStatusPhase({ currentPhase, dryRunDate }){
  console.log('PreAuthStatusPhase dryRunDate:', dryRunDate);
  const activeIndex = findactiveIndex(currentPhase);
  const currentLabel = activeIndex >= 0? PHASES[activeIndex].label:null;
 
//const formattedDryRunDate = formatDryRunDate(dryRunDate);

  return (
    <div className="preauth-container">
      <div className="preauth-header">
        <span>Pre-Authorization Status & Phase</span>
        <span className="dryrun-date">
          Dry Run Date : {formatDateLabel(dryRunDate)}
        </span>
      </div>

      <div className="preauth-steps">
        {PHASES.map((phase, index) => (
          <div
            key={phase.label}
            className={`preauth-step ${index <= activeIndex ? 'active' : ''} 
            ${index === activeIndex? 'current' : ''}`} aria-current = {index===activeIndex ?'step':undefined}>
            <div className="phase-content">
              {phase.icon}
              <span>{phase.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="preauth-footer">
        Current Phase  {currentLabel ? `:${currentLabel}`:''}
      </div>
    </div>
  );
}