import { FieldHelpButton } from '@/components/EditModalField';

export const ACCOUNT_PROFILE_FIELD_HELP = {
  aallTarget:
    'Identifies whether the account is a priority target for aALL.',
  qVsQCartVolumeTrend:
    'Captures high- or low-level trends in CAR-T utilization and competitive positioning within the account.',
  atcCohort:
    'Classifies the account based on cohort grouping to support segmentation and benchmarking.',
  atcSegment:
    'Shows the account segment used for planning and comparison across similar sites.',
  kltSprint:
    'Indicates whether this account is part of a focused KLT sprint initiative.',
  topPayers:
    'Lists the top payers influencing access and reimbursement within the account.',
  payerType:
    'Indicates the dominant payer type, such as commercial, Medicare, or Medicaid.',
  payerMix:
    'Summarizes the distribution of payer types impacting the account patient population.',
  dlbclProfile:
    'Captures high-level responses reflecting key account characteristics, capabilities, and factors influencing CAR-T adoption and utilization.',
  referralMapping:
    'This section is pre-populated quarterly with current ATC ecosystem sites. Add additional affiliated or non-affiliated referring sites manually by editing the row.',
  dlbclRegionalDynamics:
    'Capture observations on broader market dynamics that may impact the ATC ecosystem, such as competitive shifts, payer changes, system expansions, or new information.',
  healthcareNetworks:
    'Identify key healthcare systems within the geography or influencing the ATC ecosystem, and note the corresponding CTAM or KAD aligned to each system.',
};

export default function AccountProfileFieldHelp({ helpKey, label, className = '' }) {
  const text = ACCOUNT_PROFILE_FIELD_HELP[helpKey];
  if (!text) return null;

  return (
    <FieldHelpButton
      className={`account-profile-field-help ${className}`.trim()}
      label={`${label || 'Account Profile field'} guidance`}
      text={text}
    />
  );
}
