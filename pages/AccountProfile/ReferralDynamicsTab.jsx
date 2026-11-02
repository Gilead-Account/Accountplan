import { useMemo, useState } from 'react';
import { nextTableSort, stableSortRows } from '@/lib/helper/tableSort';
import TableSortButton from '@/components/TableSortButton';
import AccountProfileFieldHelp from '@/components/AccountProfileFieldHelp';

const referralIndicationDisplay = (indication) => {
  if (!indication) return '-';
  if (indication === 'Both') return 'DLBCL + MM';
  return indication;
};

const referralPriorityDisplay = (value) => (value ? 'True' : 'False');

const REFERRAL_TABLE_COLUMNS = [
  { key: 'name', label: 'Site Name' },
  { key: 'hcoClassification', label: 'HCO Classification' },
  { key: 'hcpTargetCount', label: 'HCP Targets' },
  { key: 'referralPriority', label: 'Referral Priority' },
  { key: 'indication', label: 'Indication' },
];

const NETWORK_TABLE_COLUMNS = [
  { key: 'accountName', label: 'Account Name' },
  { key: 'kiteAccountable', label: 'Kite Lead' },
];

const referralSortValue = (account, key) => {
  switch (key) {
    case 'name':
      return account.name || null;
    case 'hcoClassification':
      return account.hcoClassification || null;
    case 'hcpTargetCount':
      return Number(account.hcpTargetCount || 0);
    case 'referralPriority':
      return referralPriorityDisplay(account.referralPriority);
    case 'indication':
      return account.indication ? referralIndicationDisplay(account.indication) : null;
    default:
      return '';
  }
};

const networkSortValue = (network, key) => {
  switch (key) {
    case 'accountName':
      return network.accountName || null;
    case 'kiteAccountable':
      return network.kiteAccountable || null;
    default:
      return '';
  }
};

function EditPencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ReferralEditButton({ ariaLabel = 'Edit', onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="referral-edit-button"
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick?.();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      title="Edit"
    >
      <EditPencilIcon />
    </button>
  );
}

function ReferralMappingCard({ referralAccounts, sort, onSort, onAdd, onEdit, isReadOnly = false }) {
  const sortedRows = useMemo(
    () => stableSortRows(referralAccounts || [], sort, referralSortValue),
    [referralAccounts, sort]
  );

  return (
    <article className="mock-card profile-table-card referral-mapping-card">
      <div className="mock-section-head">
        <h3 className="account-profile-title-with-help referral-dynamics-title-with-help">
          <span>Referral Mapping</span>
          <AccountProfileFieldHelp helpKey="referralMapping" label="Referral Mapping" />
        </h3>
        <div className="button-row">
          <span className="chip chip-blue">{(referralAccounts || []).length || 0} sites</span>
          <button type="button" className="button primary-red" onClick={onAdd} disabled={isReadOnly}>
            Add
          </button>
        </div>
      </div>
      <div className="profile-table-list referral-table mock-data-table">
        <div className="profile-table-head">
          {REFERRAL_TABLE_COLUMNS.map((column) => (
            <span key={column.key}>
              <TableSortButton column={column} sort={sort} onSort={onSort} />
            </span>
          ))}
          <span className="profile-action-head" aria-hidden="true" />
        </div>
        {sortedRows.map((account) => (
          <div className="profile-table-row" key={account.id}>
            <span><strong>{account.name || 'Untitled'}</strong></span>
            <span>{account.hcoClassification || '-'}</span>
            <span>{account.hcpTargetCount || 0}</span>
            <span>{referralPriorityDisplay(account.referralPriority)}</span>
            <span>{referralIndicationDisplay(account.indication)}</span>
            <span className="profile-action-cell">
              <ReferralEditButton
                ariaLabel={`Edit ${account.name || 'referral mapping'}`}
                onClick={() => onEdit(account)}
                disabled={isReadOnly}
              />
            </span>
          </div>
        ))}
        {sortedRows.length === 0 && (
          <div className="empty-state small">No referral mapping rows available.</div>
        )}
      </div>
    </article>
  );
}

