import { useEffect, useState } from 'react';
import { APPROVAL_COMMENT_MAX_LENGTH } from '@/lib/approvalComments';
import '@/styles/edit-modal.css';

export default function SubmitMpdApprovalModal({
  isSubmitting = false,
  error = '',
  onClose,
  onSubmit,
}) {
  const [comments, setComments] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSubmitting, onClose]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = comments.trim();
    if (!trimmed) {
      setValidationError('Comment is required.');
      return;
    }
    onSubmit?.(trimmed);
  };

  return (
    <div
      className="stakeholder-edit-overlay submit-mpd-approval-overlay"
      onClick={isSubmitting ? undefined : onClose}
      role="presentation"
    >
      <form
        className="stakeholder-edit-modal submit-mpd-approval-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>Submit for MPD Approval</h3>
            <p>Add approval comments before submitting this account plan.</p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSubmitting}
          />
        </header>

        <div className="stakeholder-edit-body submit-mpd-approval-body">
          <label className="stakeholder-edit-field is-textarea submit-mpd-comment-field">
            <span className="stakeholder-edit-field-label">Comments</span>
            <textarea
              value={comments}
              rows={5}
              maxLength={APPROVAL_COMMENT_MAX_LENGTH}
              required
              disabled={isSubmitting}
              onChange={(event) => {
                setValidationError('');
                setComments(event.target.value);
              }}
            />
            <span
              className="submit-mpd-comment-count"
              aria-live="polite"
              aria-label={`${comments.length} of ${APPROVAL_COMMENT_MAX_LENGTH} characters used`}
            >
              {comments.length}/{APPROVAL_COMMENT_MAX_LENGTH}
            </span>
          </label>

          {(validationError || error) && (
            <div className="critical-activity-edit-error">{validationError || error}</div>
          )}
        </div>

        <footer className="stakeholder-edit-foot">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="stakeholder-edit-button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </footer>
      </form>
    </div>
  );
}
