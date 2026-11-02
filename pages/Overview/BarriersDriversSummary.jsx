import HomeFieldHelp from '@/components/HomeFieldHelp';
import { truncateDisplay, impactTone, statusTone } from '@/lib/helper/utils';

// On Home, only individual rows are interactive — the surrounding section
// itself does NOT navigate. Clicking a row opens the inline edit modal
// owned by Overview/index.jsx (it does not switch pages).

const HOME_SUMMARY_COLUMNS = [
  { key: 'category', label: 'Category' },
  { key: 'name', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'businessImpact', label: 'Business Impact' },
  { key: 'indication', label: 'Indication' },
  { key: 'activityCount', label: 'Critical Activities' },
];

const toneClass = (tone) => `is-${tone || 'neutral'}`;

function SummaryTable({ table, openActivityCountByBarrier, onEditRow }) {
  const rows = table.rows || [];

  return (
    <section className="home-summary-table">
      <div className={`home-summary-table-head ${table.tone || ''}`}>
        <strong className="home-summary-table-title">
          <span>{table.title}</span>
          <HomeFieldHelp
            helpKey={table.type === 'Driver' ? 'drivers' : 'barriers'}
            label={table.title}
            className="home-summary-table-help"
          />
        </strong>
        <span className="summary-stat-row">
          <span className="summary-counts summary-counts-combined">
            <span>{table.countSummary}</span>
            {table.activityWindow && <small>{table.activityWindow}</small>}
          </span>
        </span>
      </div>
      <div className={`home-summary-columns ${table.tone || ''}`}>
        {HOME_SUMMARY_COLUMNS.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
      </div>
      <div className="home-summary-rows">
        {rows.map((row) => {
          const count = (openActivityCountByBarrier && openActivityCountByBarrier[row.id]) || 0;
          return (
            <button
              key={row.id}
              className="home-summary-row"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onEditRow) onEditRow(row, e);
              }}
              disabled={!onEditRow}
            >
              <span>{row.category || '-'}</span>
              <strong>{truncateDisplay(row.name, 55)}</strong>
              <span className="home-summary-status-cell">
                <span className={`home-summary-tone-text ${toneClass(statusTone(row.status))}`}>
                  {row.status || 'Open'}
                </span>
              </span>
              <span className="home-summary-impact-cell">
                <span className={`home-summary-tone-text ${toneClass(impactTone(row.businessImpact))}`}>
                  {row.businessImpact || 'Not set'}
                </span>
              </span>
              <span className="home-summary-indication-cell">
                <span className="home-summary-plain-text">{row.indication || '-'}</span>
              </span>
              <span className="home-summary-activity-count-cell">
                <strong>{count}</strong>
              </span>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="empty-state small">
            No open {String(table.label || '').toLowerCase()} captured.
          </div>
        )}
      </div>
    </section>
  );
}

export default function BarriersDriversSummary({
  tables,
  openActivityCountByBarrier,
  onEditRow,
}) {
  return (
    <article className="mock-card home-bd-summary-card">
      <div className="mock-section-head">
        <h3>Barriers and Drivers</h3>
      </div>
      {(tables || []).map((table) => (
        <SummaryTable
          key={table.type}
          table={table}
          openActivityCountByBarrier={openActivityCountByBarrier}
          onEditRow={onEditRow}
        />
      ))}
    </article>
  );
}
