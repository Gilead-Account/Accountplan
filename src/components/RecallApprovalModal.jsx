import { useEffect, useRef, useState } from 'react';
import { APPROVAL_COMMENT_MAX_LENGTH } from '@/lib/approvalComments';
import '@/styles/edit-modal.css';

export default function RecallApprovalModal({
  planName = 'Account Plan',
  isRecalling = false,
  error = '',
  onClose,
  onRecall,
}) {
  const [comments, setComments] = useState('');
  const [validationError, setValidationError] = useState('');
  const commentsRef = useRef(null);

  useEffect(() => {
    commentsRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !isRecalling) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRecalling, onClose]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = comments.trim();
    if (!trimmed) {
      setValidationError('Comment is required.');
      commentsRef.current?.focus();
      return;
    }
    onRecall?.(trimmed);
  };

  return (
    <div
      className="stakeholder-edit-overlay recall-approval-overlay"
      onClick={isRecalling ? undefined : onClose}
      role="presentation"
    >
      <form
        className="stakeholder-edit-modal recall-approval-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recall-approval-title"
        aria-describedby="recall-approval-description"
        noValidate
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="stakeholder-edit-head recall-approval-head">
          <div className="stakeholder-edit-title">
            <span className="recall-approval-eyebrow">Approval workflow</span>
            <h3 id="recall-approval-title">Recall Account Plan</h3>
            <p id="recall-approval-description">
              Return this plan to an editable state before manager review.
            </p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onClose}
            aria-label="Close Recall Account Plan"
            disabled={isRecalling}
          />
        </header>

        <div className="stakeholder-edit-body recall-approval-body">
          <div className="recall-approval-context">
            <span>Account Plan</span>
            <strong title={planName}>{planName}</strong>
          </div>

          <label className="stakeholder-edit-field is-textarea recall-approval-comment-field">
            <span className="stakeholder-edit-field-label">Comments</span>
            <textarea
              ref={commentsRef}
              value={comments}
              rows={5}
              maxLength={APPROVAL_COMMENT_MAX_LENGTH}
              required
              disabled={isRecalling}
              placeholder="Explain why this plan is being recalled..."
              onChange={(event) => {
                setValidationError('');
                setComments(event.target.value);
              }}
            />
            <span
              className="recall-approval-comment-count"
              aria-live="polite"
              aria-label={`${comments.length} of ${APPROVAL_COMMENT_MAX_LENGTH} characters used`}
            >
              {comments.length}/{APPROVAL_COMMENT_MAX_LENGTH}
            </span>
          </label>

          {(validationError || error) && (
            <div className="critical-activity-edit-error" role="alert">
              {validationError || error}
            </div>
          )}
        </div>

        <footer className="stakeholder-edit-foot recall-approval-foot">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isRecalling}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="stakeholder-edit-button-primary recall-approval-submit"
            disabled={isRecalling}
          >
            {isRecalling ? 'Recalling...' : 'Recall Account Plan'}
          </button>
        </footer>
      </form>
    </div>
  );
}
