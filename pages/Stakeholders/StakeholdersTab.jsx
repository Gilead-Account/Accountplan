import { useMemo, useState } from 'react';
import TableSortButton from '@/components/TableSortButton';
import {
  dlbclInfluenceTriplet,
  mmInfluenceTriplet,
  displayValue,
  stakeholderRoleOptions,
  stakeholderMatchesFilters,
  stakeholderHighInfluenceCount,
} from '@/lib/helper/utils';
import { nextTableSort, stableSortRows } from '@/lib/helper/tableSort';

const NON_TARGET_PRIORITY_OPTION = 'Non-Target';

// Target priority values can carry trailing text (e.g. "P1 - High Priority
// Target"). Show only the leading "P#" code; non-target / blank values show "-".
const priorityCode = (value) => {
  const match = String(value || '').trim().match(/^P\s*\d+/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : '-';
};

const STAKEHOLDER_TABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'dlbclPriority', label: 'Target Priority', help: '(DLBCL / MM)' },
  { key: 'dlbclInfluence', label: 'DLBCL Influence', help: '(Clin / Ops / Fin)' },
  { key: 'mmInfluence', label: 'MM Influence', help: '(Clin / Ops / Fin)' },
  { key: 'primaryParent', label: 'Primary Parent' },
];

const stakeholderSortValue = (stakeholder, key) => {
  switch (key) {
    case 'name':
      return stakeholder.name || null;
    case 'role':
      return stakeholder.role || null;
    case 'dlbclPriority': {
      // Column shows DLBCL / MM target priority codes; sort on the combined value.
      const combined = `${priorityCode(stakeholder.dlbclPriority)}/${priorityCode(stakeholder.mmPriority)}`;
      return combined === '-/-' ? null : combined;
    }
    case 'dlbclInfluence': {
      const triplet = dlbclInfluenceTriplet(stakeholder);
      return triplet === '-/-/-' ? null : triplet;
    }
    case 'mmInfluence': {
      const triplet = mmInfluenceTriplet(stakeholder);
      return triplet === '-/-/-' ? null : triplet;
    }
    case 'primaryParent':
      return stakeholder.primaryParent || null;
    default:
      return '';
  }
};

// Expanded-row detail: two outlined cards (Barriers + Drivers) with left-accent
// stripes matching the home-activity-card pattern used elsewhere in the app.
// Small inline icon next to the label so each box reads at a glance.
function BarrierIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  );
}

function DriverIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function DetailPanel({ stakeholder }) {
  return (
    <div className="stakeholder-bd-expand">
      <article className="stakeholder-bd-card is-barrier is-dlbcl">
        <div className="stakeholder-bd-head">
          <span className="stakeholder-bd-icon"><BarrierIcon /></span>
          <h5 className="stakeholder-bd-label">DLBCL Barriers</h5>
        </div>
        <p className="stakeholder-bd-body">
          {stakeholder.nonMmBarriers || (
            <em className="stakeholder-bd-empty">No barriers captured.</em>
          )}
        </p>
      </article>
      <article className="stakeholder-bd-card is-driver is-dlbcl">
        <div className="stakeholder-bd-head">
          <span className="stakeholder-bd-icon"><DriverIcon /></span>
          <h5 className="stakeholder-bd-label">DLBCL Drivers</h5>
        </div>
        <p className="stakeholder-bd-body">
          {stakeholder.nonMmDrivers || (
            <em className="stakeholder-bd-empty">No drivers captured.</em>
          )}
        </p>
      </article>
      <article className="stakeholder-bd-card is-barrier is-mm">
        <div className="stakeholder-bd-head">
          <span className="stakeholder-bd-icon"><BarrierIcon /></span>
          <h5 className="stakeholder-bd-label">MM Barriers</h5>
        </div>
        <p className="stakeholder-bd-body">
          {stakeholder.mmBarriers || (
            <em className="stakeholder-bd-empty">No barriers captured.</em>
          )}
        </p>
      </article>
      <article className="stakeholder-bd-card is-driver is-mm">
        <div className="stakeholder-bd-head">
          <span className="stakeholder-bd-icon"><DriverIcon /></span>
          <h5 className="stakeholder-bd-label">MM Drivers</h5>
        </div>
        <p className="stakeholder-bd-body">
          {stakeholder.mmDrivers || (
            <em className="stakeholder-bd-empty">No drivers captured.</em>
          )}
        </p>
      </article>
    </div>
  );
}

