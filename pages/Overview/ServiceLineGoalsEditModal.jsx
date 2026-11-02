import { useEffect, useState } from 'react';

const CUSTOMER_GOALS_LIMIT = 500;
const CUSTOMER_GOALS_HEADING = 'Customer Goals for CAR T Service Line';

function Field({ label, children, className = '' }) {
  return (
    <label className={`stakeholder-edit-field ${className}`.trim()}>
      <span className="stakeholder-edit-field-label">{label}</span>
      {children}
    </label>
  );
}

export default function ServiceLineGoalsEditModal({ value, isSaving, error, onClose, onSave }) {
  const [draft, setDraft] = useState(value || '');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setDraft(value || '');
    setValidationError('');
  }, [value]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((draft || '').length > CUSTOMER_GOALS_LIMIT) {
      setValidationError(`Customer goals must be ${CUSTOMER_GOALS_LIMIT} characters or fewer.`);
      return;
    }
    if (onSave) onSave(draft);
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form
        className="stakeholder-edit-modal overview-goals-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>Edit {CUSTOMER_GOALS_HEADING}</h3>
            <p>Update the customer goals shown on the Home page.</p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body">
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <Field label={CUSTOMER_GOALS_HEADING} className="is-textarea">
                <textarea
                  id="service-line-customer-goals"
                  name="serviceLineCustomerGoals"
                  rows={8}
                  value={draft}
                  maxLength={CUSTOMER_GOALS_LIMIT}
                  onChange={(e) => {
                    setValidationError('');
                    setDraft(e.target.value);
                  }}
                />
              </Field>
            </div>
            <div className="overview-character-count">
              {(draft || '').length} / {CUSTOMER_GOALS_LIMIT} characters
            </div>
          </section>
          {(validationError || error) && (
            <div className="critical-activity-edit-error">{validationError || error}</div>
          )}
        </div>

        <footer className="stakeholder-edit-foot">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
            {isSaving ? 'Saving' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
}
