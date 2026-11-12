import { useCallback, useEffect, useState } from 'react';
import { formatDate } from '@/lib/helper/utils';
import { APPROVAL_COMMENT_MAX_LENGTH } from '@/lib/approvalComments';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';
import '@/components/ManagerApprovalModals.css';

const REVIEW_FIELDS = [
  { key: 'approvalStatus', label: 'Approval Status' },
  { key: 'comments', label: 'Comments' },
  { key: 'submittedDate', label: 'Submitted Date', type: 'date' },
  { key: 'approvalDueDate', label: 'Approval Due Date', type: 'date' },
  { key: 'lastMpdReviewDate', label: 'Last MPD Review Date', type: 'date' },
  { key: 'lastAccountInsightUpdate', label: 'Last Account Insight Update', type: 'date' },
  {
    key: 'lastAdditionalCriticalActivityUpdate',
    label: 'Last Additional Critical Activity Update',
    type: 'date',
  },
  {
    key: 'lastBarrierTacticalActionUpdate',
    label: 'Last Barrier & Tactical Action Update',
    type: 'date',
  },
];
const REVIEW_TIMING_FIELDS = REVIEW_FIELDS.slice(2, 5);
const REVIEW_ACTIVITY_FIELDS = REVIEW_FIELDS.slice(5);

const DECISION_META = {
  Approved: {
    label: 'Approve',
    title: 'Approval rationale',
    description: 'Document why this Account Plan is ready to move forward.',
    confirmLabel: 'Approve Account Plan',
    tone: 'approve',
  },
  Rejected: {
    label: 'Revise & Resubmit',
    title: 'Required changes',
    description: 'Explain what must change before this plan is resubmitted.',
    confirmLabel: 'Revise & Resubmit Account Plan',
    tone: 'reject',
  },
  Reassigned: {
    label: 'Reassign',
    title: 'Choose a new reviewer',
    description: 'Send this approval request to another CTAM Manager.',
    confirmLabel: 'Reassign',
    tone: 'reassign',
  },
};

const historyDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const reviewValue = (plan, field) => {
  const value = field.key === 'lastMpdReviewDate'
    ? plan?.lastMpdReviewDate || plan?.lastMpdApprovalDate
    : plan?.[field.key];
  if (field.type === 'date') return formatDate(value, '-');
  return value || '-';
};

function useEscapeClose(onClose, disabled = false) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && !disabled) onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [disabled, onClose]);
}