export default function StakeholdersTab({
  stakeholders,
  filters,
  onFilterChange,
  priorityOptions = [],
  expanded,
  onToggleExpand,
  onAdd,
  onOpenEdit,
  commandSummary,
  isReadOnly = false,
}) {
  const [sort, setSort] = useState(null);
  const filtered = useMemo(() => {
    const matched = (stakeholders || []).filter((s) => stakeholderMatchesFilters(s, filters));
    // A manual column sort always wins. Otherwise, when the High Influence
    // filter is on, rank by the most H ratings across DLBCL + MM categories.
    if (!sort && filters.influence === 'High') {
      return [...matched].sort(
        (a, b) => stakeholderHighInfluenceCount(b) - stakeholderHighInfluenceCount(a)
      );
    }
    return stableSortRows(matched, sort, stakeholderSortValue);
  }, [stakeholders, filters, sort]);
  const roleOptions = stakeholderRoleOptions(stakeholders);
  const targetPriorityOptions = [
    'All',
    ...priorityOptions.filter((opt) => opt && opt !== 'All' && opt !== NON_TARGET_PRIORITY_OPTION),
    NON_TARGET_PRIORITY_OPTION,
  ];
  const handleSort = (key) => setSort((current) => nextTableSort(current, key));

  return (
    <>
      <article className="mock-card critical-activity-toolbar-card stakeholder-toolbar-card">
        {commandSummary && (
          <div className="stakeholder-command-kpi-row">
            {commandSummary}
          </div>
        )}
        <div className="critical-activity-toolbar">
          <div className="mock-filter-row bd-filter-strip stakeholder-filter-row">
            <div className="bd-filter-select-box stakeholder-filter-select-box">
              <label className="select-shell">
                <select
                  name="stakeholderRoleFilter"
                  aria-label="Stakeholder role filter"
                  value={filters.role}
                  onChange={(e) => onFilterChange({ ...filters, role: e.target.value })}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Role (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="stakeholderPriorityFilter"
                  aria-label="Stakeholder priority filter"
                  value={filters.priority}
                  onChange={(e) => onFilterChange({ ...filters, priority: e.target.value })}
                >
                  {targetPriorityOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Target Priority (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="stakeholder-toolbar-actions">
              <span className="stakeholder-count-pill">
                {(stakeholders || []).length || 0} Stakeholders
              </span>
              <button
                type="button"
                className="button primary-red critical-activity-new-button stakeholder-add-button"
                onClick={onAdd}
                disabled={isReadOnly || !onAdd}
              >
                Add Stakeholder
              </button>
            </div>
          </div>
        </div>
      </article>

      <article className="mock-card stakeholder-table-card">
        <div className="stakeholder-table-head">
        {STAKEHOLDER_TABLE_COLUMNS.map((column) => (
          <span key={column.key}>
            <TableSortButton column={column} sort={sort} onSort={handleSort} />
          </span>
        ))}
        <span />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state small">No stakeholders match the current filters.</div>
      )}

      {filtered.map((s) => {
        const isExpanded = !!(expanded && expanded[s.id]);
        const dlbclTriplet = dlbclInfluenceTriplet(s);
        const mmTriplet = mmInfluenceTriplet(s);
        return (
          <div key={s.id} className="stakeholder-table-item">
            <div
              className={`stakeholder-table-row${isExpanded ? ' is-expanded' : ''}`}
              onClick={() => onToggleExpand(s.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onToggleExpand(s.id);
              }}
            >
              <div className="stakeholder-name-cell">
                <button
                  type="button"
                  className="bd-expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(s.id);
                  }}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? '-' : '+'}
                </button>
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.stakeholderId || 'No stakeholder ID'}</small>
                </span>
              </div>
              <span>{displayValue(s.role)}</span>
              <span className="stakeholder-priority-cell">
                <em className="chip chip-blue">{priorityCode(s.dlbclPriority)}</em>
                <span className="stakeholder-priority-sep" aria-hidden="true">/</span>
                <em className="chip chip-mm">{priorityCode(s.mmPriority)}</em>
              </span>
              <span className="stakeholder-influence-triplet">{dlbclTriplet}</span>
              <span className="stakeholder-influence-triplet">{mmTriplet}</span>
              <span className="stakeholder-parent-cell" title={s.primaryParent || ''}>
                <span className="stakeholder-parent-value">{displayValue(s.primaryParent, '-')}</span>
              </span>
              <span className="stakeholder-row-actions">
                <button
                  type="button"
                  className="stakeholder-edit-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenEdit) onOpenEdit(s);
                  }}
                  disabled={!onOpenEdit}
                  aria-label={`Edit ${s.name || 'stakeholder'}`}
                  title="Edit"
                >
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
                </button>
              </span>
            </div>
            {isExpanded && <DetailPanel stakeholder={s} />}
          </div>
        );
      })}
      </article>
    </>
  );
}
