import { useContext, useMemo, useState } from 'react';
import TableSortButton from '@/components/TableSortButton';
import { formatDateLabel } from '@/lib/helper/utils';
import { nextTableSort, stableSortRows, toDateSortValue } from '@/lib/helper/tableSort';
import { usePageFilterState } from '@/lib/ui/pageFilterState';
import { PotentialAtcContext } from '../../lib/dataservice/accountPlan/PotentialAtcContext';

const INSIGHT_TABLE_COLUMNS = [
  { key: 'insightText', label: 'Insight' },
  { key: 'indication', label: 'Indication'},
  { key: 'insightCategory', label: 'Insight Category' },
  { key: 'createdDate', label: 'Created Date' },
  { key: 'createdBy', label: 'Created By' },
];

const INSIGHT_FILTER_DEFAULTS = { createdBy: 'All', createdDate: 'All' };

// Distinct option list for a given field on the insight rows. Falls back
// to an empty list when nothing is present; the "All" option is prepended
// by the caller so the picklist defaults to "show everything".
const uniqueInsightOptions = (insights, field) => {
  const seen = new Set();
  (insights || []).forEach((insight) => {
    const raw = insight?.[field];
    if (raw === null || raw === undefined || raw === '') return;
    seen.add(String(raw));
  });
  return Array.from(seen);
};

const insightSortValue = (insight, key) => {
  switch (key) {
    case 'insightText':
      return insight.insightText || insight.name || 'Insight';
    case 'indication':
      return insight.indication || null;
    case 'insightCategory':
      return insight.insightCategory || null;
    case 'createdDate':
      return toDateSortValue(insight.insightDate);
    case 'createdBy':
      return insight.createdBy || null;
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

export default function AccountInsightsTab({ insights, onAdd, onEdit, isReadOnly = false ,}) {
  const [sort, setSort] = useState(null);
  const [filters, setFilters] = usePageFilterState('account-insights', INSIGHT_FILTER_DEFAULTS);
  // Distinct creators and dates that actually appear in the data — drives
  // the two picklists at the top of the tab.
  const createdByOptions = useMemo(
    () => uniqueInsightOptions(insights, 'createdBy').sort((a, b) => a.localeCompare(b)),
    [insights]
  );
  const createdDateOptions = useMemo(
    () =>
      uniqueInsightOptions(insights, 'insightDate').sort((a, b) => {
        // Newest first.
        return String(b).localeCompare(String(a));
      }),
    [insights]
  );

  const filteredInsights = useMemo(
    () =>
      (insights || []).filter((insight) => {
        if (filters.createdBy !== 'All' && String(insight.createdBy || '') !== filters.createdBy) {
          return false;
        }
        if (filters.createdDate !== 'All' && String(insight.insightDate || '') !== filters.createdDate) {
          return false;
        }
        return true;
      }),
    [insights, filters]
  );

  const sortedInsights = useMemo(
    () => stableSortRows(filteredInsights, sort, insightSortValue),
    [filteredInsights, sort]
  );
  const handleSort = (key) => setSort((current) => nextTableSort(current, key));
  const isPotentialAtc = useContext(PotentialAtcContext);
  return (
    <div className="account-profile-workbook">
      {/* Filter toolbar — same Critical-Activities / Stakeholders shape:
          two picklists left, count pill + Add button right. */}
      <article className="mock-card critical-activity-toolbar-card account-insight-toolbar-card">
        <div className="critical-activity-toolbar">
          <div className="mock-filter-row bd-filter-row account-insight-filter-row">
            <label className="select-shell">
              <select
                name="accountInsightCreatedByFilter"
                aria-label="Account insight created by filter"
                value={filters.createdBy}
                onChange={(e) => setFilters({ ...filters, createdBy: e.target.value })}
              >
                <option value="All">Created By (All)</option>
                {createdByOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label className="select-shell">
              <select
                name="accountInsightCreatedDateFilter"
                aria-label="Account insight created date filter"
                value={filters.createdDate}
                onChange={(e) => setFilters({ ...filters, createdDate: e.target.value })}
              >
                <option value="All">Created Date (All)</option>
                {createdDateOptions.map((opt) => (
                  <option key={opt} value={opt}>{formatDateLabel(opt, opt)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="account-insight-toolbar-actions">
            <span className="account-insight-count-pill">{(insights || []).length || 0} Insights</span>
            <button
              type="button"
              className="button primary-red critical-activity-new-button"
              disabled={isReadOnly}
              onClick={onAdd}
            >
              Add Insight
            </button>
          </div>
        </div>
      </article>

      {/* Card-style table — same structure + chrome as Team Members:
          a single blue header bar followed by row cards each with a
          blue left-stripe accent. */}
      <article className="mock-card stakeholder-table-card account-insight-table-card">
        <div className="account-insight-table-head">
          {INSIGHT_TABLE_COLUMNS.map((column) => (
            <span key={column.key}>
              <TableSortButton column={column} sort={sort} onSort={handleSort} />
            </span>
          ))}
          <span className="profile-action-head" aria-hidden="true" />
        </div>
        {sortedInsights.map((insight) => (
          <div className="account-insight-table-row" key={insight.id}>
            <span><strong>{insight.insightText || insight.name || 'Insight'}</strong></span>
            <span>{insight.indication || '-'}</span>
             <span>{insight.insightCategory || '-'}</span>
            <span>{formatDateLabel(insight.insightDate, '-')}</span>
            <span>{insight.createdBy || '-'}</span>
            <span className="stakeholder-row-actions">
              <button
                type="button"
                className="stakeholder-edit-button account-insight-edit-button"
                onClick={() => onEdit(insight)}
                disabled={isReadOnly}
                aria-label={`Edit ${insight.insightText || insight.name || 'account insight'}`}
                title="Edit"
              >
                <EditPencilIcon />
              </button>
            </span>
          </div>
        ))}
        {sortedInsights.length === 0 && (
          <div className="empty-state small">No account insights match the current filters.</div>
        )}
      </article>
    </div>
  );
}