function ApprovalModalShell({ title, description, plan, onClose, children, className = '' }) {
  return (
    <div className="stakeholder-edit-overlay manager-approval-overlay" onClick={onClose} role="presentation">
      <section
        className={`manager-approval-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-approval-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="manager-approval-head">
          <div>
            <span className="manager-approval-eyebrow">Manager approval workspace</span>
            <h3 id="manager-approval-modal-title">{title}</h3>
            <p>{description}</p>
            <span className="manager-approval-plan-name">{plan?.name || 'Account Plan'}</span>
          </div>
          <button type="button" className="stakeholder-edit-close" onClick={onClose} aria-label="Close" />
        </header>
        {children}
      </section>
    </div>
  );
}

export function ApprovalHistoryModal({
  plan,
  entries = [],
  status = 'ready',
  error = '',
  onRetry,
  onClose,
}) {
  useEscapeClose(onClose);
  const isLoading = status === 'loading';
  const hasError = status === 'error';

  return (
    <ApprovalModalShell
      title="Approval History"
      description="A chronological record of this Account Plan's manager approval activity."
      plan={plan}
      onClose={onClose}
      className="is-history"
    >
      <div className="manager-approval-body">
        <div className="manager-history-summary" aria-live="polite">
          <span className="manager-history-summary-dot" aria-hidden="true" />
          <span>
            {isLoading
              ? 'Loading approval history...'
              : `${entries.length} approval ${entries.length === 1 ? 'event' : 'events'}`}
          </span>
        </div>
        <div className="manager-history-table-wrap" aria-busy={isLoading}>
          <table className="manager-history-table">
            <thead>
              <tr>
                <th>Created Date</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Actual Approver</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="manager-history-message" colSpan={5}>Loading approval history...</td>
                </tr>
              )}
              {hasError && (
                <tr>
                  <td className="manager-history-message is-error" colSpan={5}>
                    <span>{error || 'Unable to load approval history.'}</span>
                    <button type="button" onClick={onRetry}>Try again</button>
                  </td>
                </tr>
              )}
              {!isLoading && !hasError && entries.length === 0 && (
                <tr>
                  <td className="manager-history-message" colSpan={5}>No approval history was found for this Account Plan.</td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{historyDate(entry.createdDate)}</td>
                  <td><span className="manager-history-action">{entry.status || '-'}</span></td>
                  <td>{entry.assignedTo || '-'}</td>
                  <td>{entry.actualApprover || '-'}</td>
                  <td><div className="manager-history-comment">{entry.comments || '-'}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ApprovalModalShell>
  );
}

export function ManagerApprovalReviewModal({
  plan,
  reassignUsers = [],
  reassignUsersStatus = 'ready',
  isSaving = false,
  refreshStatus = 'idle',
  error = '',
  onClose,
  onDecision,
  onReassign,
  onClearError,
}) {
  const [decision, setDecision] = useState(null);
  const [comments, setComments] = useState('');
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [validationError, setValidationError] = useState('');
  const decisionMeta = decision ? DECISION_META[decision] : null;
  const refreshMessage = refreshStatus === 'loading'
    ? 'Refreshing the latest CRM approval details...'
    : refreshStatus === 'ready'
      ? 'Latest CRM approval details loaded'
      : refreshStatus === 'error'
        ? 'Showing the Account Plan details already loaded'
        : 'Account Plan approval details ready';

  const searchReassignUsers = useCallback((query, resultLimit = 60) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const matches = normalizedQuery
      ? reassignUsers.filter((user) => user.name.toLowerCase().includes(normalizedQuery))
      : reassignUsers;
    return Promise.resolve(matches.slice(0, resultLimit));
  }, [reassignUsers]);

  const closeDecision = () => {
    if (isSaving) return;
    setDecision(null);
    setValidationError('');
    onClearError?.();
  };

  useEscapeClose(() => {
    if (decision) {
      closeDecision();
      return;
    }
    onClose?.();
  }, isSaving);

  const chooseDecision = (nextDecision) => {
    setDecision(nextDecision);
    setComments('');
    setAssigneeQuery('');
    setSelectedAssigneeId('');
    setValidationError('');
    onClearError?.();
  };

  const confirmDecision = (event) => {
    event.preventDefault();
    if (isSaving) return;
    const trimmedComments = comments.trim();
    if (!trimmedComments) {
      setValidationError(decision === 'Reassigned'
        ? 'Comment is required for reassignment.'
        : 'Comment is required for approval and Revise & Resubmit decisions.');
      return;
    }
    if (decision === 'Reassigned') {
      const assignee = reassignUsers.find((user) => user.id === selectedAssigneeId);
      if (!assignee) {
        setValidationError('Select a CTAM Manager.');
        return;
      }
      if (!onReassign) {
        setValidationError('Reassignment is unavailable.');
        return;
      }
      onReassign({ assignee, comments: trimmedComments });
      return;
    }
    onDecision?.({ action: decision, comments: trimmedComments });
  };

  return (
    <ApprovalModalShell
      title="Review Account Plan"
      description="Review the submitted approval details before making a manager decision."
      plan={plan}
      onClose={onClose}
      className="is-review"
    >
      <div className="manager-approval-body">
        <div className="manager-review-dossier">
          <div
            className={`manager-review-sync is-${refreshStatus}`}
            role="status"
            aria-live="polite"
          >
            <span className="manager-review-sync-dot" aria-hidden="true" />
            <span>{refreshMessage}</span>
          </div>

          <div className="manager-review-summary">
            <section className="manager-review-status-card" aria-label="Approval status">
              <span className="manager-review-section-kicker">Decision context</span>
              <strong>Approval Status</strong>
              <span className="manager-review-status-value">
                {reviewValue(plan, REVIEW_FIELDS[0])}
              </span>
            </section>
            <section className="manager-review-comments-card" aria-label="Approval comments">
              <span className="manager-review-section-kicker">Reviewer brief</span>
              <strong>Comments</strong>
              <p>{reviewValue(plan, REVIEW_FIELDS[1])}</p>
            </section>
          </div>

          <section className="manager-review-section" aria-labelledby="manager-review-timing-title">
            <header>
              <span className="manager-review-section-kicker">Milestones</span>
              <h4 id="manager-review-timing-title">Approval timeline</h4>
            </header>
            <dl className="manager-review-grid">
              {REVIEW_TIMING_FIELDS.map((field) => (
                <div className="manager-review-item" key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{reviewValue(plan, field)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="manager-review-section" aria-labelledby="manager-review-activity-title">
            <header>
              <span className="manager-review-section-kicker">Plan currency</span>
              <h4 id="manager-review-activity-title">Latest Account Plan updates</h4>
            </header>
            <dl className="manager-review-grid is-activity">
              {REVIEW_ACTIVITY_FIELDS.map((field) => (
                <div className="manager-review-item" key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{reviewValue(plan, field)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <footer className="manager-approval-foot is-review-actions">
        <div>
          <button type="button" className="manager-action-button is-approve" onClick={() => chooseDecision('Approved')}>Approve</button>
          <button type="button" className="manager-action-button is-reject" onClick={() => chooseDecision('Rejected')}>Revise & Resubmit</button>
          <button type="button" className="manager-action-button is-reassign" onClick={() => chooseDecision('Reassigned')}>Reassign</button>
        </div>
      </footer>

      {decisionMeta && (
        <div
          className="manager-decision-confirm-overlay"
          role="presentation"
          onClick={isSaving ? undefined : closeDecision}
        >
          <form
            className={`manager-decision-confirm-modal is-${decisionMeta.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-decision-confirm-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={confirmDecision}
          >
            <header className="manager-decision-confirm-head">
              <div className="manager-decision-copy">
                <span>Confirm manager decision</span>
                <strong id="manager-decision-confirm-title">{decisionMeta.label}</strong>
                <span>{decisionMeta.description}</span>
              </div>
              <button
                type="button"
                className="stakeholder-edit-close"
                aria-label="Close decision"
                onClick={closeDecision}
                disabled={isSaving}
              />
            </header>
            <div className="manager-decision-confirm-body">
              <div className="manager-decision-context">
                <span>Account Plan</span>
                <strong>{plan?.name || 'Account Plan'}</strong>
              </div>
              {decision === 'Reassigned' && (
                <div className="manager-decision-field manager-reassign-field">
                  <AccountLookupField
                    label="Reassign to"
                    query={assigneeQuery}
                    placeholder="Search eligible managers"
                    searchAccounts={searchReassignUsers}
                    loadingText="Searching eligible managers..."
                    emptyText="No eligible managers match your search."
                    className="manager-reassign-user-lookup"
                    resultLimit={60}
                    disabled={isSaving || reassignUsersStatus === 'loading' || reassignUsers.length === 0}
                    highlightMatches
                    onQueryChange={(value) => {
                      setAssigneeQuery(value);
                      setSelectedAssigneeId('');
                      setValidationError('');
                    }}
                    onSelect={(user) => {
                      setAssigneeQuery(user?.name || '');
                      setSelectedAssigneeId(user?.id || '');
                      setValidationError('');
                    }}
                  />
                  <small>
                    {reassignUsersStatus === 'loading'
                      ? 'Loading eligible managers...'
                      : 'Only eligible managers are shown in this list.'}
                  </small>
                </div>
              )}
              <label className="manager-decision-field">
                <span>Comment</span>
                <textarea
                  rows={decision === 'Reassigned' ? 3 : 4}
                  value={comments}
                  maxLength={APPROVAL_COMMENT_MAX_LENGTH}
                  disabled={isSaving}
                  placeholder={decision === 'Reassigned'
                    ? 'Add context for the new reviewer...'
                    : decision === 'Rejected'
                      ? 'Explain what should be revised...'
                      : 'Capture the approval rationale...'}
                  onChange={(event) => {
                    setComments(event.target.value);
                    setValidationError('');
                  }}
                  autoFocus
                />
                <span
                  className="manager-decision-comment-count"
                  aria-live="polite"
                  aria-label={`${comments.length} of ${APPROVAL_COMMENT_MAX_LENGTH} characters used`}
                >
                  {comments.length}/{APPROVAL_COMMENT_MAX_LENGTH}
                </span>
              </label>
              {(validationError || error) && (
                <div className="manager-decision-error" role="alert">{validationError || error}</div>
              )}
            </div>
            <footer className="manager-decision-confirm-foot">
              <button type="button" onClick={closeDecision} disabled={isSaving}>Cancel</button>
              <button
                type="submit"
                className={`is-${decisionMeta.tone}`}
                disabled={isSaving || (
                  decision === 'Reassigned' && (
                    reassignUsersStatus === 'loading' || reassignUsers.length === 0
                  )
                )}
              >
                {isSaving ? 'Saving...' : decisionMeta.confirmLabel}
              </button>
            </footer>
          </form>
        </div>
      )}
    </ApprovalModalShell>
  );
}
