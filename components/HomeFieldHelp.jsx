import { FieldHelpButton } from '@/components/EditModalField';

export const HOME_FIELD_HELP = {
  lastMpdApprovalDate:
    'Displays the most recent MPD review date, unless the account plan is currently submitted for approval.',
  atcCohort:
    'Classifies the account based on cohort grouping to support segmentation and benchmarking.',
  atcSegment:
    'Shows the account segment used for planning and comparison across similar sites.',
  kltSprintAccount:
    'Indicates whether this account is part of a focused KLT sprint initiative.',
  customerGoals:
    'Capture the customer\'s primary goal for their CAR-T program as a clear, one-line statement reflecting the current focus or priority.',
  barriers:
    'Highlights key challenges currently impacting account performance or CAR-T adoption.',
  drivers:
    'Highlights key factors supporting account performance or CAR-T adoption.',
  kiteStrategy:
    'Auto-populated from selected barrier/driver strategies and reflects Kite\'s overall approach to the account.',
  criticalActivities:
    'Shows overdue and near-term critical activities that need attention within the next 30 days.',
  teamMembers:
    'Lists internal team members attached to the account plan and their participation role.',
};

export default function HomeFieldHelp({ helpKey, label, className = '' }) {
  const text = HOME_FIELD_HELP[helpKey];
  if (!text) return null;

  return (
    <FieldHelpButton
      className={`home-field-help ${className}`.trim()}
      label={`${label || 'Home field'} guidance`}
      text={text}
    />
  );
}
