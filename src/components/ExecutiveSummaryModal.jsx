import '@/components/ExecutiveSummaryModal.css';

const rowsOrEmpty = (rows) => (Array.isArray(rows) && rows.length ? rows : null);

function SummaryFieldGrid({ items }) {
  return (
    <div className="executive-summary-key-grid">
      {(items || []).map((item) => (
        <div className="executive-summary-key-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value || 'Not entered'}</strong>
        </div>
      ))}
    </div>
  );
}

function SummaryCardGrid({ items, className = '' }) {
  return (
    <div className={`executive-summary-card-grid ${className}`}>
      {(items || []).map((item) => (
        <article className="executive-summary-card" key={item.title}>
          <h3>{item.title}</h3>
          <p>{item.body || 'Not entered'}</p>
        </article>
      ))}
    </div>
  );
}

function CountColumn({ title, rows }) {
  const visibleRows = rowsOrEmpty(rows);
  return (
    <article className="executive-summary-count-column">
      <h3>{title}</h3>
      {visibleRows ? (
        <div className="executive-summary-count-list">
          {visibleRows.map((row, index) => (
            <div className="executive-summary-count-row" key={`${title}-${row.title}-${index}`}>
              <strong>{row.title}</strong>
              <span>{row.indication} {row.category}</span>
              <em>{row.openActivities} Open Critical Activities</em>
            </div>
          ))}
        </div>
      ) : (
        <p className="executive-summary-empty">No records available.</p>
      )}
    </article>
  );
}

function SimpleTable({ title, headers, rows, className = '' }) {
  const visibleRows = rowsOrEmpty(rows);
  return (
    <section className={`executive-summary-table-section ${className}`}>
      <h3>{title}</h3>
      <div className="executive-summary-table" role="table" aria-label={title}>
        <div className="executive-summary-table-head" role="row">
          {headers.map((header) => (
            <span role="columnheader" key={header}>{header}</span>
          ))}
        </div>
        {visibleRows ? visibleRows.map((row, rowIndex) => (
          <div className="executive-summary-table-row" role="row" key={`${title}-${rowIndex}`}>
            {headers.map((header) => (
              <span role="cell" key={header}>{row[header] || 'Not entered'}</span>
            ))}
          </div>
        )) : (
          <div className="executive-summary-empty-row">No records available.</div>
        )}
      </div>
    </section>
  );
}

function OpenBarrierDriverTable({ rows }) {
  const visibleRows = rowsOrEmpty(rows);
  const headers = ['Type', 'Title', 'Indication', 'Strategy', 'Category', 'Business Impact', 'Comments'];
  const fields = ['type', 'title', 'indication', 'strategy', 'category', 'businessImpact', 'comments'];
  return (
    <section className="executive-summary-table-section summary-open-bd-table">
      <h3>Open Barriers / Drivers</h3>
      <div className="executive-summary-table executive-summary-open-bd-grid" role="table" aria-label="Open barriers and drivers">
        <div className="executive-summary-table-head" role="row">
          {headers.map((header) => (
            <span role="columnheader" key={header}>{header}</span>
          ))}
        </div>
        {visibleRows ? visibleRows.map((row, rowIndex) => (
          <div className="executive-summary-table-row" role="row" key={`${row.type}-${row.title}-${rowIndex}`}>
            {fields.map((field) => (
              <span role="cell" key={field}>{row[field] || 'Not entered'}</span>
            ))}
          </div>
        )) : (
          <div className="executive-summary-empty-row">No open records available.</div>
        )}
      </div>
    </section>
  );
}

export default function ExecutiveSummaryModal({
  summary,
  status = 'idle',
  error,
  onClose,
  onSavePdf,
  isSavingPdf = false,
}) {
  const isLoading = status === 'loading';
  const isError = status === 'error';
  return (
    <div className="modal-scrim executive-summary-overlay" role="presentation">
      <section
        className="executive-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="executiveSummaryTitle"
      >
        <header className="executive-summary-modal-head">
          <div>
            <span>Executive Summary</span>
            <h2 id="executiveSummaryTitle">{summary?.title || 'Executive Summary'}</h2>
          </div>
          <div className="executive-summary-modal-actions">
            <button
              type="button"
              className="button secondary executive-summary-pdf-button"
              onClick={onSavePdf}
              disabled={isSavingPdf || isLoading || isError}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save as PDF'}
            </button>
            <button type="button" className="executive-summary-close-button" onClick={onClose} aria-label="Close executive summary">
              x
            </button>
          </div>
        </header>

        <div className="executive-summary-modal-body">
          {isLoading && (
            <div className="executive-summary-state">
              <div className="loading-spinner" />
              <strong>Loading executive summary...</strong>
            </div>
          )}

          {isError && (
            <div className="executive-summary-state error">
              <strong>Executive summary failed to load.</strong>
              <span>{error?.message || String(error || 'Unknown error')}</span>
            </div>
          )}

          {!isLoading && !isError && summary && (
            <div className="executive-summary-page">
              <section className="executive-summary-hero">
                <h1>{summary.title}</h1>
                <p><strong>ATC Account Name:</strong> {summary.accountLine}</p>
              </section>

              <section className="executive-summary-section">
                <h2>Account Key Information</h2>
                <SummaryFieldGrid items={summary.keyInfo} />
              </section>

              <section className="executive-summary-section">
                <h2>Customer Goals & Kite Strategy</h2>
                <SummaryCardGrid items={summary.goalsAndStrategy} />
              </section>

              <section className="executive-summary-section">
                <h2>Plan of Action</h2>
                <SummaryCardGrid items={summary.planOfAction} className="executive-summary-poa-grid" />
              </section>

              <section className="executive-summary-section">
                <h2>Barriers & Drivers with Critical Activities</h2>
                <div className="executive-summary-count-grid">
                  <CountColumn title="Barriers" rows={summary.barrierDriverCounts?.barriers} />
                  <CountColumn title="Drivers" rows={summary.barrierDriverCounts?.drivers} />
                </div>
              </section>

              <SimpleTable
                title="Top Stakeholders"
                className="executive-summary-stakeholder-table"
                headers={['Name', 'DLBCL Influence', 'MM Influence', 'Stakeholder Drivers / Barriers']}
                rows={(summary.topStakeholders || []).map((row) => ({
                  Name: row.name,
                  'DLBCL Influence': row.dlbclInfluence,
                  'MM Influence': row.mmInfluence,
                  'Stakeholder Drivers / Barriers': row.driversBarriers,
                }))}
              />

              <SimpleTable
                title="Critical Activities"
                className="executive-summary-activity-table"
                headers={['Title', 'Related Barrier', 'Indication', 'Status', 'Accountable', 'Due Date', 'Last Modified Date']}
                rows={(summary.criticalActivities || []).map((row) => ({
                  Title: row.title,
                  'Related Barrier': row.relatedBarrier,
                  Indication: row.indication,
                  Status: row.status,
                  Accountable: row.accountable,
                  'Due Date': row.dueDate,
                  'Last Modified Date': row.lastModifiedDate,
                }))}
              />

              <OpenBarrierDriverTable rows={summary.openBarrierDrivers} />

              <SimpleTable
                title="Kite Team Members"
                className="executive-summary-team-table"
                headers={['Name', 'Role', 'Status', 'Participation']}
                rows={(summary.teamMembers || []).map((row) => ({
                  Name: row.name,
                  Role: row.role,
                  Status: row.status,
                  Participation: row.participation,
                }))}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