function RegionalDynamicsPanel({ indication, content, onEdit, isReadOnly = false }) {
  return (
    <article className="mock-card regional-dynamics-panel">
      <div className="mock-section-head">
        <h3 className="account-profile-title-with-help referral-dynamics-title-with-help">
          <span>{indication} Regional Dynamics to be aware of</span>
          <AccountProfileFieldHelp helpKey="dlbclRegionalDynamics" label={`${indication} Regional Dynamics`} />
        </h3>
        <button
          type="button"
          className="mock-icon-button text-button"
          onClick={() => onEdit(indication)}
          disabled={isReadOnly}
        >
          Edit
        </button>
      </div>
      <p className="profile-dynamics-copy">{content || '-'}</p>
    </article>
  );
}

function HealthcareNetworksCard({ rows, sort, onSort, onAdd, onEdit, isReadOnly = false }) {
  const sortedRows = useMemo(
    () => stableSortRows(rows || [], sort, networkSortValue),
    [rows, sort]
  );

  return (
    <article className="mock-card profile-table-card healthcare-network-card">
      <div className="mock-section-head">
        <h3 className="healthcare-network-title account-profile-title-with-help referral-dynamics-title-with-help">
          <span className="healthcare-network-title-main">Other Healthcare Networks</span>
          <span className="healthcare-network-title-sub">Region / Influence out of Region</span>
          <AccountProfileFieldHelp helpKey="healthcareNetworks" label="Other Healthcare Networks" />
        </h3>
        <div className="button-row">
          <button type="button" className="button primary-red healthcare-network-add-button" onClick={onAdd} disabled={isReadOnly}>
            Add
          </button>
        </div>
      </div>
      <div className="profile-table-list network-table mock-data-table">
        <div className="profile-table-head">
          {NETWORK_TABLE_COLUMNS.map((column) => (
            <span key={column.key}>
              <TableSortButton column={column} sort={sort} onSort={onSort} />
            </span>
          ))}
          <span className="profile-action-head" aria-hidden="true" />
        </div>
        {sortedRows.map((network) => (
          <div
            key={network.id}
            className="profile-table-row healthcare-network-open-row"
          >
            <span><strong>{network.accountName || '-'}</strong></span>
            <span>{network.kiteAccountable || '-'}</span>
            <span className="profile-action-cell">
              <ReferralEditButton
                ariaLabel={`Edit ${network.accountName || 'healthcare network'}`}
                onClick={() => onEdit(network)}
                disabled={isReadOnly}
              />
            </span>
          </div>
        ))}
        {sortedRows.length === 0 && (
          <div className="empty-state small">No healthcare network rows available.</div>
        )}
      </div>
    </article>
  );
}

export default function ReferralDynamicsTab({
  referralAccounts,
  healthcareNetworks,
  regionalDynamics,
  onEditReferral,
  onAddReferral,
  onEditHealthcareNetwork,
  onAddHealthcareNetwork,
  onEditRegionalDynamics,
  isReadOnly = false,
}) {
  const [referralSort, setReferralSort] = useState(null);
  const [networkSort, setNetworkSort] = useState({ key: 'accountName', direction: 'asc' });

  const handleReferralSort = (key) => setReferralSort((current) => nextTableSort(current, key));
  const handleNetworkSort = (key) => setNetworkSort((current) => nextTableSort(current, key));

  return (
    <div className="account-profile-workbook referral-dynamics-workbook">
      <div className="referral-dynamics-layout">
        <div className="referral-dynamics-main">
          <ReferralMappingCard
            referralAccounts={referralAccounts}
            sort={referralSort}
            onSort={handleReferralSort}
            onAdd={onAddReferral}
            onEdit={onEditReferral}
            isReadOnly={isReadOnly}
          />
        </div>
        <aside className="referral-dynamics-side">
          <RegionalDynamicsPanel
            indication="DLBCL"
            content={regionalDynamics?.DLBCL}
            onEdit={onEditRegionalDynamics}
            isReadOnly={isReadOnly}
          />
          <RegionalDynamicsPanel
            indication="MM"
            content={regionalDynamics?.MM}
            onEdit={onEditRegionalDynamics}
            isReadOnly={isReadOnly}
          />
          <HealthcareNetworksCard
            rows={healthcareNetworks}
            sort={networkSort}
            onSort={handleNetworkSort}
            onAdd={onAddHealthcareNetwork}
            onEdit={onEditHealthcareNetwork}
            isReadOnly={isReadOnly}
          />
        </aside>
      </div>
    </div>
  );
}
